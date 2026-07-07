import Matter from "matter-js";
import type { CharacterDef } from "./types";
import { ARENA_SIZE, ARENA_X, ARENA_Y, VEL } from "./constants";
import { Sound } from "./audio";

const f2 = (n: number) => n.toFixed(2);

/**
 * The roster — Ball Thing's characters reverse-engineered from his videos.
 * Ult names read straight off his meter bars where legible
 * (HIGH NOON, FULL THROTTLE, TRICKSTER CLONE, MAELSTROM SAW, CATACLYSM,
 * GRAVITY WELL, SHELLSTORM, HEAVEN RENDING, DETERMINATION, SAFETY WALL).
 */
export const ROSTER: CharacterDef[] = [
  {
    id: "bladesman", name: "Bladesman", color: 0x4d84d6, dark: 0x1f3a66, theme: "plain",
    hp: 165, speed: 150, radius: 42, weapon: { kind: "blade", length: 240, width: 26, style: "greatsword" },
    spin: 5, damage: 5,
    ult: {
      name: "BLADE RUSH", gainDealt: 0.9, gainTaken: 0.55,
      fire(f, e) {
        f.ultT = 4;
        f.aura = f.def.color;
        f.st.spinMult = 2;
        f.st.damage += 3;
        e.ring(f.x, f.y, 220, f.def.color);
      },
    },
    update(f) {
      if (f.ultT <= 0 && f.st.spinMult) { f.st.spinMult = 0; f.aura = 0; }
    },
    onDealHit(f) { f.st.damage += 0.18; f.st.spinMult = f.st.damage / (2 * 2.5); }, // Damage = 2x Spin Speed
    stats: (f) => [
      { label: "Damage", value: () => f2(f.st.damage) },
      { label: "Spin Speed", value: () => f2(f.st.damage / 2) },
    ],
  },

  {
    id: "berserker", name: "Berserker", color: 0xcc3b30, dark: 0x5c130e, theme: "embers",
    hp: 202, speed: 140, radius: 45, weapon: { kind: "blade", length: 215, width: 30, style: "axe" },
    spin: 4.2, damage: 4.8,
    ult: {
      name: "WHIRLWIND", gainDealt: 0.55, gainTaken: 0.8,
      fire(f, e) {
        e.heal(f, f.maxhp * 0.12);
        f.st.damage += 1.2;
        f.ultT = 3.5;
        f.st.spinMult = 2.4;
        f.st.speedMult = 1.5;
        f.aura = 0xff2211;
      },
    },
    update(f) {
      const rage = f.hp < f.maxhp * 0.38;
      f.st.rage = rage ? 1 : 0;
      if (f.ultT <= 0) { f.st.spinMult = rage ? 1.4 : 1; f.st.speedMult = 1; f.aura = rage ? 0xff2211 : 0; }
    },
    modDamage: (f, base) => (f.st.rage ? base * 1.25 : base),
    stats: (f) => [{ label: "Damage", value: () => f2(f.st.damage * (f.st.rage ? 1.25 : 1)) }],
  },

  {
    id: "outlaw", name: "Outlaw", color: 0x8a5a2e, dark: 0x3a2410, theme: "crosshair",
    hp: 142, speed: 155, radius: 40, weapon: { kind: "gun", length: 130, width: 36, style: "revolver" },
    spin: 0, damage: 6.6,
    ult: {
      name: "HIGH NOON", gainDealt: 1.15, gainTaken: 0.7,
      fire(f, e) {
        // quick-draw: the whole cylinder, fanned one shot at a time
        for (let i = 0; i < 6; i++) {
          e.schedule(0.12 + i * 0.14, () => {
            if (!f.alive) return;
            const targets = e.enemies(f);
            const t = targets[i % Math.max(1, targets.length)];
            const a = t ? e.aimLead(f.x, f.y, t, 900) + e.rng.range(-0.04, 0.04) : e.rng.range(0, Math.PI * 2);
            const mx = f.x + Math.cos(a) * (f.def.radius + 26), my = f.y + Math.sin(a) * (f.def.radius + 26);
            e.spawnProjectile(f, "bullet", mx, my, a,
              { speed: 900, dmg: f.st.damage * 1.4, r: 9, color: 0xffd94d, life: 2 });
            e.burst(mx, my, 5, 0xffe259, 220);
            Sound.pew();
          });
        }
        f.st.ammo = 6;
      },
    },
    update(f, e, dt) {
      f.st.shotT = (f.st.shotT ?? 1) - dt;
      if (f.st.shotT <= 0) {
        if (f.st.ammo === undefined) f.st.ammo = 6;
        if (f.st.ammo > 0) {
          const t = e.nearestEnemy(f);
          if (t) {
            const a = e.aimLead(f.x, f.y, t, 1100) + e.rng.range(-0.03, 0.03);
            e.spawnProjectile(f, "bullet", f.x + Math.cos(a) * (f.def.radius + 26), f.y + Math.sin(a) * (f.def.radius + 26), a,
              { speed: 550, dmg: f.st.damage, r: 8, color: 0xffd94d, life: 2 });
            Sound.pew();
            f.st.ammo--;
            f.st.shotT = 0.6;
          }
        } else {
          f.st.ammo = 6; // reload
          f.st.shotT = 1.9;
        }
      }
    },
    onDealHit(f) { f.st.damage += 0.18; },
    stats: (f) => [
      { label: "Damage", value: () => f2(f.st.damage) },
      { label: "Ammo", value: () => `${f.st.ammo ?? 6}/6` },
    ],
  },

  {
    id: "magia", name: "Magia", color: 0xf284c1, dark: 0x8c2a5e, theme: "hearts",
    hp: 135, speed: 145, radius: 40, weapon: { kind: "blade", length: 155, width: 22, style: "wand" },
    spin: 3.6, damage: 4.1,
    ult: {
      name: "HEARTBREAK FINALE", gainDealt: 1.0, gainTaken: 0.8,
      fire(f, e) {
        // a giant double-ring magic circle blooms, then hearts spiral out in waves
        e.ring(f.x, f.y, 300, 0xf284c1);
        e.schedule(0.15, () => e.ring(f.x, f.y, 380, 0xffffff));
        for (let i = 0; i < 10; i++) {
          e.schedule(0.2 + i * 0.09, () => {
            if (!f.alive) return;
            const a = (i / 10) * Math.PI * 2 + 0.6;
            e.spawnProjectile(f, "heart", f.x + Math.cos(a) * (f.def.radius + 16), f.y + Math.sin(a) * (f.def.radius + 16), a,
              { speed: 240, dmg: f.st.damage * 1.8, r: 15, color: 0xf284c1, life: 4, turn: 2.6 });
            Sound.magic();
          });
        }
      },
    },
    update(f, e, dt) {
      f.st.atkspd = f.st.atkspd ?? 1;
      f.st.castT = (f.st.castT ?? 1.6) - dt * f.st.atkspd;
      if (f.st.castT <= 0) {
        const t = e.nearestEnemy(f);
        if (t) {
          const a = Math.atan2(t.y - f.y, t.x - f.x);
          e.spawnProjectile(f, "heart", f.x + Math.cos(a) * (f.def.radius + 16), f.y + Math.sin(a) * (f.def.radius + 16), a,
            { speed: 260, dmg: f.st.damage * 1.6, r: 14, color: 0xf284c1, life: 4, turn: 2.3 });
          Sound.magic();
        }
        f.st.castT = 2.2;
      }
    },
    onDealHit(f) { f.st.atkspd = Math.min(2.4, (f.st.atkspd ?? 1) + 0.03); },
    stats: (f) => [{ label: "Attack Speed", value: () => f2(f.st.atkspd ?? 1) }],
  },

  {
    id: "monkeyking", name: "Monkey King", color: 0xc9a227, dark: 0x4d3a10, theme: "rings",
    hp: 158, speed: 152, radius: 41, weapon: { kind: "staff", length: 330, width: 24, stripes: 6 },
    spin: 5.8, damage: 5.8,
    ult: {
      name: "TRICKSTER CLONE", gainDealt: 0.85, gainTaken: 0.65,
      fire(f, e) {
        e.spawnClone(f);
        f.st.clones = (f.st.clones ?? 0) + 1;
      },
    },
    update(f, _e, dt) {
      // the staff slowly grows (Weapon Size ramps in his fights)
      f.st.wsize = f.st.wsize ?? 1;
      f.st.growT = (f.st.growT ?? 5) - dt;
      if (f.st.growT <= 0 && f.st.wsize < 1.6 && f.weapon) {
        f.st.growT = 5;
        f.st.wsize = Math.round((f.st.wsize + 0.06) * 100) / 100;
        Matter.Body.scale(f.weapon, 1.06, 1.06);
      }
    },
    onDealHit(f) { f.st.damage += 0.14; },
    stats: (f) => [
      { label: "Weapon Size", value: () => f2(f.st.wsize ?? 1) },
      { label: "Clones", value: () => f2(f.st.clones ?? 0) },
    ],
  },

  {
    id: "stasis", name: "Stasis", color: 0x9fd8e8, dark: 0x2e6474, theme: "snow",
    hp: 150, speed: 142, radius: 41, weapon: { kind: "blade", length: 205, width: 26, style: "iceblade" },
    spin: 5.4, damage: 8.5,
    ult: {
      name: "WORLD STASIS", gainDealt: 1.0, gainTaken: 0.9,
      fire(f, e) {
        // ZA WARUDO: freeze the whole arena. During the pause Stasis throws
        // daggers one by one — they hang in the air, each locked onto the
        // opponent's position at the instant it was thrown, and all launch
        // together when time resumes. Every cast throws MORE daggers and
        // holds the freeze slightly longer.
        const casts = (f.st.casts ?? 0) + 1;
        f.st.casts = casts;
        const pause = Math.min(4.2, 2.0 + (casts - 1) * 0.45);
        const count = 6 + (casts - 1) * 4;
        e.beginStasis(pause, f, count);
        e.ring(f.x, f.y, ARENA_SIZE * 0.72, f.def.color);
        Sound.freeze();
      },
    },
    update(f) {
      // Her spin (Attack Speed) ratchets up permanently with each cast —
      // 1.00 -> ~1.9 -> ~2.8 ... matching the stat readouts in his videos.
      f.st.spinMult = 1 + (f.st.casts ?? 0) * 0.9;
    },
    onDealHit(f) { f.st.damage += 0.1; },
    stats: (f) => [{ label: "Attack Speed", value: () => f2(1 + (f.st.casts ?? 0) * 0.9) }],
  },

  {
    id: "mach", name: "Mach", color: 0x2e55cc, dark: 0x101f4d, theme: "speed",
    hp: 128, speed: 215, radius: 37, weapon: { kind: "none" },
    spin: 0, damage: 6,
    ult: {
      name: "FULL THROTTLE", gainDealt: 0.85, gainTaken: 0.75,
      fire(f) {
        f.ultT = 3;
        f.st.speedMult = 2.1;
        f.aura = 0x7ec8ff;
      },
    },
    update(f, _e, dt) {
      // pure rammer: damage ramps, Speed is always Damage / 2 (as observed)
      f.st.damage += dt * 0.08;
      f.st.contact = f.st.damage * (f.ultT > 0 ? 2 : 1);
      f.st.trail = 1;
      if (f.ultT <= 0 && (f.st.speedMult ?? 1) > 1) { f.st.speedMult = 1; f.aura = 0; }
      // ball trail bookkeeping (no weapon => ghosts follow the ball)
      f.ghosts.push({ x: f.x, y: f.y, angle: 0 });
      if (f.ghosts.length > 14) f.ghosts.shift();
    },
    stats: (f) => [
      { label: "Damage", value: () => f2(f.st.damage) },
      { label: "Speed", value: () => f2(f.st.damage / 2) },
    ],
  },

  {
    id: "juggernaut", name: "Juggernaut", color: 0x6a5acd, dark: 0x2b2260, theme: "plain",
    hp: 262, speed: 110, radius: 52, massMult: 3,
    weapon: { kind: "blade", length: 270, width: 34, style: "greatsword" },
    spin: 2.8, damage: 7,
    ult: {
      name: "GRAVITY WELL", gainDealt: 0.6, gainTaken: 0.75,
      fire(f) {
        f.ultT = 2.6;
        f.st.field = 1;
        f.aura = f.def.color;
      },
    },
    update(f, e) {
      if (f.st.field && f.ultT > 0) {
        for (const o of e.enemies(f)) {
          const d = Math.hypot(o.x - f.x, o.y - f.y) || 1;
          if (d < 420) {
            const pull = 0.9 / d;
            Matter.Body.applyForce(o.body, o.body.position, { x: (f.x - o.x) * pull * 0.00012, y: (f.y - o.y) * pull * 0.00012 });
          }
        }
      } else if (f.st.field && f.ultT <= 0) {
        f.st.field = 0;
        f.aura = 0;
      }
    },
    stats: (f) => [{ label: "Damage", value: () => f2(f.st.damage) }],
  },

  {
    id: "swordsaint", name: "Sword Saint", color: 0x59c4dc, dark: 0x1c5d70, theme: "clouds",
    hp: 150, speed: 158, radius: 40, weapon: { kind: "blade", length: 235, width: 20, style: "katana" },
    spin: 6.4, damage: 7,
    ult: {
      name: "SPATIAL REND", gainDealt: 0.95, gainTaken: 0.6,
      fire(f, e) {
        // three vertical rends sweep across the target, biggest last
        const t = e.nearestEnemy(f);
        const x0 = t ? t.x : ARENA_X + ARENA_SIZE / 2;
        [-90, 90, 0].forEach((off, i) => {
          e.schedule(0.12 + i * 0.22, () => {
            const tt = e.nearestEnemy(f);
            const x = (i === 2 && tt ? tt.x : x0 + off);
            e.fireBeam(f, x, ARENA_Y, Math.PI / 2, ARENA_SIZE, i === 2 ? 130 : 70, i === 2 ? 14 : 8, 0xaef0ff);
          });
        });
      },
    },
    onDealHit(f) { f.st.spinMult = Math.min(2, (f.st.spinMult ?? 1) + 0.03); },
    stats: (f) => [{ label: "Attack Speed", value: () => f2(f.st.spinMult ?? 1) }],
  },

  {
    id: "judge", name: "Judge", color: 0xe8e2d4, dark: 0x6b6255, theme: "bones",
    // The Judge is a Sans homage: 1 HP, survives by dodging. His dodge engine
    // is the Recovery Rate stat, which decays over the fight (15 -> ~3 in his
    // videos) — eventually one hit gets through.
    hp: 1, speed: 150, radius: 44, weapon: { kind: "blade", length: 205, width: 28, style: "gavel" },
    spin: 3.8, damage: 6.5,
    ult: {
      name: "ABSOLUTE EVASION", gainDealt: 0.75, gainTaken: 0,
      fire(f, e) {
        f.shieldT = 3; // guaranteed evasion window
        const karma = f.st.karma ?? 0;
        const targets = e.enemies(f);
        targets.forEach((o, i) => {
          e.schedule(0.15 + i * 0.18, () => {
            if (!o.alive) return;
            e.fireBeam(f, o.x, ARENA_Y, Math.PI / 2, ARENA_SIZE, 44, Math.max(6, karma / Math.max(1, targets.length)), 0xf5f0e0);
          });
        });
        f.st.karma = 0;
      },
    },
    update(f, e, dt) {
      f.st.recovery = Math.max(2.5, (f.st.recovery ?? 15.5) - dt * 0.09);
      // dodging charges the ult meter too
      f.gainMeter(dt * 7);
      void e;
    },
    dodge(f, e) {
      if (f.shieldT > 0) return true;
      return e.rng.next() < Math.min(0.96, (f.st.recovery ?? 15.5) * 0.063);
    },
    onDealHit(f, _t, _e, dmg) { f.st.karma = Math.min(60, (f.st.karma ?? 0) + dmg * 0.9); },
    stats: (f) => [
      { label: "Karma", value: () => f2(f.st.karma ?? 0) },
      { label: "Recovery Rate", value: () => f2(f.st.recovery ?? 15.5) },
    ],
  },

  {
    id: "rogue", name: "Rogue", color: 0x8a8a3d, dark: 0x3c3c14, theme: "stars",
    hp: 135, speed: 170, radius: 38, weapon: { kind: "orbitals", count: 3, radius: 17, dist: 74 },
    spin: 6.4, damage: 3.2,
    ult: {
      name: "BATTLE TRANCE", gainDealt: 1.0, gainTaken: 0.75,
      fire(f, e) {
        // vanish in smoke... reappear behind them... three-hit flurry
        e.burst(f.x, f.y, 16, 0x3c3c14, 260);
        e.schedule(0.25, () => {
          const t = e.nearestEnemy(f);
          if (!t || !f.alive) return;
          const a = e.rng.range(0, Math.PI * 2);
          Matter.Body.setPosition(f.body, { x: t.x + Math.cos(a) * (t.def.radius + f.def.radius + 8), y: t.y + Math.sin(a) * (t.def.radius + f.def.radius + 8) });
          e.burst(f.x, f.y, 18, 0x3c3c14, 300);
          for (let i = 0; i < 3; i++) {
            e.schedule(0.08 + i * 0.12, () => { if (t.alive && f.alive) e.dealDamage(f, t, f.st.damage * 2.5, { color: 0xffe259 }); });
          }
        });
      },
    },
    modDamage(f, base, e) {
      const crit = e.rng.next() * 100 < (f.st.crit ?? 14);
      return crit ? base * 2.5 : base;
    },
    onDealHit(f) { f.st.crit = Math.min(75, (f.st.crit ?? 14) + 1.8); },
    stats: (f) => [{ label: "Crit %", value: () => f2(f.st.crit ?? 14) }],
  },

  {
    id: "duelist", name: "Duelist", color: 0x5f6b76, dark: 0x232a31, theme: "plain",
    hp: 150, speed: 160, radius: 39, weapon: { kind: "blade", length: 225, width: 16, style: "rapier" },
    spin: 5.4, damage: 6.5,
    ult: {
      name: "SHELLSTORM", gainDealt: 1.0, gainTaken: 0.65,
      fire(f, e) {
        const t = e.nearestEnemy(f);
        const base = t ? Math.atan2(t.y - f.y, t.x - f.x) : e.rng.range(0, Math.PI * 2);
        for (let i = 0; i < 8; i++) {
          const a = base + (i - 3.5) * 0.13;
          e.spawnProjectile(f, "bullet", f.x + Math.cos(a) * (f.def.radius + 20), f.y + Math.sin(a) * (f.def.radius + 20), a,
            { speed: 450, dmg: f.st.damage * 1.3, r: 7, color: 0xd8dce4, life: 1.6 });
        }
      },
    },
    onDealHit(f) { f.st.damage += 0.3; },
    stats: (f) => [{ label: "Damage", value: () => f2(f.st.damage) }],
  },

  {
    id: "shredder", name: "Shredder", color: 0xe07b20, dark: 0x6b3408, theme: "gears",
    hp: 172, speed: 148, radius: 42, weapon: { kind: "blade", length: 260, width: 28, style: "chainsaw" },
    spin: 4.4, damage: 5.4,
    ult: {
      name: "MAELSTROM SAW", gainDealt: 0.9, gainTaken: 0.7,
      fire(f) {
        f.ultT = 3.5;
        f.st.spinMult = 2.4;
        f.aura = f.def.color;
      },
    },
    update(f) {
      if (f.ultT <= 0 && (f.st.spinMult ?? 1) > 1) { f.st.spinMult = 1; f.aura = 0; }
    },
    onDealHit(f, _t, e, dmg) {
      f.st.damage += 0.06; // Damage and Lifesteal ramp together
      e.heal(f, dmg * 0.45, { overheal: true });
    },
    stats: (f) => [
      { label: "Damage", value: () => f2(f.st.damage) },
      { label: "Lifesteal", value: () => f2(f.st.damage) },
    ],
  },

  {
    id: "sunderer", name: "Sunderer", color: 0xb02a3a, dark: 0x4d0f18, theme: "plain",
    hp: 158, speed: 138, radius: 42, weapon: { kind: "none" },
    spin: 0, damage: 4,
    ult: {
      name: "CATACLYSM", gainDealt: 0.85, gainTaken: 0.7,
      fire(f, e) {
        // the sky falls in three waves of giant nails
        for (let wave = 0; wave < 3; wave++) {
          e.schedule(0.1 + wave * 0.3, () => {
            if (!f.alive) return;
            for (let i = 0; i < 5; i++) {
              const a = e.rng.range(0, Math.PI * 2);
              e.spawnProjectile(f, "nail", f.x + Math.cos(a) * (f.def.radius + 30), f.y + Math.sin(a) * (f.def.radius + 30), a,
                { speed: e.rng.range(700, 1000), dmg: f.st.damage * 1.6, l: e.rng.range(300, 480), w: 12, color: 0xc7ccd6, life: 3 });
            }
            e.shake = 14;
            Sound.dash();
          });
        }
      },
    },
    update(f, e, dt) {
      f.st.atkspd = f.st.atkspd ?? 1.2;
      f.st.fireT = (f.st.fireT ?? 1.4) - dt * f.st.atkspd;
      if (f.st.fireT <= 0) {
        const t = e.nearestEnemy(f);
        if (t) {
          const a = e.aimLead(f.x, f.y, t, 1050) + e.rng.range(-0.02, 0.02);
          e.spawnProjectile(f, "nail", f.x + Math.cos(a) * (f.def.radius + 30), f.y + Math.sin(a) * (f.def.radius + 30), a,
            { speed: 525, dmg: f.st.damage * 2.2, l: e.rng.range(280, 420), w: 12, color: 0xc7ccd6, life: 3 });
          Sound.dash();
        }
        f.st.fireT = 0.7;
        f.st.damage += 0.05;
        f.st.atkspd = Math.min(2.4, f.st.atkspd + 0.03);
      }
    },
    stats: (f) => [
      { label: "Damage", value: () => f2(f.st.damage) },
      { label: "Attack Speed", value: () => f2(f.st.atkspd ?? 1.2) },
    ],
  },

  {
    id: "samurai", name: "Samurai", color: 0xa03040, dark: 0x471019, theme: "bamboo",
    hp: 158, speed: 160, radius: 40, weapon: { kind: "blade", length: 240, width: 20, style: "katana" },
    spin: 5.6, damage: 5,
    ult: {
      name: "DASH", gainDealt: 0.95, gainTaken: 0.65,
      fire(f, e) {
        // radial slash burst + a permanent damage surge (5.50 -> 15.00 in his fights)
        for (let i = 0; i < 8; i++) {
          e.fireBeam(f, f.x, f.y, (i / 8) * Math.PI * 2, 320, 40, 8, 0xffd9e0);
        }
        f.st.damage = Math.min(12, f.st.damage * 1.45);
        const t = e.nearestEnemy(f);
        if (t) {
          const a = Math.atan2(t.y - f.y, t.x - f.x);
          Matter.Body.setVelocity(f.body, { x: Math.cos(a) * 900 * VEL, y: Math.sin(a) * 900 * VEL });
        }
        Sound.dash();
      },
    },
    onDealHit(f) { f.st.damage += 0.18; },
    stats: (f) => [{ label: "Damage", value: () => f2(f.st.damage) }],
  },

  {
    id: "tyrant", name: "Tyrant", color: 0xa67c1a, dark: 0x453208, theme: "rings",
    hp: 165, speed: 140, radius: 42, weapon: { kind: "blade", length: 150, width: 22, style: "sword" },
    spin: 4.2, damage: 4.8,
    ult: {
      name: "HEAVEN BINDING", gainDealt: 0.8, gainTaken: 0.7,
      fire(f, e) {
        // gates open row by row across the top of the arena, then volley
        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 4; col++) {
            e.schedule(0.1 + row * 0.25 + col * 0.06, () => {
              if (!f.alive) return;
              e.spawnGateAt(f,
                ARENA_X + ARENA_SIZE * (0.2 + col * 0.2),
                ARENA_Y + ARENA_SIZE * (0.14 + row * 0.16),
                f.st.damage * 1.9);
            });
          }
        }
        f.st.gate = (f.st.gate ?? 0) + 8;
      },
    },
    update(f, e, dt) {
      f.st.gateT = (f.st.gateT ?? 2) - dt;
      if (f.st.gateT <= 0) {
        f.st.gateT = 1.0;
        e.spawnGate(f, f.st.damage * 3.1);
        f.st.gate = (f.st.gate ?? 0) + 1;
      }
    },
    stats: (f) => [{ label: "Gate", value: () => f2(f.st.gate ?? 0) }],
  },

  {
    id: "axiom", name: "Axiom", color: 0x3f6fd8, dark: 0x16305f, theme: "plain",
    hp: 142, speed: 145, radius: 40, weapon: { kind: "gun", length: 175, width: 30, style: "railgun" },
    spin: 0, damage: 3.5,
    ult: {
      name: "HORIZON", gainDealt: 1.0, gainTaken: 0.7,
      fire(f, e) {
        // twin wing-arcs of glowing blades sweep out (as seen in his Ranged FFA)
        for (let i = 0; i < 12; i++) {
          const side = i < 6 ? 1 : -1;
          const a = Math.atan2(0, 1) + side * (0.4 + (i % 6) * 0.22);
          const t = e.nearestEnemy(f);
          const base = t ? Math.atan2(t.y - f.y, t.x - f.x) : 0;
          e.spawnProjectile(f, "gateblade", f.x + Math.cos(base + a) * (f.def.radius + 26), f.y + Math.sin(base + a) * (f.def.radius + 26), base + a,
            { speed: 410, dmg: f.st.damage, l: 110, w: 13, color: 0x9fd8ff, life: 2.2 });
        }
      },
    },
    update(f, e, dt) {
      f.st.fireT = (f.st.fireT ?? 1.6) - dt;
      if (f.st.fireT <= 0) {
        const t = e.nearestEnemy(f);
        if (t) {
          const a = e.aimLead(f.x, f.y, t, 1000);
          e.spawnProjectile(f, "gateblade", f.x + Math.cos(a) * (f.def.radius + 30), f.y + Math.sin(a) * (f.def.radius + 30), a,
            { speed: 500, dmg: f.st.damage, l: 110, w: 13, color: 0x9fd8ff, life: 1.8 });
          Sound.pew();
          // Shred ramps; Damage is always 3x Shred (as in his stat readouts)
          f.st.shred = Math.min(5.5, (f.st.shred ?? 2.2) + 0.09);
          f.st.damage = f.st.shred * 3;
        }
        f.st.fireT = 1.2;
      }
    },
    stats: (f) => [
      { label: "Shred", value: () => f2(f.st.shred ?? 2.2) },
      { label: "Damage", value: () => f2(f.st.damage) },
    ],
  },

  {
    id: "vessel", name: "Vessel", color: 0xb03038, dark: 0x4a0d12, theme: "bones",
    hp: 172, speed: 142, radius: 42, weapon: { kind: "blade", length: 195, width: 24, style: "dagger" },
    spin: 4.6, damage: 3.0,
    ult: {
      name: "DETERMINATION", gainDealt: 0.45, gainTaken: 1.0,
      fire(f, e) {
        // refuses to fall: big heal + a small permanent damage bump
        e.heal(f, f.maxhp * 0.25);
        f.st.damage = Math.min(15, f.st.damage + 0.5);
        f.ultT = 3;
        f.aura = 0xff4444;
        f.st.speedMult = 1.4;
      },
    },
    update(f) {
      if (f.ultT <= 0 && (f.st.speedMult ?? 1) > 1) { f.st.speedMult = 1; f.aura = 0; }
    },
    onDealHit(f) { f.st.damage = Math.min(11, f.st.damage + 0.18); },
    stats: (f) => [{ label: "Damage", value: () => f2(f.st.damage) }],
  },

  {
    id: "thunderclad", name: "Thunderclad", color: 0xe8c53a, dark: 0x2c4a8c, theme: "stars",
    hp: 150, speed: 152, radius: 40, weapon: { kind: "blade", length: 215, width: 26, style: "bolt" },
    spin: 5.4, damage: 7,
    ult: {
      name: "THUNDERCALL", gainDealt: 0.9, gainTaken: 0.7,
      fire(f, e) {
        // storm clouds gather, then bolts strike each enemy in sequence
        e.enemies(f).forEach((o, i) => {
          e.schedule(0.2 + i * 0.15, () => {
            if (!o.alive) return;
            e.fireBeam(f, o.x, ARENA_Y, Math.PI / 2, o.y - ARENA_Y + 30, 34, 12, 0xfff3a8);
            e.burst(o.x, o.y, 12, 0xfff3a8, 260);
          });
        });
      },
    },
    onDealHit(f, t, e, dmg) {
      // chain lightning: 30% chance to arc to another enemy
      if (e.rng.next() < 0.6) {
        const others = e.enemies(f).filter(o => o !== t);
        if (others.length) {
          const o = others[Math.floor(e.rng.next() * others.length)];
          e.fireBeam(f, t.x, t.y, Math.atan2(o.y - t.y, o.x - t.x), Math.hypot(o.x - t.x, o.y - t.y), 14, Math.max(2, dmg * 0.6), 0xfff3a8);
        }
      }
      f.st.damage += 0.08;
    },
    stats: (f) => [{ label: "Damage", value: () => f2(f.st.damage) }],
  },
];

export const ROSTER_BY_ID = new Map(ROSTER.map(c => [c.id, c]));

export function getChar(id: string): CharacterDef {
  const c = ROSTER_BY_ID.get(id);
  if (!c) throw new Error(`Unknown character: ${id}`);
  return c;
}
