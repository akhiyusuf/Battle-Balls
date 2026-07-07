import Matter from "matter-js";
import type { CharacterDef, WeaponShape } from "./types";
import { METER_MAX } from "./constants";

export const CAT_BALL = 0x0001;
export const CAT_WEAPON = 0x0002;
export const CAT_PROJ = 0x0004;
export const CAT_WALL = 0x0008;

let SEQ = 0;

/** What a Matter body belongs to; stored on body.plugin. */
export interface BodyTag {
  role: "ball" | "weapon" | "proj" | "wall";
  fighter?: Fighter;
}

export function tagOf(body: Matter.Body): BodyTag | undefined {
  return (body.parent ?? body).plugin as BodyTag | undefined;
}

/**
 * A fighter: a ball body plus a weapon body pinned to the ball's center.
 * The weapon is driven by motor torque, so clashes physically stagger it —
 * this is what gives Ball Thing fights their flailing, reactive weapon feel.
 */
export class Fighter {
  readonly id = ++SEQ;
  readonly def: CharacterDef;
  readonly team: number;
  readonly isClone: boolean;

  hp: number;
  maxhp: number;
  meter = 0;
  alive = true;
  frozen = 0;
  flash = 0;
  /** Extra aura color while an ult/rage is active (0 = none). */
  aura = 0;
  /** Free-form per-character numeric state (damage, ammo, crit%, karma...). */
  st: Record<string, number> = {};
  /** Timed status effects set by ults. */
  ultT = 0;
  shieldT = 0;

  body: Matter.Body;
  weapon: Matter.Body | null = null;
  /** Negative Matter collision group shared by this fighter's ball/weapon/projectiles. */
  group = 0;
  pin: Matter.Constraint | null = null;
  /** Current motor target (rad/s * spin direction). */
  spinDir: 1 | -1;
  /** Per attacker+weapon key -> cooldown remaining. */
  hitCooldowns = new Map<string, number>();
  /** Recent weapon transforms for ghost trails. */
  ghosts: { x: number; y: number; angle: number }[] = [];

  constructor(def: CharacterDef, team: number, x: number, y: number, dir: number, opts?: { clone?: boolean }) {
    this.def = def;
    this.team = team;
    this.isClone = opts?.clone ?? false;
    const hpScale = this.isClone ? 0.35 : 1;
    this.hp = Math.round(def.hp * hpScale);
    this.maxhp = this.hp;
    this.spinDir = Math.random() < 0.5 ? 1 : -1;

    const group = Matter.Body.nextGroup(true); // own ball+weapon never collide
    this.group = group;
    this.body = Matter.Bodies.circle(x, y, def.radius, {
      // Low restitution so colliding balls stay mashed together and keep
      // brawling instead of flinging apart (they re-seek immediately anyway).
      restitution: 0.35,
      friction: 0,
      frictionAir: 0,
      frictionStatic: 0,
      density: 0.0012 * (def.massMult ?? 1),
      collisionFilter: { group, category: CAT_BALL, mask: CAT_BALL | CAT_WEAPON | CAT_PROJ | CAT_WALL },
    });
    Matter.Body.setVelocity(this.body, { x: Math.cos(dir) * def.speed, y: Math.sin(dir) * def.speed });
    (this.body.plugin as BodyTag) = { role: "ball", fighter: this };

    this.buildWeapon(group, x, y);

    // initialize character state
    this.st.damage = def.damage;
  }

  private buildWeapon(group: number, x: number, y: number) {
    const w = this.def.weapon;
    const filter = { group, category: CAT_WEAPON, mask: CAT_BALL | CAT_WEAPON };
    const opts: Matter.IBodyDefinition = {
      // Sensor: weapons detect hits + clashes (for damage/sparks) but never
      // physically shove balls or each other. This lets the balls cluster and
      // the weapons overlap in a tight brawl, exactly like Ball Thing's fights,
      // instead of long weapons prying the balls apart at weapon's length.
      isSensor: true,
      restitution: 0.4,
      friction: 0,
      frictionAir: 0.01,
      density: 0.0004,
      collisionFilter: filter,
    };
    const r = this.def.radius;
    let body: Matter.Body | null = null;
    let pivotLocal = { x: 0, y: 0 }; // pivot point in weapon-local coords

    switch (w.kind) {
      case "blade":
      case "gun": {
        // Held weapon: inner end at ball edge, pivots around ball center.
        const off = r * 0.4 + w.length / 2;
        body = Matter.Bodies.rectangle(x + off, y, w.length, w.width, opts);
        pivotLocal = { x: -off, y: 0 };
        break;
      }
      case "staff": {
        // Spins around its middle, through the ball (Monkey King style).
        body = Matter.Bodies.rectangle(x, y, w.length, w.width, opts);
        pivotLocal = { x: 0, y: 0 };
        break;
      }
      case "saw": {
        const off = r + w.radius * 0.55;
        body = Matter.Bodies.circle(x + off, y, w.radius, opts);
        pivotLocal = { x: -off, y: 0 };
        break;
      }
      case "orbitals": {
        const parts: Matter.Body[] = [];
        for (let i = 0; i < w.count; i++) {
          const a = (i / w.count) * Math.PI * 2;
          parts.push(Matter.Bodies.circle(x + Math.cos(a) * w.dist, y + Math.sin(a) * w.dist, w.radius, opts));
        }
        body = Matter.Body.create({ parts, ...opts });
        Matter.Body.setPosition(body, { x, y });
        pivotLocal = { x: 0, y: 0 };
        break;
      }
      case "none":
        return;
    }

    if (!body) return;
    (body.plugin as BodyTag) = { role: "weapon", fighter: this };
    this.weapon = body;
    this.pin = Matter.Constraint.create({
      bodyA: this.body,
      pointA: { x: 0, y: 0 },
      bodyB: body,
      pointB: pivotLocal,
      length: 0,
      stiffness: 0.9,
      damping: 0.05,
    });
  }

  /** Torque the weapon toward its target angular velocity. */
  driveWeapon(dt: number, targetSpin: number) {
    if (!this.weapon) return;
    if (this.frozen > 0) {
      Matter.Body.setAngularVelocity(this.weapon, this.weapon.angularVelocity * 0.8);
      return;
    }
    const cur = this.weapon.angularVelocity;
    const want = targetSpin * this.spinDir;
    // proportional motor; clamped so clashes still knock the weapon around
    const accel = Math.max(-30, Math.min(30, (want - cur) * 6)) * dt;
    Matter.Body.setAngularVelocity(this.weapon, cur + accel);
  }

  /** Point a gun-type weapon toward a world position (aim instead of spin). */
  aimWeapon(tx: number, ty: number, dt: number) {
    if (!this.weapon || this.frozen > 0) return;
    const want = Math.atan2(ty - this.body.position.y, tx - this.body.position.x);
    let diff = want - this.weapon.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    Matter.Body.setAngularVelocity(this.weapon, Math.max(-14, Math.min(14, diff * 10)) * (dt * 60) * 0.2 + this.weapon.angularVelocity * 0.4);
  }

  gainMeter(n: number) {
    if (!this.alive || this.isClone) return;
    this.meter = Math.min(METER_MAX, this.meter + n);
  }

  get x() { return this.body.position.x; }
  get y() { return this.body.position.y; }
}

export type { WeaponShape };
