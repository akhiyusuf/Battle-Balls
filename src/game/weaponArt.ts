import { Graphics } from "pixi.js";
import type { CharacterDef } from "./types";

/**
 * Draws a weapon in body-local coordinates (centered on the physics body,
 * pointing along +x). Flat colors + dark outlines, Ball Thing style.
 */
export function drawWeaponGraphic(def: CharacterDef): Graphics {
  const g = new Graphics();
  const w = def.weapon;
  const C = def.color, D = def.dark;

  switch (w.kind) {
    case "blade": {
      const L = w.length, W = w.width, x0 = -L / 2;
      switch (w.style) {
        case "sword":
        case "greatsword": {
          const bladeStart = x0 + L * 0.22, tip = L / 2;
          // pommel
          g.circle(x0, 0, W * 0.42).fill(C).stroke({ width: 3, color: D });
          // wrapped grip
          g.rect(x0, -W * 0.22, L * 0.18, W * 0.44).fill(0x5a3d26).stroke({ width: 3, color: D });
          for (let i = 1; i < 4; i++) g.moveTo(x0 + L * 0.045 * i, -W * 0.22).lineTo(x0 + L * 0.045 * i, W * 0.22).stroke({ width: 1.5, color: 0x2e1e12 });
          // crossguard with beveled ends
          g.poly([x0 + L * 0.16, -W * 1.0, x0 + L * 0.23, -W * 0.72, x0 + L * 0.23, W * 0.72, x0 + L * 0.16, W * 1.0])
            .fill(C).stroke({ width: 3, color: D });
          // steel blade, tapered to a point
          g.poly([
            bladeStart, -W * 0.55, tip - W * 1.0, -W * 0.5, tip, 0,
            tip - W * 1.0, W * 0.5, bladeStart, W * 0.55,
          ]).fill(0xd7dce6).stroke({ width: 3.5, color: D });
          // bright edges + central fuller
          g.moveTo(bladeStart, -W * 0.42).lineTo(tip - W * 1.1, -W * 0.38).stroke({ width: 2, color: 0xffffff });
          g.moveTo(bladeStart + L * 0.02, 0).lineTo(tip - W * 1.2, 0).stroke({ width: 2, color: 0x9aa2b2 });
          break;
        }
        case "katana": {
          const guard = x0 + L * 0.2, tip = L / 2;
          // dark bound handle
          g.rect(x0, -W * 0.2, L * 0.2, W * 0.4).fill(0x1f2228).stroke({ width: 3, color: D });
          for (let i = 1; i < 4; i++) g.moveTo(x0 + L * 0.05 * i, -W * 0.2).lineTo(x0 + L * 0.05 * i, W * 0.2).stroke({ width: 1.5, color: 0x0e0f13 });
          // round tsuba guard
          g.circle(guard, 0, W * 0.62).fill(0xc9a44a).stroke({ width: 3, color: D });
          // single-edged curved blade (gentle upward curve)
          g.poly([
            guard, -W * 0.34, tip - W * 1.2, -W * 0.62, tip, -W * 0.18,
            tip - W * 1.1, W * 0.05, guard, W * 0.3,
          ]).fill(0xeef2f8).stroke({ width: 3, color: D });
          // hamon edge line
          g.moveTo(guard + L * 0.02, -W * 0.22).lineTo(tip - W * 1.1, -W * 0.46).stroke({ width: 2, color: 0xffffff });
          break;
        }
        case "axe": {
          const hx = L / 2 - W * 0.5;
          // wooden haft
          g.rect(x0, -W * 0.16, L * 0.95, W * 0.32).fill(0x7a5230).stroke({ width: 3, color: D });
          g.rect(x0, -W * 0.16, L * 0.95, W * 0.1).fill(0x94663d); // top highlight
          // big crescent axe head
          g.poly([
            hx - W * 0.4, -W * 1.35, hx + W * 0.9, -W * 0.75,
            hx + W * 1.05, 0, hx + W * 0.9, W * 0.75, hx - W * 0.4, W * 1.35,
            hx + W * 0.15, 0,
          ]).fill(C).stroke({ width: 3.5, color: D });
          // bright cutting edge
          g.moveTo(hx + W * 0.9, -W * 0.72).lineTo(hx + W * 1.02, 0).lineTo(hx + W * 0.9, W * 0.72).stroke({ width: 2.5, color: 0xffffff });
          // top spike
          g.poly([hx - W * 0.1, -W * 1.3, hx + W * 0.25, -W * 1.85, hx + W * 0.35, -W * 1.2]).fill(C).stroke({ width: 2.5, color: D });
          break;
        }
        case "dagger": {
          g.rect(x0, -W * 0.3, L * 0.28, W * 0.6).fill(0x3a3f4d).stroke({ width: 3, color: D });
          g.poly([x0 + L * 0.3, -W * 0.5, L / 2 - W * 0.5, -W * 0.2, L / 2, 0, L / 2 - W * 0.5, W * 0.2, x0 + L * 0.3, W * 0.5])
            .fill(0xd8dce4).stroke({ width: 3, color: D });
          break;
        }
        case "rapier": {
          g.circle(x0 + L * 0.13, 0, W * 0.8).fill(C).stroke({ width: 3, color: D });
          g.rect(x0, -W * 0.2, L * 0.14, W * 0.4).fill(0x3a3f4d).stroke({ width: 2, color: D });
          g.rect(x0 + L * 0.2, -W * 0.14, L * 0.78, W * 0.28).fill(0xe4e7ee).stroke({ width: 2.5, color: D });
          break;
        }
        case "hammer": {
          g.rect(x0, -W * 0.14, L * 0.8, W * 0.28).fill(0x8a6a45).stroke({ width: 3, color: D });
          g.rect(L / 2 - W * 1.15, -W * 0.85, W * 1.3, W * 1.7).fill(C).stroke({ width: 3.5, color: D });
          break;
        }
        case "scythe": {
          g.rect(x0, -W * 0.15, L * 0.9, W * 0.3).fill(0x5c5468).stroke({ width: 3, color: D });
          g.poly([L / 2 - W * 0.4, -W * 1.4, L / 2 + W * 0.5, -W * 0.4, L / 2 - W * 0.1, W * 0.1, L / 2 - W * 0.8, -W * 0.5])
            .fill(0xd8dce4).stroke({ width: 3, color: D });
          break;
        }
        case "wand": {
          g.rect(x0, -W * 0.18, L * 0.82, W * 0.36).fill(0x8a5a7a).stroke({ width: 3, color: D });
          heart(g, L / 2 - W * 0.2, 0, W * 1.05, C, D);
          break;
        }
        case "iceblade": {
          g.poly([x0, -W * 0.25, L / 2 - W, -W * 0.55, L / 2, 0, L / 2 - W, W * 0.55, x0, W * 0.25])
            .fill(0xcdeefc).stroke({ width: 3, color: D });
          g.moveTo(x0 + L * 0.2, 0).lineTo(L / 2 - W * 1.2, 0).stroke({ width: 2, color: 0x9fd8ef });
          break;
        }
        case "gavel": {
          g.rect(x0, -W * 0.15, L * 0.78, W * 0.3).fill(0x7a5a3a).stroke({ width: 3, color: D });
          g.rect(L / 2 - W * 1.05, -W * 0.75, W * 1.25, W * 1.5).fill(0x9a7448).stroke({ width: 3.5, color: D });
          g.rect(L / 2 - W * 1.18, -W * 0.85, W * 0.22, W * 1.7).fill(C).stroke({ width: 2, color: D });
          g.rect(L / 2 + W * 0.05, -W * 0.85, W * 0.22, W * 1.7).fill(C).stroke({ width: 2, color: D });
          break;
        }
        case "chainsaw": {
          // gray bar with zigzag tooth outline + sprocket hubs (Shredder)
          g.roundRect(x0, -W * 0.5, L, W, W * 0.5).fill(0x8d99ae).stroke({ width: 4, color: 0x1e222b });
          const teeth = 9;
          for (let i = 0; i < teeth; i++) {
            const tx = x0 + (i + 0.5) * (L / teeth);
            g.poly([tx - 5, -W * 0.5 - 1, tx, -W * 0.5 - 8, tx + 5, -W * 0.5 - 1]).fill(0x1e222b);
            g.poly([tx - 5, W * 0.5 + 1, tx, W * 0.5 + 8, tx + 5, W * 0.5 + 1]).fill(0x1e222b);
          }
          for (const hx of [x0 + L * 0.08, 0, x0 + L * 0.92]) {
            g.poly([hx - 8, 0, hx, -8, hx + 8, 0, hx, 8]).fill(0xd33b2f).stroke({ width: 2, color: 0x1e222b });
            g.circle(hx, 0, 2.6).fill(0x1e222b);
          }
          break;
        }
        case "bolt": {
          g.poly([x0, -W * 0.2, x0 + L * 0.4, -W * 0.55, x0 + L * 0.35, -W * 0.1,
            L / 2, -W * 0.3, x0 + L * 0.5, W * 0.5, x0 + L * 0.55, W * 0.05, x0, W * 0.25])
            .fill(C).stroke({ width: 3, color: D });
          break;
        }
      }
      break;
    }
    case "gun": {
      const L = w.length, W = w.width, x0 = -L / 2;
      if (w.style === "revolver") {
        g.rect(x0, W * 0.1, L * 0.22, W * 0.75).fill(0x7a5230).stroke({ width: 3, color: D }); // grip
        g.rect(x0 + L * 0.14, -W * 0.42, L * 0.86, W * 0.62).fill(0x4a505e).stroke({ width: 3, color: D }); // frame+barrel
        g.roundRect(x0 + L * 0.3, -W * 0.55, L * 0.24, W * 0.9, 4).fill(0x394050).stroke({ width: 3, color: D }); // cylinder
        g.rect(L / 2 - L * 0.1, -W * 0.5, L * 0.1, W * 0.24).fill(0x4a505e).stroke({ width: 2, color: D }); // sight
      } else {
        g.rect(x0, -W * 0.3, L, W * 0.6).fill(0x46506b).stroke({ width: 3, color: D });
        for (let i = 0; i < 4; i++) {
          const cx = x0 + L * (0.3 + i * 0.16);
          g.rect(cx, -W * 0.5, L * 0.06, W).fill(C).stroke({ width: 2, color: D });
        }
        g.rect(L / 2 - L * 0.08, -W * 0.18, L * 0.08, W * 0.36).fill(0x9fd8ef);
      }
      break;
    }
    case "saw": {
      const R = w.radius;
      const teeth = w.teeth;
      const pts: number[] = [];
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? R : R * 0.82;
        pts.push(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.poly(pts).fill(0xb8bfcc).stroke({ width: 3.5, color: 0x2a2e38 });
      g.circle(0, 0, R * 0.34).fill(C).stroke({ width: 3, color: D });
      g.circle(0, 0, R * 0.1).fill(0x2a2e38);
      break;
    }
    case "staff": {
      // Monkey King's Ruyi Jingu Bang: crimson shaft, serrated edges, gold caps
      const L = w.length, W = w.width, x0 = -L / 2;
      g.rect(x0, -W / 2, L, W).fill(0xb32828).stroke({ width: 3.5, color: 0x2b1a12 });
      const notches = Math.max(6, Math.floor(L / 46));
      for (let i = 0; i < notches; i++) {
        const nx = x0 + L * 0.18 + (i + 0.5) * ((L * 0.64) / notches);
        g.poly([nx - 4, -W / 2, nx + 4, -W / 2, nx, -W / 2 - 6]).fill(0x2b1a12);
        g.poly([nx - 4, W / 2, nx + 4, W / 2, nx, W / 2 + 6]).fill(0x2b1a12);
      }
      for (const [cx, cw] of [[x0, L * 0.14], [L / 2 - L * 0.14, L * 0.14]] as const) {
        g.rect(cx, -W / 2 - 3, cw, W + 6).fill(0xe0b53c).stroke({ width: 3, color: 0x2b1a12 });
        g.moveTo(cx + cw / 2, -W / 2 - 3).lineTo(cx + cw / 2, W / 2 + 3).stroke({ width: 2, color: 0x8f6a1a });
      }
      break;
    }
    case "orbitals": {
      for (let i = 0; i < w.count; i++) {
        const a = (i / w.count) * Math.PI * 2;
        const x = Math.cos(a) * w.dist, y = Math.sin(a) * w.dist;
        g.circle(x, y, w.radius).fill(C).stroke({ width: 3, color: D });
        g.circle(x - w.radius * 0.25, y - w.radius * 0.25, w.radius * 0.3).fill(0xffffff).stroke({ width: 0, color: 0 });
      }
      break;
    }
    case "none":
      break;
  }
  return g;
}

export function heart(g: Graphics, x: number, y: number, s: number, color: number, dark: number) {
  g.moveTo(x, y + s * 0.35)
    .bezierCurveTo(x - s, y - s * 0.4, x - s * 0.5, y - s, x, y - s * 0.35)
    .bezierCurveTo(x + s * 0.5, y - s, x + s, y - s * 0.4, x, y + s * 0.35)
    .fill(color).stroke({ width: 3, color: dark });
}
