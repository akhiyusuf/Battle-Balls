// Character roster — each fighter is a ball with a weapon and one signature
// ability, in the style of Ball Thing's 1v1 / FFA fight simulations.
"use strict";

function drawBlade(ctx, x, y, angle, inner, outer, width, color) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  ctx.save();
  ctx.lineCap = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x + ca * inner, y + sa * inner);
  ctx.lineTo(x + ca * outer, y + sa * outer);
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1.5, width * 0.35);
  ctx.beginPath();
  ctx.moveTo(x + ca * (inner + 2), y + sa * (inner + 2));
  ctx.lineTo(x + ca * (outer - 3), y + sa * (outer - 3));
  ctx.stroke();
  ctx.restore();
}

const ROSTER = [
  {
    id: "bladesman", name: "Bladesman", icon: "⚔️", color: "#4da6ff",
    desc: "sword grows per hit",
    hp: 100, speed: 250, radius: 26,
    init(b) { b.st = { len: 82, spin: 5.4 }; },
    update(b, w, dt) { b.wa += b.st.spin * dt; },
    colliders(b) {
      const a = b.wa, i = b.r + 4, o = b.r + b.st.len;
      return [{
        type: "capsule", key: "sword", parry: true, dmg: 8, knock: 260,
        ax: b.x + Math.cos(a) * i, ay: b.y + Math.sin(a) * i,
        bx: b.x + Math.cos(a) * o, by: b.y + Math.sin(a) * o, r: 6,
      }];
    },
    onDealDamage(b) { b.st.len = Math.min(150, b.st.len + 5); },
    drawWeapon(ctx, b) { drawBlade(ctx, b.x, b.y, b.wa, b.r + 4, b.r + b.st.len, 9, b.color); },
  },

  {
    id: "berserker", name: "Berserker", icon: "🪓", color: "#ff5c4d",
    desc: "rages below 50% HP",
    hp: 125, speed: 225, radius: 28,
    init(b) { b.st = {}; },
    update(b, w, dt) {
      const rage = b.hp < b.maxhp * 0.5;
      b.st.rage = rage;
      b.wa += (rage ? 7.2 : 4.2) * dt;
      if (rage) b.aura = "#ff2211";
    },
    colliders(b) {
      const a = b.wa, i = b.r + 2, o = b.r + 62;
      const mult = b.st.rage ? 1.6 : 1;
      return [{
        type: "capsule", key: "axe", parry: true, dmg: 10 * mult, knock: 340,
        ax: b.x + Math.cos(a) * i, ay: b.y + Math.sin(a) * i,
        bx: b.x + Math.cos(a) * o, by: b.y + Math.sin(a) * o, r: 10,
      }];
    },
    drawWeapon(ctx, b) {
      const a = b.wa, o = b.r + 62;
      drawBlade(ctx, b.x, b.y, a, b.r + 2, o - 12, 7, "#c9c2b8");
      const hx = b.x + Math.cos(a) * (o - 10), hy = b.y + Math.sin(a) * (o - 10);
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(a);
      ctx.fillStyle = b.st.rage ? "#ff3b2d" : b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(-4, -18); ctx.quadraticCurveTo(20, 0, -4, 18); ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
  },

  {
    id: "outlaw", name: "Outlaw", icon: "🔫", color: "#ffb84d",
    desc: "fires at nearest foe",
    hp: 90, speed: 255, radius: 24,
    init(b) { b.st = { cd: 0.8, aim: 0 }; },
    update(b, w, dt) {
      const t = w.nearestEnemy(b);
      if (t) b.st.aim = Math.atan2(t.y - b.y, t.x - b.x);
      b.st.cd -= dt;
      if (t && b.st.cd <= 0) {
        b.st.cd = 1.05;
        const a = b.st.aim + rand(-0.06, 0.06);
        w.spawnBullet(b, b.x + Math.cos(a) * (b.r + 18), b.y + Math.sin(a) * (b.r + 18), a,
          { speed: 560, dmg: 7, r: 5, color: b.color });
        Sound.pew();
      }
    },
    colliders() { return []; },
    drawWeapon(ctx, b) {
      const a = b.st.aim;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(a);
      ctx.fillStyle = "#3a3f4d";
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.fillRect(b.r - 4, -5, 26, 10);
      ctx.strokeRect(b.r - 4, -5, 26, 10);
      ctx.restore();
    },
  },

  {
    id: "magia", name: "Magia", icon: "🔮", color: "#c77dff",
    desc: "homing arcane orbs",
    hp: 85, speed: 235, radius: 24,
    init(b) { b.st = { cd: 1.6 }; },
    update(b, w, dt) {
      b.wa += 2.2 * dt;
      b.st.cd -= dt;
      const t = w.nearestEnemy(b);
      if (t && b.st.cd <= 0) {
        b.st.cd = 3.3;
        const a = Math.atan2(t.y - b.y, t.x - b.x);
        w.spawnOrb(b, b.x, b.y, a, { speed: 230, dmg: 10, r: 10, turn: 2.6, color: b.color, life: 4.5 });
        Sound.magic();
      }
    },
    colliders(b) {
      // Small warding sigils orbit the ball.
      return [0, 1, 2].map(i => {
        const a = b.wa + (i * TAU) / 3, d = b.r + 20;
        return {
          type: "circle", key: "sigil" + i, parry: false, dmg: 3, knock: 160,
          x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d, r: 7,
        };
      });
    },
    drawWeapon(ctx, b) {
      for (let i = 0; i < 3; i++) {
        const a = b.wa + (i * TAU) / 3, d = b.r + 20;
        ctx.save();
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 6, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    },
  },

  {
    id: "monkeyking", name: "Monkey King", icon: "🐒", color: "#ffd94d",
    desc: "staff extends to sweep",
    hp: 100, speed: 265, radius: 25,
    init(b) { b.st = { t: rand(1, 2.5), ext: 0 }; },
    update(b, w, dt) {
      b.st.t -= dt;
      if (b.st.t <= 0) {
        b.st.t = b.st.ext > 0 ? rand(2.8, 4) : 1.0;
        b.st.ext = b.st.ext > 0 ? 0 : 1;
        if (b.st.ext) Sound.dash();
      }
      b.st.len = lerp(b.st.len ?? 55, b.st.ext ? 140 : 55, Math.min(1, dt * 10));
      b.wa += (b.st.ext ? 8.5 : 4.8) * dt;
    },
    colliders(b) {
      const a = b.wa, L = b.st.len ?? 55;
      // Staff pierces through both sides of the ball.
      return [{
        type: "capsule", key: "staff", parry: true,
        dmg: b.st.ext ? 8 : 6, knock: 300,
        ax: b.x - Math.cos(a) * (b.r + L * 0.4), ay: b.y - Math.sin(a) * (b.r + L * 0.4),
        bx: b.x + Math.cos(a) * (b.r + L), by: b.y + Math.sin(a) * (b.r + L), r: 6,
      }];
    },
    drawWeapon(ctx, b) {
      const a = b.wa, L = b.st.len ?? 55;
      drawBlade(ctx, b.x, b.y, a, -(b.r + L * 0.4), b.r + L, 8, b.color);
      const tx = b.x + Math.cos(a) * (b.r + L), ty = b.y + Math.sin(a) * (b.r + L);
      ctx.save();
      ctx.fillStyle = "#ff4d4d";
      ctx.beginPath(); ctx.arc(tx, ty, 5, 0, TAU); ctx.fill();
      ctx.restore();
    },
  },

  {
    id: "stasis", name: "Stasis", icon: "❄️", color: "#7de8ff",
    desc: "freezes nearby foes",
    hp: 95, speed: 235, radius: 25,
    init(b) { b.st = { cd: 2.6 }; },
    update(b, w, dt) {
      b.wa += 4.4 * dt;
      b.st.cd -= dt;
      if (b.st.cd <= 0) {
        b.st.cd = 4.2;
        w.freezePulse(b, 175, 1.8);
        const t = w.nearestEnemy(b);
        if (t) {
          const a = Math.atan2(t.y - b.y, t.x - b.x);
          b.vx = Math.cos(a) * 620;
          b.vy = Math.sin(a) * 620;
        }
        Sound.freeze();
      }
    },
    colliders(b) {
      const i = b.r + 4, o = b.r + 72;
      return [0, 1].map(k => {
        const a = b.wa + k * Math.PI;
        return {
          type: "capsule", key: "shard" + k, parry: true, dmg: 6, knock: 220,
          ax: b.x + Math.cos(a) * i, ay: b.y + Math.sin(a) * i,
          bx: b.x + Math.cos(a) * o, by: b.y + Math.sin(a) * o, r: 6,
        };
      });
    },
    drawWeapon(ctx, b) {
      const o = b.r + 72;
      drawBlade(ctx, b.x, b.y, b.wa, b.r + 4, o, 7, b.color);
      drawBlade(ctx, b.x, b.y, b.wa + Math.PI, b.r + 4, o, 7, b.color);
      // Charge indicator ring.
      const p = clamp(1 - b.st.cd / 4.2, 0, 1);
      ctx.save();
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 7, -Math.PI / 2, -Math.PI / 2 + p * TAU);
      ctx.stroke();
      ctx.restore();
    },
  },

  {
    id: "mach", name: "Mach", icon: "⚡", color: "#9dff57",
    desc: "dashes through enemies",
    hp: 80, speed: 330, radius: 22,
    init(b) { b.st = { cd: 2, dash: 0 }; b.trailMax = 10; },
    update(b, w, dt) {
      b.wa += 9 * dt;
      b.st.cd -= dt;
      b.st.dash = Math.max(0, b.st.dash - dt);
      b.contactDmg = b.st.dash > 0 ? 12 : 0;
      if (b.st.dash > 0) b.aura = "#caff8a";
      const t = w.nearestEnemy(b);
      if (t && b.st.cd <= 0) {
        b.st.cd = rand(2.4, 3.2);
        b.st.dash = 0.4;
        const a = Math.atan2(t.y - b.y, t.x - b.x);
        b.vx = Math.cos(a) * 900;
        b.vy = Math.sin(a) * 900;
        Sound.dash();
      }
    },
    colliders(b) {
      return [0, 1].map(i => {
        const a = b.wa + i * Math.PI, d = b.r + 16;
        return {
          type: "circle", key: "blade" + i, parry: true, dmg: 5, knock: 180,
          x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d, r: 8,
        };
      });
    },
    drawWeapon(ctx, b) {
      for (let i = 0; i < 2; i++) {
        const a = b.wa + i * Math.PI, d = b.r + 16;
        const x = b.x + Math.cos(a) * d, y = b.y + Math.sin(a) * d;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a * 3);
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const ka = (k * TAU) / 3;
          ctx.lineTo(Math.cos(ka) * 9, Math.sin(ka) * 9);
          ctx.lineTo(Math.cos(ka + 1) * 3.5, Math.sin(ka + 1) * 3.5);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    },
  },

  {
    id: "juggernaut", name: "Juggernaut", icon: "🛡️", color: "#b0b6c4",
    desc: "spiked tank, heavy hits",
    hp: 165, speed: 195, radius: 34,
    massMult: 2.6,
    init(b) { b.st = {}; b.contactDmg = 9; },
    update(b, w, dt) { b.wa += 2.6 * dt; },
    colliders(b) {
      const a = b.wa + Math.PI / 2, i = b.r + 2, o = b.r + 44;
      return [{
        type: "capsule", key: "mace", parry: true, dmg: 8, knock: 380,
        ax: b.x + Math.cos(a) * i, ay: b.y + Math.sin(a) * i,
        bx: b.x + Math.cos(a) * o, by: b.y + Math.sin(a) * o, r: 9,
      }];
    },
    drawWeapon(ctx, b) {
      // Body spikes.
      ctx.save();
      ctx.fillStyle = b.color;
      for (let i = 0; i < 8; i++) {
        const a = b.wa + (i * TAU) / 8;
        const x1 = b.x + Math.cos(a) * b.r, y1 = b.y + Math.sin(a) * b.r;
        const x2 = b.x + Math.cos(a) * (b.r + 10), y2 = b.y + Math.sin(a) * (b.r + 10);
        const pa = a + 0.18, pb = a - 0.18;
        ctx.beginPath();
        ctx.moveTo(b.x + Math.cos(pa) * b.r, b.y + Math.sin(pa) * b.r);
        ctx.lineTo(x2, y2);
        ctx.lineTo(b.x + Math.cos(pb) * b.r, b.y + Math.sin(pb) * b.r);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      const a = b.wa + Math.PI / 2, o = b.r + 44;
      drawBlade(ctx, b.x, b.y, a, b.r + 2, o - 10, 6, "#8f95a3");
      const hx = b.x + Math.cos(a) * o, hy = b.y + Math.sin(a) * o;
      ctx.save();
      ctx.fillStyle = "#6f7686";
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(hx, hy, 11, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
    },
  },
];

const ROSTER_BY_ID = Object.fromEntries(ROSTER.map(c => [c.id, c]));
