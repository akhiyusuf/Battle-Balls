import type { Rng } from "./rng";
import { SHAKE_CAP } from "./tuning";

export interface Particle { x: number; y: number; vx: number; vy: number; t: number; life: number; size: number; color: number }
export interface Ring { x: number; y: number; r: number; max: number; w: number; color: number; t: number; life: number }
export interface Popup { x: number; y: number; vy: number; t: number; life: number; text: string; color: number; crit: boolean }
export interface Beam { x: number; y: number; angle: number; length: number; width: number; color: number; t: number; life: number }
export interface Callout { text: string; color: number; t: number; life: number }

/**
 * All transient visual effects: particles, expanding rings, floating damage
 * numbers, beams, ult callouts, and screen shake. Owns its own arrays and
 * advances them; the engine just spawns into it and the renderer reads it.
 */
export class Fx {
  particles: Particle[] = [];
  rings: Ring[] = [];
  popups: Popup[] = [];
  beams: Beam[] = [];
  callouts: Callout[] = [];
  shake = 0;

  constructor(private rng: Rng) {}

  burst(x: number, y: number, n: number, color: number, spd: number) {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2), s = this.rng.range(spd * 0.3, spd);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        t: 0, life: this.rng.range(0.25, 0.55), size: this.rng.range(2, 6), color,
      });
    }
  }

  ring(x: number, y: number, max: number, color: number, w = 6) {
    this.rings.push({ x, y, r: 8, max, w, color, t: 0, life: 0.4 });
  }

  beam(x: number, y: number, angle: number, length: number, width: number, color: number) {
    this.beams.push({ x, y, angle, length, width, color, t: 0, life: 0.4 });
  }

  popup(x: number, y: number, text: string, color: number, crit: boolean) {
    this.popups.push({ x, y, vy: -110, t: 0, life: crit ? 0.85 : 0.75, text, color, crit });
  }

  callout(text: string, color: number) {
    this.callouts.push({ text, color, t: 0, life: 1.4 });
  }

  addShake(n: number) {
    this.shake = Math.min(SHAKE_CAP, this.shake + n);
  }

  update(dt: number) {
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
  }
}
