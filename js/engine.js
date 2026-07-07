// Custom fight engine: circle physics, orbiting weapon colliders,
// projectiles, and juicy FX (particles, hitstop, shake, damage numbers).
"use strict";

const ARENA = { x: 14, y: 148, w: 540 - 28, h: 960 - 148 - 18 };
const TEAM_HUES = ["#4da6ff", "#ff5c4d", "#9dff57", "#ffd94d", "#c77dff", "#7de8ff", "#ffb84d", "#b0b6c4"];

let BALL_SEQ = 0;

class Ball {
  constructor(char, team, x, y) {
    this.id = ++BALL_SEQ;
    this.char = char;
    this.team = team;
    this.name = char.name;
    this.icon = char.icon;
    this.color = char.color;
    this.x = x; this.y = y;
    const a = rand(0, TAU);
    this.vx = Math.cos(a) * char.speed;
    this.vy = Math.sin(a) * char.speed;
    this.r = char.radius;
    this.mass = (char.massMult ?? 1) * char.radius * char.radius / 650;
    this.hp = char.hp;
    this.maxhp = char.hp;
    this.wa = rand(0, TAU);        // weapon angle
    this.alive = true;
    this.frozen = 0;
    this.flash = 0;
    this.contactDmg = 0;
    this.aura = null;
    this.iframes = new Map();      // per attacker+weapon hit cooldowns
    this.trail = [];
    this.trailMax = 0;
    char.init(this);
  }
}

class World {
  // lineup: [{charId, team}]
  constructor(lineup) {
    this.balls = [];
    this.projectiles = [];
    this.particles = [];
    this.dmgNums = [];
    this.rings = [];
    this.shake = 0;
    this.time = 0;
    this.events = [];              // consumed by main loop (deaths, big hits)
    this.clashCd = new Map();
    this.bodyCd = new Map();

    const n = lineup.length;
    lineup.forEach((f, i) => {
      // Spread fighters in a ring around the arena center.
      const cx = ARENA.x + ARENA.w / 2, cy = ARENA.y + ARENA.h / 2;
      const a = -Math.PI / 2 + (i * TAU) / n;
      const rx = ARENA.w * 0.32, ry = ARENA.h * 0.34;
      const b = new Ball(ROSTER_BY_ID[f.charId], f.team,
        cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
      this.balls.push(b);
    });
  }

  alivBalls() { return this.balls.filter(b => b.alive); }

  aliveTeams() {
    return [...new Set(this.alivBalls().map(b => b.team))];
  }

  nearestEnemy(ball) {
    let best = null, bd = Infinity;
    for (const o of this.balls) {
      if (!o.alive || o.team === ball.team) continue;
      const d = dist(ball.x, ball.y, o.x, o.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  spawnBullet(owner, x, y, angle, opt) {
    this.projectiles.push({
      kind: "bullet", owner, team: owner.team, x, y,
      vx: Math.cos(angle) * opt.speed, vy: Math.sin(angle) * opt.speed,
      r: opt.r, dmg: opt.dmg, color: opt.color, life: 3,
    });
  }

  spawnOrb(owner, x, y, angle, opt) {
    this.projectiles.push({
      kind: "orb", owner, team: owner.team, x, y,
      vx: Math.cos(angle) * opt.speed, vy: Math.sin(angle) * opt.speed,
      speed: opt.speed, turn: opt.turn,
      r: opt.r, dmg: opt.dmg, color: opt.color, life: opt.life,
    });
  }

  freezePulse(src, radius, dur) {
    this.rings.push({ x: src.x, y: src.y, r: 10, max: radius, w: 6, color: src.color, life: 0.5, t: 0 });
    for (const o of this.balls) {
      if (!o.alive || o.team === src.team) continue;
      if (dist(src.x, src.y, o.x, o.y) <= radius + o.r) {
        o.frozen = Math.max(o.frozen, dur);
        this.burst(o.x, o.y, 10, src.color, 120);
      }
    }
  }

  burst(x, y, n, color, spd) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(spd * 0.3, spd);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.25, 0.6), t: 0, size: rand(1.5, 4), color,
      });
    }
  }

  damage(victim, dmg, srcX, srcY, opt = {}) {
    if (!victim.alive) return;
    if (victim.frozen > 0) dmg *= 1.5;            // frozen targets shatter
    dmg *= 1 + Math.max(0, this.time - 45) / 45;  // sudden death ramp
    dmg = Math.round(dmg);
    victim.hp -= dmg;
    victim.flash = 0.1;
    const a = Math.atan2(victim.y - srcY, victim.x - srcX);
    const k = opt.knock ?? 220;
    victim.vx += Math.cos(a) * k / victim.mass * 0.6;
    victim.vy += Math.sin(a) * k / victim.mass * 0.6;
    const crit = dmg >= 12;
    this.dmgNums.push({
      x: victim.x + rand(-10, 10), y: victim.y - victim.r - 6,
      vy: -70, t: 0, life: 0.8, text: String(dmg),
      color: opt.color ?? "#ffffff", crit,
    });
    this.burst(victim.x, victim.y, crit ? 16 : 8, opt.color ?? victim.color, crit ? 260 : 160);
    this.shake = Math.min(16, this.shake + (crit ? 7 : 3));
    Sound.hit(crit);
    this.events.push({ type: "hit", dmg });
    if (victim.hp <= 0) this.kill(victim);
  }

  kill(victim) {
    victim.alive = false;
    victim.hp = 0;
    this.burst(victim.x, victim.y, 46, victim.color, 420);
    this.burst(victim.x, victim.y, 24, "#ffffff", 260);
    this.rings.push({ x: victim.x, y: victim.y, r: 6, max: 150, w: 8, color: victim.color, life: 0.45, t: 0 });
    this.shake = 22;
    Sound.death();
    this.events.push({ type: "death", ball: victim });
  }

  update(dt) {
    this.time += dt;
    const alive = this.alivBalls();

    // --- character logic + movement ---
    for (const b of alive) {
      b.flash = Math.max(0, b.flash - dt);
      b.aura = null;
      for (const [k, v] of b.iframes) {
        if (v - dt <= 0) b.iframes.delete(k); else b.iframes.set(k, v - dt);
      }
      if (b.frozen > 0) {
        b.frozen -= dt;
        continue; // frozen: no ability ticks, no movement
      }
      b.char.update(b, this, dt);

      // Gently steer speed back to the character's cruise speed.
      const dashing = b.st && b.st.dash > 0;
      const sp = Math.hypot(b.vx, b.vy) || 1;
      if (!dashing) {
        const target = b.char.speed;
        const ns = sp + (target - sp) * Math.min(1, dt * 2.2);
        b.vx *= ns / sp;
        b.vy *= ns / sp;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Arena walls.
      if (b.x - b.r < ARENA.x) { b.x = ARENA.x + b.r; b.vx = Math.abs(b.vx); }
      if (b.x + b.r > ARENA.x + ARENA.w) { b.x = ARENA.x + ARENA.w - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y - b.r < ARENA.y) { b.y = ARENA.y + b.r; b.vy = Math.abs(b.vy); }
      if (b.y + b.r > ARENA.y + ARENA.h) { b.y = ARENA.y + ARENA.h - b.r; b.vy = -Math.abs(b.vy); }

      if (b.trailMax) {
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > b.trailMax) b.trail.shift();
      }
    }

    // --- ball vs ball: elastic bounce + contact damage ---
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j];
        if (!a.alive || !b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001, min = a.r + b.r;
        if (d >= min) continue;
        const nx = dx / d, ny = dy / d;
        const overlap = min - d;
        const tm = a.mass + b.mass;
        a.x -= nx * overlap * (b.mass / tm);
        a.y -= ny * overlap * (b.mass / tm);
        b.x += nx * overlap * (a.mass / tm);
        b.y += ny * overlap * (a.mass / tm);
        const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          const imp = (-(1 + 0.98) * vn) / (1 / a.mass + 1 / b.mass);
          a.vx -= (imp / a.mass) * nx;
          a.vy -= (imp / a.mass) * ny;
          b.vx += (imp / b.mass) * nx;
          b.vy += (imp / b.mass) * ny;
        }
        if (a.team !== b.team) {
          const key = a.id + ">" + b.id;
          if (!this.bodyCd.has(key)) {
            let hitAny = false;
            if (a.contactDmg > 0) { this.damage(b, a.contactDmg, a.x, a.y, { color: a.color, knock: 320 }); hitAny = true; }
            if (b.contactDmg > 0 && a.alive) { this.damage(a, b.contactDmg, b.x, b.y, { color: b.color, knock: 320 }); hitAny = true; }
            if (hitAny) this.bodyCd.set(key, 0.5);
          }
        }
      }
    }
    for (const [k, v] of this.bodyCd) {
      if (v - dt <= 0) this.bodyCd.delete(k); else this.bodyCd.set(k, v - dt);
    }
    for (const [k, v] of this.clashCd) {
      if (v - dt <= 0) this.clashCd.delete(k); else this.clashCd.set(k, v - dt);
    }

    // --- weapons: hits and clashes ---
    const cols = alive.filter(b => b.alive).map(b => ({ b, list: b.char.colliders(b) }));
    for (let i = 0; i < cols.length; i++) {
      for (let j = 0; j < cols.length; j++) {
        if (i === j) continue;
        const A = cols[i], B = cols[j];
        if (A.b.team === B.b.team || !A.b.alive || !B.b.alive) continue;
        for (const col of A.list) {
          // weapon vs enemy body
          const ifKey = A.b.id + ":" + col.key;
          if (!B.b.iframes.has(ifKey) && colliderCircleHit(col, B.b.x, B.b.y, B.b.r)) {
            B.b.iframes.set(ifKey, 0.45);
            this.damage(B.b, col.dmg, A.b.x, A.b.y, { color: A.b.color, knock: col.knock });
            if (A.b.char.onDealDamage) A.b.char.onDealDamage(A.b);
            if (!B.b.alive) break;
          }
        }
      }
    }
    // weapon vs weapon clash (i<j so each pair once)
    for (let i = 0; i < cols.length; i++) {
      for (let j = i + 1; j < cols.length; j++) {
        const A = cols[i], B = cols[j];
        if (A.b.team === B.b.team || !A.b.alive || !B.b.alive) continue;
        const key = A.b.id + "x" + B.b.id;
        if (this.clashCd.has(key)) continue;
        outer:
        for (const ca of A.list) {
          if (!ca.parry) continue;
          for (const cb of B.list) {
            if (!cb.parry) continue;
            const p = colliderColliderHit(ca, cb);
            if (p) {
              this.clashCd.set(key, 0.3);
              this.burst(p.x, p.y, 12, "#fff3b0", 300);
              this.rings.push({ x: p.x, y: p.y, r: 2, max: 34, w: 3, color: "#fff3b0", life: 0.2, t: 0 });
              const a = Math.atan2(B.b.y - A.b.y, B.b.x - A.b.x);
              const k = 190;
              A.b.vx -= Math.cos(a) * k; A.b.vy -= Math.sin(a) * k;
              B.b.vx += Math.cos(a) * k; B.b.vy += Math.sin(a) * k;
              Sound.clash();
              break outer;
            }
          }
        }
      }
    }

    // --- projectiles ---
    for (const p of this.projectiles) {
      p.life -= dt;
      if (p.kind === "orb") {
        const t = this.nearestEnemy(p.owner);
        if (t) {
          const want = Math.atan2(t.y - p.y, t.x - p.x);
          let cur = Math.atan2(p.vy, p.vx);
          let diff = ((want - cur + Math.PI * 3) % TAU) - Math.PI;
          cur += clamp(diff, -p.turn * dt, p.turn * dt);
          p.vx = Math.cos(cur) * p.speed;
          p.vy = Math.sin(cur) * p.speed;
        }
        if (Math.random() < 0.5) {
          this.particles.push({ x: p.x, y: p.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.3, t: 0, size: 2.5, color: p.color });
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < ARENA.x || p.x > ARENA.x + ARENA.w || p.y < ARENA.y || p.y > ARENA.y + ARENA.h) {
        if (p.kind === "orb") { // orbs bounce off walls
          if (p.x < ARENA.x || p.x > ARENA.x + ARENA.w) p.vx *= -1;
          if (p.y < ARENA.y || p.y > ARENA.y + ARENA.h) p.vy *= -1;
          p.x = clamp(p.x, ARENA.x, ARENA.x + ARENA.w);
          p.y = clamp(p.y, ARENA.y, ARENA.y + ARENA.h);
        } else {
          p.life = 0;
        }
      }
      if (p.life <= 0) continue;

      // Blocked by enemy weapons.
      let blocked = false;
      for (const c of cols) {
        if (c.b.team === p.team || !c.b.alive) continue;
        for (const col of c.list) {
          if (col.parry && colliderCircleHit(col, p.x, p.y, p.r)) {
            this.burst(p.x, p.y, 8, p.color, 220);
            Sound.clash();
            blocked = true;
            break;
          }
        }
        if (blocked) break;
      }
      if (blocked) { p.life = 0; continue; }

      // Hit enemy body.
      for (const b of this.balls) {
        if (!b.alive || b.team === p.team) continue;
        if (circleHit(p.x, p.y, p.r, b.x, b.y, b.r)) {
          if (p.kind === "orb") {
            // AoE burst
            this.rings.push({ x: p.x, y: p.y, r: 4, max: 70, w: 5, color: p.color, life: 0.3, t: 0 });
            for (const o of this.balls) {
              if (!o.alive || o.team === p.team) continue;
              if (dist(p.x, p.y, o.x, o.y) <= 70 + o.r) {
                this.damage(o, p.dmg, p.x, p.y, { color: p.color, knock: 300 });
              }
            }
          } else {
            this.damage(b, p.dmg, p.x - p.vx * 0.01, p.y - p.vy * 0.01, { color: p.color, knock: 180 });
          }
          p.life = 0;
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter(p => p.life > 0);

    this.updateFx(dt);
  }

  // FX-only tick — also used by intro/winner screens so particles keep moving.
  updateFx(dt) {
    for (const pt of this.particles) {
      pt.t += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 1 - 3 * dt;
      pt.vy *= 1 - 3 * dt;
    }
    this.particles = this.particles.filter(p => p.t < p.life);
    for (const d of this.dmgNums) { d.t += dt; d.y += d.vy * dt; d.vy *= 1 - 2 * dt; }
    this.dmgNums = this.dmgNums.filter(d => d.t < d.life);
    for (const r of this.rings) { r.t += dt; r.r = lerp(r.r, r.max, Math.min(1, dt * 12)); }
    this.rings = this.rings.filter(r => r.t < r.life);
    this.shake = Math.max(0, this.shake - dt * 40);
  }

  // ---------- rendering ----------

  draw(ctx) {
    const sx = this.shake > 0 ? rand(-this.shake, this.shake) : 0;
    const sy = this.shake > 0 ? rand(-this.shake, this.shake) : 0;
    ctx.save();
    ctx.translate(sx, sy);

    this.drawArena(ctx);

    for (const r of this.rings) {
      ctx.save();
      ctx.globalAlpha = 1 - r.t / r.life;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.w;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.projectiles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
      if (p.kind === "orb") {
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    for (const b of this.balls) {
      if (b.alive) this.drawBall(ctx, b);
    }

    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = 1 - pt.t / pt.life;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    for (const d of this.dmgNums) {
      ctx.save();
      ctx.globalAlpha = 1 - Math.pow(d.t / d.life, 2);
      ctx.font = `900 ${d.crit ? 30 : 21}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.strokeText(d.text, d.x, d.y);
      ctx.fillStyle = d.crit ? "#ffe259" : d.color;
      ctx.fillText(d.text, d.x, d.y);
      ctx.restore();
    }

    ctx.restore(); // shake

    this.drawHpBars(ctx);
  }

  drawArena(ctx) {
    // Backdrop
    const g = ctx.createRadialGradient(270, 500, 60, 270, 500, 620);
    g.addColorStop(0, "#161628");
    g.addColorStop(1, "#0b0b14");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 540, 960);

    // Grid
    ctx.save();
    ctx.strokeStyle = "rgba(120,130,190,0.07)";
    ctx.lineWidth = 1;
    for (let x = ARENA.x; x <= ARENA.x + ARENA.w; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, ARENA.y); ctx.lineTo(x, ARENA.y + ARENA.h); ctx.stroke();
    }
    for (let y = ARENA.y; y <= ARENA.y + ARENA.h; y += 48) {
      ctx.beginPath(); ctx.moveTo(ARENA.x, y); ctx.lineTo(ARENA.x + ARENA.w, y); ctx.stroke();
    }
    ctx.restore();

    // Border
    ctx.save();
    ctx.strokeStyle = "#353a5c";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#4d5bff";
    ctx.shadowBlur = 12;
    ctx.strokeRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
    ctx.restore();
  }

  drawBall(ctx, b) {
    // Trail
    if (b.trail.length > 1) {
      ctx.save();
      for (let i = 0; i < b.trail.length - 1; i++) {
        const t = i / b.trail.length;
        ctx.globalAlpha = t * 0.25;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.trail[i].x, b.trail[i].y, b.r * t, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    // Weapon under the body reads better for orbiting blades.
    b.char.drawWeapon(ctx, b);

    ctx.save();
    if (b.aura) {
      ctx.shadowColor = b.aura;
      ctx.shadowBlur = 26;
    } else {
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 14;
    }
    const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.2, b.x, b.y, b.r);
    g.addColorStop(0, "#ffffff33");
    g.addColorStop(0.25, b.color);
    g.addColorStop(1, shade(b.color, -45));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = b.flash > 0 ? "#ffffff" : shade(b.color, 25);
    ctx.stroke();
    ctx.restore();

    if (b.flash > 0) {
      ctx.save();
      ctx.globalAlpha = b.flash * 6;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // Icon
    ctx.save();
    ctx.font = `${Math.floor(b.r * 1.05)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.icon, b.x, b.y + 2);
    ctx.restore();

    if (b.frozen > 0) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = "#9be8ff";
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 3, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.font = "16px serif";
      ctx.textAlign = "center";
      ctx.fillText("❄", b.x + b.r * 0.6, b.y - b.r * 0.6);
      ctx.restore();
    }

    // Mini HP bar + name
    ctx.save();
    const w = b.r * 2.1, h = 5;
    const x = b.x - w / 2, y = b.y - b.r - 14;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    const frac = clamp(b.hp / b.maxhp, 0, 1);
    ctx.fillStyle = frac > 0.5 ? "#6dff6d" : frac > 0.25 ? "#ffd94d" : "#ff5c4d";
    ctx.fillRect(x, y, w * frac, h);
    ctx.font = "700 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(b.name, b.x, b.y + b.r + 16);
    ctx.restore();
  }

  drawHpBars(ctx) {
    const bs = this.balls;
    ctx.save();
    ctx.font = "800 15px system-ui, sans-serif";
    if (bs.length === 2) {
      // Fighting-game style dual bars.
      const bw = 214, bh = 18, y = 34;
      const draw = (b, x, rtl) => {
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(x - 2, y - 2, bw + 4, bh + 4);
        const frac = clamp(b.hp / b.maxhp, 0, 1);
        ctx.fillStyle = b.alive ? b.color : "#444";
        if (rtl) ctx.fillRect(x + bw * (1 - frac), y, bw * frac, bh);
        else ctx.fillRect(x, y, bw * frac, bh);
        ctx.fillStyle = "#fff";
        ctx.textAlign = rtl ? "right" : "left";
        ctx.fillText(`${b.icon} ${b.name}`, rtl ? x + bw : x, y + bh + 18);
        ctx.textAlign = rtl ? "left" : "right";
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "700 12px system-ui, sans-serif";
        ctx.fillText(`${Math.max(0, Math.ceil(b.hp))}`, rtl ? x + 4 : x + bw - 4, y + 14);
        ctx.restore();
      };
      draw(bs[0], 16, false);
      draw(bs[1], 540 - 16 - bw, true);
      ctx.font = "900 26px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffe259";
      ctx.fillText("VS", 270, y + 20);
    } else {
      // Compact grid for team fights / FFA.
      const perCol = Math.ceil(bs.length / 2);
      const bw = 226, bh = 11;
      bs.forEach((b, i) => {
        const col = Math.floor(i / perCol), row = i % perCol;
        const x = 16 + col * (bw + 46), y = 22 + row * 30;
        ctx.save();
        ctx.globalAlpha = b.alive ? 1 : 0.35;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(x - 1, y - 1, bw + 2, bh + 2);
        const frac = clamp(b.hp / b.maxhp, 0, 1);
        ctx.fillStyle = b.alive ? b.color : "#444";
        ctx.fillRect(x, y, bw * frac, bh);
        ctx.fillStyle = "#fff";
        ctx.font = "700 11px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${b.icon} ${b.name}${b.alive ? "" : " ✖"}`, x, y + bh + 12);
        ctx.restore();
      });
    }
    ctx.restore();
  }
}

// Lighten (+) / darken (-) a #rrggbb color.
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}
