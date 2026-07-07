import Matter from "matter-js";
import { Fighter, tagOf, CAT_PROJ, CAT_WALL, CAT_BALL } from "./fighter";
import type { BodyTag } from "./fighter";
import { ARENA_SIZE, ARENA_X, ARENA_Y, METER_MAX, STEP, VEL } from "./constants";
import { Rng } from "./rng";
import { Sound } from "./audio";
import { steer } from "./movement";
import { capsuleHitsCircle } from "./geometry";
import { Fx } from "./effects";
import { COMBAT } from "./tuning";
import { getChar } from "./characters";
import type { EngineEvent, LineupEntry, MatchPhase } from "./types";

/** Circle (x,y,r) vs a fighter's ball. */
function within(x: number, y: number, r: number, o: Fighter): boolean {
  const dx = o.x - x, dy = o.y - y, rr = r + o.def.radius;
  return dx * dx + dy * dy <= rr * rr;
}

export interface Projectile {
  body: Matter.Body;
  kind: "bullet" | "orb" | "heart" | "nail" | "gateblade" | "dagger";
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
  /** rect length for nail/gateblade/dagger rendering. */
  len?: number;
  /** WORLD STASIS: dagger hangs frozen until the time-stop ends, then flies. */
  held?: boolean;
  lockAngle?: number;
  lockSpeed?: number;
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
  fx: Fx;
  time = 0;
  /** WORLD STASIS time-stop overlay timer. */
  stasisT = 0;
  /** Who cast the running WORLD STASIS (rendered as a ghost outline). */
  stasisCaster: Fighter | null = null;
  /** Progressive dagger-throw animation that runs DURING the time-stop. */
  private stasisCast: { owner: Fighter; count: number; thrown: number; interval: number; timer: number } | null = null;
  /** Scheduled one-shot actions (sim-time; naturally pause during a time-stop). */
  private actions: { t: number; fn: () => void }[] = [];
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
    this.fx = new Fx(this.rng);
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

    // Weapons are sensors that can rest inside an enemy while the balls are
    // mashed together, so collisionStart alone barely fires. collisionActive
    // fires every tick for ongoing overlaps; the per-hit cooldowns gate the
    // actual damage rate. Projectiles are handled on start only.
    Matter.Events.on(this.physics, "collisionStart", (ev) => this.onCollisions(ev, true));
    Matter.Events.on(this.physics, "collisionActive", (ev) => this.onCollisions(ev, false));
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

  // FX access for the renderer (state lives in this.fx).
  get particles() { return this.fx.particles; }
  get rings() { return this.fx.rings; }
  get popups() { return this.fx.popups; }
  get beams() { return this.fx.beams; }
  get callouts() { return this.fx.callouts; }
  get shake() { return this.fx.shake; }
  set shake(v: number) { this.fx.shake = v; }

  // Thin spawn delegates so characters keep calling e.burst / e.ring.
  burst(x: number, y: number, n: number, color: number, spd: number) { this.fx.burst(x, y, n, color, spd); }
  ring(x: number, y: number, max: number, color: number) { this.fx.ring(x, y, max, color); }

  /** Angle from (x,y) that leads a moving target for a projectile of given speed. */
  aimLead(x: number, y: number, target: Fighter, projSpeed: number): number {
    const d = Math.hypot(target.x - x, target.y - y);
    const t = d / projSpeed;
    const px = target.x + target.body.velocity.x * 60 * t * 0.5;
    const py = target.y + target.body.velocity.y * 60 * t * 0.5;
    return Math.atan2(py - y, px - x);
  }

  // ---------- combat ----------

  /**
   * Reliable melee: hit-test each fighter's weapon as a capsule (or circles for
   * saws/orbitals) against enemy balls, gated by the per-weapon hit cooldown.
   * Uses the weapon body's live position/angle so it matches the rendered blade,
   * but does its own geometry so fast spins never tunnel.
   */
  private meleeStep() {
    for (const f of this.aliveFighters()) {
      const w = f.def.weapon;
      if (!f.weapon || w.kind === "gun" || w.kind === "none") continue;
      const key = `${f.id}:w`;
      const dmg = f.st.damage;
      const wa = f.weapon.angle;
      const ca = Math.cos(wa), sa = Math.sin(wa);

      // Build the weapon's world-space colliders.
      let hit: (o: Fighter) => boolean;
      if (w.kind === "saw") {
        hit = (o) => within(f.weapon!.position.x, f.weapon!.position.y, w.radius, o);
      } else if (w.kind === "orbitals") {
        const parts = f.weapon.parts.length > 1 ? f.weapon.parts.slice(1) : [f.weapon];
        hit = (o) => parts.some((p) => within(p.position.x, p.position.y, w.radius, o));
      } else {
        // blade or staff: a capsule along the weapon's long axis
        const half = (w.length / 2) * (f.st.wsize ?? 1);
        const cx = f.weapon.position.x, cy = f.weapon.position.y, r = w.width / 2 + 2;
        const ax = cx - ca * half, ay = cy - sa * half;
        const bx = cx + ca * half, by = cy + sa * half;
        hit = (o) => capsuleHitsCircle(ax, ay, bx, by, r, o.x, o.y, o.def.radius);
      }

      for (const o of this.enemies(f)) {
        if (o.hitCooldowns.has(key)) continue;
        if (hit(o)) {
          o.hitCooldowns.set(key, COMBAT.hitCooldown);
          this.dealDamage(f, o, dmg);
          if (!o.alive) break;
        }
      }
    }
  }

  private onCollisions(ev: Matter.IEventCollision<Matter.Engine>, isStart: boolean) {
    if (this.phase !== "fight" && this.phase !== "ko") return;
    for (const pair of ev.pairs) {
      const a = tagOf(pair.bodyA), b = tagOf(pair.bodyB);
      if (!a || !b) continue;
      this.handlePair(a, b, pair, isStart);
      this.handlePair(b, a, pair, isStart);
    }
  }

  private contactPoint(pair: Matter.Pair): { x: number; y: number } {
    const c = (pair as any).contacts?.[0]?.vertex ?? (pair as any).collision?.supports?.[0];
    if (c) return { x: c.x, y: c.y };
    return { x: (pair.bodyA.position.x + pair.bodyB.position.x) / 2, y: (pair.bodyA.position.y + pair.bodyB.position.y) / 2 };
  }

  private handlePair(a: BodyTag, b: BodyTag, pair: Matter.Pair, isStart: boolean) {
    // NB: weapon→ball damage is NOT resolved here. A fast-spinning thin weapon
    // sensor tunnels through Matter's discrete detector, so melee is hit-tested
    // manually with capsule geometry in meleeStep(). This branch only handles
    // cosmetic weapon clashes, ball-ram contact damage, and projectile hits.

    // weapon vs weapon clank
    if (a.role === "weapon" && b.role === "weapon" && a.fighter && b.fighter
      && a.fighter.team !== b.fighter.team && a.fighter.alive && b.fighter.alive) {
      const key = `${Math.min(a.fighter.id, b.fighter.id)}x${Math.max(a.fighter.id, b.fighter.id)}`;
      if (!this.clashCd.has(key)) {
        this.clashCd.set(key, COMBAT.clashCooldown);
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
          this.bodyCd.set(key, COMBAT.bodyCooldown);
          this.dealDamage(a.fighter, b.fighter, contact);
        }
      }
    }
    // projectile hits — resolve once, on first contact only
    if (a.role === "proj" && isStart) {
      const proj = this.projectiles.find(p => p.body === (pair.bodyA.parent ?? pair.bodyA) || p.body === (pair.bodyB.parent ?? pair.bodyB));
      // Held daggers are inert while frozen in the time-stop — no hits, no dying.
      if (!proj || proj.stuck || proj.held) return;
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
      this.fx.popup(to.x + this.rng.range(-14, 14), to.y - to.def.radius - 10, "MISS", 0xbdbdc4, false);
      const a = this.rng.range(0, Math.PI * 2);
      Matter.Body.setVelocity(to.body, { x: Math.cos(a) * to.def.speed * 1.6 * VEL, y: Math.sin(a) * to.def.speed * 1.6 * VEL });
      return;
    }
    let dmg = base;
    if (from?.def.modDamage) dmg = from.def.modDamage(from, dmg, this);
    if (to.frozen > 0) dmg *= 1.4;
    if (to.shieldT > 0) dmg *= 0.25;
    dmg *= 1 + Math.max(0, this.time - COMBAT.suddenDeathAfter) / COMBAT.suddenDeathOver;
    dmg = Math.max(1, Math.round(dmg));
    to.hp -= dmg;
    to.flash = 0.12;
    // Melee knocks the target back (brawl feel + bounce); projectiles do NOT —
    // otherwise ranged fighters kite-lock melee by shoving them away every shot.
    if (from && !opt?.proj) {
      const ka = Math.atan2(to.y - from.y, to.x - from.x);
      const k = Math.min(COMBAT.knockCap, COMBAT.knockBase + dmg * COMBAT.knockPerDmg) * VEL / Math.max(0.6, to.def.massMult ?? 1);
      Matter.Body.setVelocity(to.body, {
        x: to.body.velocity.x + Math.cos(ka) * k,
        y: to.body.velocity.y + Math.sin(ka) * k,
      });
    }
    const crit = from ? dmg >= from.st.damage * 1.8 : dmg >= 15;
    this.fx.popup(to.x + this.rng.range(-14, 14), to.y - to.def.radius - 10, String(dmg),
      opt?.color ?? (from ? from.def.color : 0xffffff), crit);
    this.burst(to.x, to.y, crit ? 14 : 7, opt?.color ?? to.def.color, crit ? 320 : 200);
    this.fx.addShake(crit ? 8 : 3);
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
    this.fx.ring(f.x, f.y, f.def.radius + 30, 0x5ed65e, 5);
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
    opt: { speed: number; dmg: number; r?: number; w?: number; l?: number; color: number; life?: number; turn?: number; held?: boolean }) {
    let body: Matter.Body;
    const common: Matter.IBodyDefinition = {
      restitution: kind === "orb" || kind === "heart" ? 1 : 0.2,
      friction: 0, frictionAir: 0, frictionStatic: 0, density: 0.0008,
      collisionFilter: { group: owner.group, category: CAT_PROJ, mask: CAT_BALL | CAT_WALL },
    };
    if (kind === "nail" || kind === "gateblade" || kind === "dagger") {
      const half = (opt.l ?? 120) / 2;
      if (kind === "nail") common.collisionFilter = { group: owner.group, category: CAT_PROJ, mask: CAT_BALL };
      body = Matter.Bodies.rectangle(x + Math.cos(angle) * half * 0.5, y + Math.sin(angle) * half * 0.5, opt.l ?? 120, opt.w ?? 10, { ...common, angle });
    } else {
      body = Matter.Bodies.circle(x, y, opt.r ?? 9, common);
    }
    // Held daggers hang motionless in the time-stop until released.
    if (opt.held) Matter.Body.setVelocity(body, { x: 0, y: 0 });
    else Matter.Body.setVelocity(body, { x: Math.cos(angle) * opt.speed * VEL, y: Math.sin(angle) * opt.speed * VEL });
    (body.plugin as BodyTag) = { role: "proj" };
    Matter.World.add(this.world, body);
    this.projectiles.push({
      body, kind, team: owner.team, owner, dmg: opt.dmg, color: opt.color,
      life: opt.life ?? 3, turn: opt.turn, speed: opt.speed, len: opt.l,
      held: opt.held, lockAngle: angle, lockSpeed: opt.speed,
    });
  }

  /** Run fn after `delay` sim-seconds (pauses during a time-stop). */
  schedule(delay: number, fn: () => void) {
    this.actions.push({ t: this.time + delay, fn });
  }

  /**
   * Freeze the entire arena for `dur` seconds (Stasis's WORLD STASIS).
   * While frozen, the caster throws `count` daggers one by one — they hang
   * in the air, each locked onto the opponent's position at the moment it
   * was thrown, and all launch together when time resumes.
   */
  beginStasis(dur: number, owner: Fighter, count: number) {
    this.stasisT = Math.max(this.stasisT, dur);
    this.stasisCaster = owner;
    this.stasisCast = {
      owner, count, thrown: 0,
      interval: Math.min(0.16, (dur * 0.7) / Math.max(1, count)),
      timer: 0.25, // beat before the first dagger appears
    };
  }

  /** Advance the dagger-throw animation inside the time-stop. */
  private stepStasisCast(dtReal: number) {
    const c = this.stasisCast;
    if (!c || !c.owner.alive) return;
    c.timer -= dtReal;
    if (c.timer <= 0 && c.thrown < c.count) {
      c.timer = c.interval;
      c.thrown++;
      const f = c.owner;
      const target = this.nearestEnemy(f);
      // daggers materialize scattered around Stasis...
      const around = this.rng.range(0, Math.PI * 2);
      const ring = f.def.radius + this.rng.range(40, 150);
      const sx = f.x + Math.cos(around) * ring;
      const sy = f.y + Math.sin(around) * ring;
      // ...each locked onto the opponent's (frozen) position right now
      const aim = target ? Math.atan2(target.y - sy, target.x - sx) : around;
      this.spawnProjectile(f, "dagger", sx, sy, aim,
        { speed: 950, dmg: f.st.damage * 1.5, l: 52, w: 13, color: 0xcdeefc, life: 3.5, held: true });
      this.burst(sx, sy, 4, 0xdff4ff, 120);
      Sound.clash();
    }
  }

  /** Release every held dagger along its locked direction when the time-stop ends. */
  private releaseHeld() {
    let any = false;
    for (const p of this.projectiles) {
      if (!p.held) continue;
      p.held = false;
      any = true;
      const a = p.lockAngle ?? 0, s = p.lockSpeed ?? 700;
      Matter.Body.setVelocity(p.body, { x: Math.cos(a) * s * VEL, y: Math.sin(a) * s * VEL });
    }
    this.stasisCaster = null;
    this.stasisCast = null;
    if (any) { Sound.dash(); this.shake = 16; }
  }

  spawnGate(owner: Fighter, dmg: number) {
    const m = 90;
    this.spawnGateAt(owner,
      this.rng.range(ARENA_X + m, ARENA_X + ARENA_SIZE - m),
      this.rng.range(ARENA_Y + m, ARENA_Y + ARENA_SIZE - m), dmg);
  }

  /** Open a summoning gate at an exact position (Tyrant's tiled ult rows). */
  spawnGateAt(owner: Fighter, x: number, y: number, dmg: number) {
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


  /** Instant beam: visual + damage to enemies intersecting the line. */
  fireBeam(owner: Fighter, x: number, y: number, angle: number, length: number, width: number, dmg: number, color: number) {
    this.fx.beam(x, y, angle, length, width, color);
    const dx = Math.cos(angle), dy = Math.sin(angle);
    for (const o of this.enemies(owner)) {
      // distance from point to segment
      const px = o.x - x, py = o.y - y;
      const t = Math.max(0, Math.min(length, px * dx + py * dy));
      const d = Math.hypot(px - dx * t, py - dy * t);
      if (d <= width / 2 + o.def.radius) this.dealDamage(owner, o, dmg, { color });
    }
    this.fx.addShake(12);
  }

  calloutUlt(f: Fighter) {
    this.fx.callout(f.def.ult.name, f.def.color);
    this.events.push({ type: "ult", fighter: f.def.name, ultName: f.def.ult.name });
    this.hitstop = Math.max(this.hitstop, 0.12);
    Sound.ult();
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
      this.fx.update(dtReal);
      if (this.phaseT >= 1.5) this.setPhase("fight");
      return;
    }
    if (this.phase === "winner") {
      this.fx.update(dtReal);
      // confetti
      if (this.phaseT < 1.5 && this.rng.next() < 0.5) {
        this.fx.particles.push({
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

    // WORLD STASIS: time is fully stopped. The whole arena freezes — fighters,
    // projectiles, everything — while Stasis's daggers hang in the air. When the
    // pause elapses, the held daggers launch along their locked directions.
    if (this.stasisT > 0) {
      this.stasisT -= dtReal;
      this.stepStasisCast(dtReal);
      if (this.stasisT <= 0) { this.stasisT = 0; this.releaseHeld(); }
      this.fx.update(dtReal);
      return;
    }

    this.acc = Math.min(this.acc + dtReal * this.timescale, 0.08);
    while (this.acc >= STEP) {
      this.step(STEP);
      this.acc -= STEP;
    }
    this.fx.update(dtReal);
  }

  private step(dt: number) {
    this.time += dt;

    if (this.actions.length) {
      const due = this.actions.filter(a => a.t <= this.time);
      this.actions = this.actions.filter(a => a.t > this.time);
      for (const a of due) a.fn();
    }

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

      steer(f, this.nearestEnemy(f), this.time, dt);

      // drive weapon
      if (f.def.weapon.kind === "gun") {
        const t = this.nearestEnemy(f);
        if (t) f.aimWeapon(t.x, t.y);
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

    this.meleeStep();

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
          Matter.Body.setVelocity(p.body, { x: Math.cos(na) * p.speed * VEL, y: Math.sin(na) * p.speed * VEL });
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

  destroy() {
    Matter.Engine.clear(this.physics);
  }
}
