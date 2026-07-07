import Matter from "matter-js";
import { Fighter, tagOf, CAT_PROJ, CAT_WALL, CAT_BALL } from "./fighter";
import type { BodyTag } from "./fighter";
import { ARENA_SIZE, ARENA_X, ARENA_Y, HIT_COOLDOWN, METER_MAX, STEP } from "./constants";
import { Rng } from "./rng";
import { Sound } from "./audio";
import { getChar } from "./characters";
import type { EngineEvent, LineupEntry, MatchPhase } from "./types";

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  t: number; life: number; size: number; color: number;
}
export interface Ring { x: number; y: number; r: number; max: number; w: number; color: number; t: number; life: number }
export interface Popup { x: number; y: number; vy: number; t: number; life: number; text: string; color: number; crit: boolean }
export interface Beam { x: number; y: number; angle: number; length: number; width: number; color: number; t: number; life: number }
export interface Callout { text: string; color: number; t: number; life: number }

export interface Projectile {
  body: Matter.Body;
  kind: "bullet" | "orb" | "heart" | "nail" | "gateblade";
  team: number;
  owner: Fighter;
  dmg: number;
  color: number;
  life: number;
  /** rad/s steering for homing kinds. */
  turn?: number;
  speed?: number;
  /** nails stick into walls. */
  stuck?: boolean;
  /** fighters this piercing projectile already hit. */
  hit?: Set<number>;
  /** rect length for nail/gateblade rendering. */
  len?: number;
}

/** Tyrant-style summoning portal that fires a projectile after a windup. */
export interface Gate {
  x: number; y: number; angle: number; t: number; fireAt: number; life: number;
  color: number; owner: Fighter; dmg: number;
}

export class Engine {
  world: Matter.World;
  physics: Matter.Engine;
  rng: Rng;
  fighters: Fighter[] = [];
  /** The original lineup (no clones) — drives the meter/stat UI. */
  roster: Fighter[] = [];
  projectiles: Projectile[] = [];
  gates: Gate[] = [];
  particles: Particle[] = [];
  rings: Ring[] = [];
  popups: Popup[] = [];
  beams: Beam[] = [];
  callouts: Callout[] = [];
  shake = 0;
  time = 0;
  /** WORLD STASIS time-stop overlay timer. */
  stasisT = 0;
  phase: MatchPhase = "intro";
  phaseT = 0;
  winners: Fighter[] = [];
  events: EngineEvent[] = [];
  private hitstop = 0;
  private slowmo = 0;
  private acc = 0;
  private clashCd = new Map<string, number>();
  private bodyCd = new Map<string, number>();

  constructor(lineup: LineupEntry[], seed: number) {
    this.rng = new Rng(seed);
    this.physics = Matter.Engine.create({ gravity: { x: 0, y: 0, scale: 0 } });
    this.physics.positionIterations = 8;
    this.physics.velocityIterations = 6;
    this.world = this.physics.world;

    // Arena walls
    const t = 120;
    const cx = ARENA_X + ARENA_SIZE / 2;
    const walls = [
      Matter.Bodies.rectangle(cx, ARENA_Y - t / 2, ARENA_SIZE + t * 2, t, { isStatic: true }),
      Matter.Bodies.rectangle(cx, ARENA_Y + ARENA_SIZE + t / 2, ARENA_SIZE + t * 2, t, { isStatic: true }),
      Matter.Bodies.rectangle(ARENA_X - t / 2, ARENA_Y + ARENA_SIZE / 2, t, ARENA_SIZE + t * 2, { isStatic: true }),
      Matter.Bodies.rectangle(ARENA_X + ARENA_SIZE + t / 2, ARENA_Y + ARENA_SIZE / 2, t, ARENA_SIZE + t * 2, { isStatic: true }),
    ];
    for (const w of walls) {
      w.restitution = 1;
      w.friction = 0;
      w.collisionFilter.category = CAT_WALL;
      w.collisionFilter.mask = CAT_BALL | CAT_PROJ;
      (w.plugin as BodyTag) = { role: "wall" };
    }
    Matter.World.add(this.world, walls);

    // Spawn fighters in a ring
    const n = lineup.length;
    lineup.forEach((entry, i) => {
      const def = getChar(entry.charId);
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const rx = ARENA_SIZE * 0.3, ry = ARENA_SIZE * 0.3;
      const f = new Fighter(def, entry.team,
        cx + Math.cos(a) * rx, ARENA_Y + ARENA_SIZE / 2 + Math.sin(a) * ry,
        this.rng.range(0, Math.PI * 2));
      this.addFighter(f);
      this.roster.push(f);
    });

    Matter.Events.on(this.physics, "collisionStart", (ev) => this.onCollisions(ev));
  }

  addFighter(f: Fighter) {
    this.fighters.push(f);
    Matter.World.add(this.world, f.body);
    if (f.weapon) Matter.World.add(this.world, [f.weapon, f.pin!]);
  }

  aliveFighters() { return this.fighters.filter(f => f.alive); }
  aliveTeams() { return [...new Set(this.aliveFighters().map(f => f.team))]; }

  nearestEnemy(f: Fighter): Fighter | null {
    let best: Fighter | null = null, bd = Infinity;
    for (const o of this.fighters) {
      if (!o.alive || o.team === f.team) continue;
      const d = Math.hypot(o.x - f.x, o.y - f.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  enemies(f: Fighter) { return this.fighters.filter(o => o.alive && o.team !== f.team); }

  /** Angle from (x,y) that leads a moving target for a projectile of given speed. */
  aimLead(x: number, y: number, target: Fighter, projSpeed: number): number {
    const d = Math.hypot(target.x - x, target.y - y);
    const t = d / projSpeed;
    const px = target.x + target.body.velocity.x * t * 0.85;
    const py = target.y + target.body.velocity.y * t * 0.85;
    return Math.atan2(py - y, px - x);
  }

  // ---------- combat ----------

  private onCollisions(ev: Matter.IEventCollision<Matter.Engine>) {
    if (this.phase !== "fight" && this.phase !== "ko") return;
    for (const pair of ev.pairs) {
      const a = tagOf(pair.bodyA), b = tagOf(pair.bodyB);
      if (!a || !b) continue;
      this.handlePair(a, b, pair);
      this.handlePair(b, a, pair);
    }
  }

  private contactPoint(pair: Matter.Pair): { x: number; y: number } {
    const c = (pair as any).contacts?.[0]?.vertex ?? (pair as any).collision?.supports?.[0];
    if (c) return { x: c.x, y: c.y };
    return { x: (pair.bodyA.position.x + pair.bodyB.position.x) / 2, y: (pair.bodyA.position.y + pair.bodyB.position.y) / 2 };
  }

  private handlePair(a: BodyTag, b: BodyTag, pair: Matter.Pair) {
    // weapon hits enemy ball
    if (a.role === "weapon" && b.role === "ball" && a.fighter && b.fighter
      && a.fighter.alive && b.fighter.alive && a.fighter.team !== b.fighter.team) {
      const key = `${a.fighter.id}:w`;
      if (!b.fighter.hitCooldowns.has(key)) {
        b.fighter.hitCooldowns.set(key, HIT_COOLDOWN);
        this.dealDamage(a.fighter, b.fighter, a.fighter.st.damage);
      }
    }
    // weapon vs weapon clank
    if (a.role === "weapon" && b.role === "weapon" && a.fighter && b.fighter
      && a.fighter.team !== b.fighter.team && a.fighter.alive && b.fighter.alive) {
      const key = `${Math.min(a.fighter.id, b.fighter.id)}x${Math.max(a.fighter.id, b.fighter.id)}`;
      if (!this.clashCd.has(key)) {
        this.clashCd.set(key, 0.25);
        const p = this.contactPoint(pair);
        this.burst(p.x, p.y, 8, 0xfff3b0, 260);
        Sound.clash();
      }
    }
    // ball rams enemy ball (contact damage chars)
    if (a.role === "ball" && b.role === "ball" && a.fighter && b.fighter
      && a.fighter.team !== b.fighter.team && a.fighter.alive && b.fighter.alive) {
      const contact = a.fighter.st.contact ?? 0;
      if (contact > 0) {
        const key = `${a.fighter.id}>${b.fighter.id}`;
        if (!this.bodyCd.has(key)) {
          this.bodyCd.set(key, 0.4);
          this.dealDamage(a.fighter, b.fighter, contact);
        }
      }
    }
    // projectile hits
    if (a.role === "proj") {
      const proj = this.projectiles.find(p => p.body === (pair.bodyA.parent ?? pair.bodyA) || p.body === (pair.bodyB.parent ?? pair.bodyB));
      if (!proj || proj.stuck) return;
      if (b.role === "ball" && b.fighter && b.fighter.alive && b.fighter.team !== proj.team) {
        if (proj.kind === "nail") {
          // nails pierce: hit each fighter once, keep flying
          proj.hit = proj.hit ?? new Set();
          if (!proj.hit.has(b.fighter.id)) {
            proj.hit.add(b.fighter.id);
            this.dealDamage(proj.owner, b.fighter, proj.dmg, { proj: true, color: proj.color });
          }
          return;
        }
        this.dealDamage(proj.owner, b.fighter, proj.dmg, { proj: true, color: proj.color });
        if (proj.kind === "heart") {
          // small AoE burst
          for (const o of this.enemies(proj.owner)) {
            if (o !== b.fighter && Math.hypot(o.x - proj.body.position.x, o.y - proj.body.position.y) < 130)
              this.dealDamage(proj.owner, o, proj.dmg * 0.6, { proj: true, color: proj.color });
          }
          this.ring(proj.body.position.x, proj.body.position.y, 130, proj.color);
        }
        proj.life = 0;
      } else if (b.role === "wall") {
        if (proj.kind === "nail") {
          proj.stuck = true;
          Matter.Body.setStatic(proj.body, true);
          proj.life = 6;
        } else if (proj.kind !== "orb" && proj.kind !== "heart") {
          proj.life = 0;
        }
      }
    }
  }

  dealDamage(from: Fighter | null, to: Fighter, base: number, opt?: { proj?: boolean; color?: number; noLifesteal?: boolean }) {
    if (!to.alive || base <= 0) return;
    if (to.def.dodge?.(to, this)) {
      this.popups.push({
        x: to.x + this.rng.range(-14, 14), y: to.y - to.def.radius - 10,
        vy: -90, t: 0, life: 0.6, text: "MISS", color: 0xbdbdc4, crit: false,
      });
      const a = this.rng.range(0, Math.PI * 2);
      Matter.Body.setVelocity(to.body, { x: Math.cos(a) * to.def.speed * 1.6, y: Math.sin(a) * to.def.speed * 1.6 });
      return;
    }
    let dmg = base;
    if (from?.def.modDamage) dmg = from.def.modDamage(from, dmg, this);
    if (to.frozen > 0) dmg *= 1.4;
    if (to.shieldT > 0) dmg *= 0.25;
    dmg *= 1 + Math.max(0, this.time - 60) / 45; // sudden-death ramp
    dmg = Math.max(1, Math.round(dmg));
    to.hp -= dmg;
    to.flash = 0.12;
    const crit = from ? dmg >= from.st.damage * 1.8 : dmg >= 15;
    this.popups.push({
      x: to.x + this.rng.range(-14, 14), y: to.y - to.def.radius - 10,
      vy: -110, t: 0, life: 0.75, text: String(dmg),
      color: opt?.color ?? (from ? from.def.color : 0xffffff), crit,
    });
    this.burst(to.x, to.y, crit ? 14 : 7, opt?.color ?? to.def.color, crit ? 320 : 200);
    this.shake = Math.min(22, this.shake + (crit ? 8 : 3));
    if (crit) this.hitstop = Math.max(this.hitstop, 0.05);
    Sound.hit(crit);

    // meters
    from?.gainMeter(dmg * from.def.ult.gainDealt);
    to.gainMeter(dmg * to.def.ult.gainTaken);

    from?.def.onDealHit?.(from, to, this, dmg);
    to.def.onTakeHit?.(to, from, this, dmg);

    if (to.hp <= 0) this.kill(to);
  }

  heal(f: Fighter, amount: number, opt?: { overheal?: boolean }) {
    if (!f.alive || amount <= 0) return;
    f.hp = f.hp + amount;
    if (opt?.overheal) f.maxhp = Math.max(f.maxhp, f.hp); // lifesteal can push past max (Shredder hit 331 in his videos)
    else f.hp = Math.min(f.maxhp, f.hp);
    this.rings.push({ x: f.x, y: f.y, r: f.def.radius, max: f.def.radius + 30, w: 5, color: 0x5ed65e, t: 0, life: 0.35 });
  }

  kill(f: Fighter) {
    f.alive = false;
    f.hp = 0;
    this.burst(f.x, f.y, 40, f.def.color, 480);
    this.burst(f.x, f.y, 20, 0xffffff, 300);
    this.ring(f.x, f.y, 180, f.def.color);
    this.shake = 26;
    Sound.death();
    Matter.World.remove(this.world, f.body);
    if (f.weapon) { Matter.World.remove(this.world, f.weapon); Matter.World.remove(this.world, f.pin!); }

    // clones die with their original (and vice versa cleanup)
    if (!f.isClone) {
      for (const c of this.fighters) {
        if (c.isClone && c.alive && c.def.id === f.def.id && c.team === f.team) this.kill(c);
      }
    }

    const teams = this.aliveTeams();
    if (teams.length <= 1 && (this.phase === "fight")) {
      this.winners = this.aliveFighters().filter(x => !x.isClone);
      this.setPhase("ko");
      this.slowmo = 1.2;
      this.events.push({ type: "winner", names: this.winners.map(w => w.def.name), team: teams[0] ?? null });
    } else {
      this.slowmo = Math.max(this.slowmo, 0.3);
    }
  }

  // ---------- spawn helpers for characters ----------

  spawnProjectile(owner: Fighter, kind: Projectile["kind"], x: number, y: number, angle: number,
    opt: { speed: number; dmg: number; r?: number; w?: number; l?: number; color: number; life?: number; turn?: number }) {
    let body: Matter.Body;
    const common: Matter.IBodyDefinition = {
      restitution: kind === "orb" || kind === "heart" ? 1 : 0.2,
      friction: 0, frictionAir: 0, frictionStatic: 0, density: 0.0008,
      collisionFilter: { group: owner.group, category: CAT_PROJ, mask: CAT_BALL | CAT_WALL },
    };
    if (kind === "nail" || kind === "gateblade") {
      const half = (opt.l ?? 120) / 2;
      if (kind === "nail") common.collisionFilter = { group: owner.group, category: CAT_PROJ, mask: CAT_BALL };
      body = Matter.Bodies.rectangle(x + Math.cos(angle) * half * 0.5, y + Math.sin(angle) * half * 0.5, opt.l ?? 120, opt.w ?? 10, { ...common, angle });
    } else {
      body = Matter.Bodies.circle(x, y, opt.r ?? 9, common);
    }
    Matter.Body.setVelocity(body, { x: Math.cos(angle) * opt.speed, y: Math.sin(angle) * opt.speed });
    (body.plugin as BodyTag) = { role: "proj" };
    Matter.World.add(this.world, body);
    this.projectiles.push({
      body, kind, team: owner.team, owner, dmg: opt.dmg, color: opt.color,
      life: opt.life ?? 3, turn: opt.turn, speed: opt.speed, len: opt.l,
    });
  }

  spawnGate(owner: Fighter, dmg: number) {
    const m = 90;
    const x = this.rng.range(ARENA_X + m, ARENA_X + ARENA_SIZE - m);
    const y = this.rng.range(ARENA_Y + m, ARENA_Y + ARENA_SIZE - m);
    const target = this.nearestEnemy(owner);
    const angle = target ? Math.atan2(target.y - y, target.x - x) : this.rng.range(0, Math.PI * 2);
    this.gates.push({ x, y, angle, t: 0, fireAt: 0.55, life: 1.0, color: owner.def.color, owner, dmg });
  }

  spawnClone(of: Fighter) {
    const a = this.rng.range(0, Math.PI * 2);
    const f = new Fighter(of.def, of.team,
      Math.min(Math.max(of.x + Math.cos(a) * 90, ARENA_X + 60), ARENA_X + ARENA_SIZE - 60),
      Math.min(Math.max(of.y + Math.sin(a) * 90, ARENA_Y + 60), ARENA_Y + ARENA_SIZE - 60),
      a, { clone: true });
    f.st.damage = of.st.damage * 0.5;
    this.addFighter(f);
    this.burst(f.x, f.y, 16, of.def.color, 260);
  }

  freezePulse(src: Fighter, radius: number, dur: number) {
    this.ring(src.x, src.y, radius, src.def.color);
    for (const o of this.enemies(src)) {
      if (Math.hypot(o.x - src.x, o.y - src.y) <= radius + o.def.radius) {
        o.frozen = Math.max(o.frozen, dur);
        this.burst(o.x, o.y, 10, src.def.color, 140);
      }
    }
    Sound.freeze();
  }

  /** Instant beam: visual + damage to enemies intersecting the line. */
  fireBeam(owner: Fighter, x: number, y: number, angle: number, length: number, width: number, dmg: number, color: number) {
    this.beams.push({ x, y, angle, length, width, color, t: 0, life: 0.4 });
    const dx = Math.cos(angle), dy = Math.sin(angle);
    for (const o of this.enemies(owner)) {
      // distance from point to segment
      const px = o.x - x, py = o.y - y;
      const t = Math.max(0, Math.min(length, px * dx + py * dy));
      const d = Math.hypot(px - dx * t, py - dy * t);
      if (d <= width / 2 + o.def.radius) this.dealDamage(owner, o, dmg, { color });
    }
    this.shake = Math.min(26, this.shake + 12);
  }

  calloutUlt(f: Fighter) {
    this.callouts.push({ text: f.def.ult.name, color: f.def.color, t: 0, life: 1.4 });
    this.events.push({ type: "ult", fighter: f.def.name, ultName: f.def.ult.name });
    this.hitstop = Math.max(this.hitstop, 0.12);
    Sound.ult();
  }

  burst(x: number, y: number, n: number, color: number, spd: number) {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2), s = this.rng.range(spd * 0.3, spd);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        t: 0, life: this.rng.range(0.25, 0.55), size: this.rng.range(2, 6), color,
      });
    }
  }

  ring(x: number, y: number, max: number, color: number) {
    this.rings.push({ x, y, r: 8, max, w: 6, color, t: 0, life: 0.4 });
  }

  // ---------- main loop ----------

  private setPhase(p: MatchPhase) {
    this.phase = p;
    this.phaseT = 0;
    this.events.push({ type: "phase", phase: p });
  }

  get timescale(): number {
    if (this.hitstop > 0) return 0.05;
    if (this.slowmo > 0) return 0.25;
    return 1;
  }

  /** Advance by real seconds; internally fixed-steps the physics. */
  update(dtReal: number) {
    this.phaseT += dtReal;
    this.hitstop = Math.max(0, this.hitstop - dtReal);
    this.slowmo = Math.max(0, this.slowmo - dtReal);

    if (this.phase === "intro") {
      this.updateFx(dtReal);
      if (this.phaseT >= 1.5) this.setPhase("fight");
      return;
    }
    if (this.phase === "winner") {
      this.updateFx(dtReal);
      // confetti
      if (this.phaseT < 1.5 && this.rng.next() < 0.5) {
        this.particles.push({
          x: this.rng.range(ARENA_X, ARENA_X + ARENA_SIZE), y: ARENA_Y + 10,
          vx: this.rng.range(-60, 60), vy: this.rng.range(150, 380),
          t: 0, life: this.rng.range(0.9, 1.7), size: this.rng.range(3, 7),
          color: [0xffd94d, 0xff5c4d, 0x4da6ff, 0x9dff57, 0xc77dff][Math.floor(this.rng.next() * 5)],
        });
      }
      return;
    }
    if (this.phase === "ko" && this.phaseT >= 1.25) {
      this.setPhase("winner");
      Sound.win();
      return;
    }

    this.acc = Math.min(this.acc + dtReal * this.timescale, 0.08);
    while (this.acc >= STEP) {
      this.step(STEP);
      this.acc -= STEP;
    }
    this.updateFx(dtReal);
  }

  private step(dt: number) {
    this.time += dt;

    for (const [k, v] of this.clashCd) { if (v - dt <= 0) this.clashCd.delete(k); else this.clashCd.set(k, v - dt); }
    for (const [k, v] of this.bodyCd) { if (v - dt <= 0) this.bodyCd.delete(k); else this.bodyCd.set(k, v - dt); }

    for (const f of this.aliveFighters()) {
      f.flash = Math.max(0, f.flash - dt);
      f.ultT = Math.max(0, f.ultT - dt);
      f.shieldT = Math.max(0, f.shieldT - dt);
      for (const [k, v] of f.hitCooldowns) {
        if (v - dt <= 0) f.hitCooldowns.delete(k); else f.hitCooldowns.set(k, v - dt);
      }

      if (f.frozen > 0) {
        f.frozen -= dt;
        Matter.Body.setVelocity(f.body, { x: f.body.velocity.x * 0.85, y: f.body.velocity.y * 0.85 });
        f.driveWeapon(dt, 0);
        continue;
      }

      f.def.update?.(f, this, dt);

      // steer speed back to cruise (unless a char opted out via st.noSteer)
      if (!f.st.noSteer) {
        const v = f.body.velocity;
        const sp = Math.hypot(v.x, v.y) || 0.01;
        const target = f.def.speed * (f.st.speedMult ?? 1);
        const ns = sp + (target - sp) * Math.min(1, dt * 2.2);
        Matter.Body.setVelocity(f.body, { x: (v.x / sp) * ns, y: (v.y / sp) * ns });
      }

      // drive weapon
      if (f.def.weapon.kind === "gun") {
        const t = this.nearestEnemy(f);
        if (t) f.aimWeapon(t.x, t.y, dt);
      } else {
        f.driveWeapon(dt, f.def.spin * (f.st.spinMult ?? 1));
      }

      // ult fires automatically at full meter
      if (f.meter >= METER_MAX && !f.isClone) {
        f.meter = 0;
        this.calloutUlt(f);
        f.def.ult.fire(f, this);
      }

      // ghost trail bookkeeping
      if (f.weapon) {
        f.ghosts.push({ x: f.weapon.position.x, y: f.weapon.position.y, angle: f.weapon.angle });
        if (f.ghosts.length > 7) f.ghosts.shift();
      }
    }

    // projectiles
    for (const p of this.projectiles) {
      p.life -= dt;
      if (p.stuck) continue;
      if (p.kind === "nail") {
        const { x, y } = p.body.position;
        if (x < ARENA_X + 10 || x > ARENA_X + ARENA_SIZE - 10 || y < ARENA_Y + 10 || y > ARENA_Y + ARENA_SIZE - 10) {
          p.stuck = true;
          Matter.Body.setStatic(p.body, true);
          p.life = 5;
          continue;
        }
      }
      if ((p.kind === "orb" || p.kind === "heart") && p.turn && p.speed) {
        const t = this.nearestEnemy(p.owner);
        if (t) {
          const want = Math.atan2(t.y - p.body.position.y, t.x - p.body.position.x);
          const cur = Math.atan2(p.body.velocity.y, p.body.velocity.x);
          let diff = want - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const na = cur + Math.max(-p.turn * dt, Math.min(p.turn * dt, diff));
          Matter.Body.setVelocity(p.body, { x: Math.cos(na) * p.speed, y: Math.sin(na) * p.speed });
        }
      }
    }
    for (const p of this.projectiles.filter(p => p.life <= 0)) Matter.World.remove(this.world, p.body);
    this.projectiles = this.projectiles.filter(p => p.life > 0);

    // gates
    for (const g of this.gates) {
      g.t += dt;
      if (g.t >= g.fireAt && g.fireAt > 0) {
        const target = this.nearestEnemy(g.owner);
        if (target) g.angle = this.aimLead(g.x, g.y, target, 980);
        this.spawnProjectile(g.owner, "gateblade", g.x, g.y, g.angle,
          { speed: 980, dmg: g.dmg, l: 110, w: 14, color: g.color, life: 2.5 });
        Sound.pew();
        g.fireAt = 0;
      }
    }
    this.gates = this.gates.filter(g => g.t < g.life);

    Matter.Engine.update(this.physics, dt * 1000);

    // hard-clamp balls inside the arena (fast bodies can tunnel walls)
    for (const f of this.aliveFighters()) {
      const r = f.def.radius;
      const p = f.body.position, v = f.body.velocity;
      let nx = p.x, ny = p.y, nvx = v.x, nvy = v.y, hit = false;
      if (p.x < ARENA_X + r) { nx = ARENA_X + r; nvx = Math.abs(v.x); hit = true; }
      if (p.x > ARENA_X + ARENA_SIZE - r) { nx = ARENA_X + ARENA_SIZE - r; nvx = -Math.abs(v.x); hit = true; }
      if (p.y < ARENA_Y + r) { ny = ARENA_Y + r; nvy = Math.abs(v.y); hit = true; }
      if (p.y > ARENA_Y + ARENA_SIZE - r) { ny = ARENA_Y + ARENA_SIZE - r; nvy = -Math.abs(v.y); hit = true; }
      if (hit) {
        Matter.Body.setPosition(f.body, { x: nx, y: ny });
        Matter.Body.setVelocity(f.body, { x: nvx, y: nvy });
      }
    }

    // stalemate guard: after 3 minutes highest HP wins
    if (this.time > 180 && this.phase === "fight") {
      const alive = this.aliveFighters().filter(f => !f.isClone).sort((a, b) => b.hp - a.hp);
      for (let i = 1; i < alive.length; i++) this.kill(alive[i]);
    }
  }

  private updateFx(dt: number) {
    for (const p of this.particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 3 * dt;
      p.vy *= 1 - 3 * dt;
    }
    this.particles = this.particles.filter(p => p.t < p.life);
    for (const p of this.popups) { p.t += dt; p.y += p.vy * dt; p.vy *= 1 - 2.5 * dt; }
    this.popups = this.popups.filter(p => p.t < p.life);
    for (const r of this.rings) { r.t += dt; r.r += (r.max - r.r) * Math.min(1, dt * 14); }
    this.rings = this.rings.filter(r => r.t < r.life);
    for (const b of this.beams) b.t += dt;
    this.beams = this.beams.filter(b => b.t < b.life);
    for (const c of this.callouts) c.t += dt;
    this.callouts = this.callouts.filter(c => c.t < c.life);
    this.shake = Math.max(0, this.shake - dt * 55);
    this.stasisT = Math.max(0, this.stasisT - dt);
  }

  destroy() {
    Matter.Engine.clear(this.physics);
  }
}
