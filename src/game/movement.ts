import Matter from "matter-js";
import type { Fighter } from "./fighter";
import { VEL } from "./constants";
import { MOVE } from "./tuning";

// Dev-only: `window.__setMove({near,far,turn,rest})` overrides homing + restitution live for tuning sweeps.
const OV: { near?: number; far?: number; turn?: number; rest?: number } = {};
if (typeof window !== "undefined") {
  (window as unknown as { __setMove: (o: typeof OV) => void }).__setMove = (o) => Object.assign(OV, o);
}
export function restOverride(): number | undefined { return OV.rest; }

/**
 * Steer one fighter for a physics step.
 *
 * The heading is whatever physics left it (so wall/ball bounces send them
 * ricocheting), renormalized back to the character's cruise speed so they
 * never bleed energy into a slow hug. A distance-scaled homing bias curves
 * them toward the enemy only once they've drifted apart.
 */
export function steer(f: Fighter, target: Fighter | null, time: number, dt: number) {
  if (f.st.noSteer) return;

  const cruise = f.def.speed * (f.st.speedMult ?? 1);
  const v = f.body.velocity; // Matter tick-units
  let ang = Math.atan2(v.y, v.x);
  // A stationary ball (just spawned / knocked to rest) needs a seed heading.
  if (v.x === 0 && v.y === 0) ang = Math.atan2((target?.y ?? f.y + 1) - f.y, (target?.x ?? f.x) - f.x);

  if (target) {
    const dx = target.x - f.x, dy = target.y - f.y;
    const near = OV.near ?? MOVE.homeNear, far = OV.far ?? MOVE.homeFar, homeTurn = OV.turn ?? MOVE.homeTurn;
    const gap = Math.hypot(dx, dy) - f.def.radius - target.def.radius;
    const strength = clamp01((gap - near) / (far - near));
    if (strength > 0) {
      const want = Math.atan2(dy, dx) + Math.sin(time * 1.7 + f.id) * MOVE.wobble;
      let diff = want - ang;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = homeTurn * strength * dt;
      ang += Math.max(-turn, Math.min(turn, diff));
    }
  }

  Matter.Body.setVelocity(f.body, { x: Math.cos(ang) * cruise * VEL, y: Math.sin(ang) * cruise * VEL });
}

function clamp01(n: number) {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
