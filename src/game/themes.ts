import { Container, Graphics, Text } from "pixi.js";
import { ARENA_SIZE, ARENA_X, ARENA_Y, VIEW_H, VIEW_W, WATERMARK } from "./constants";
import type { ThemeId } from "./types";
import { heart } from "./weaponArt";

/** Draw one theme icon centered at 0,0 into g with given size and color. */
function icon(g: Graphics, theme: ThemeId, s: number, color: number) {
  switch (theme) {
    case "bones": {
      g.roundRect(-s * 0.55, -s * 0.13, s * 1.1, s * 0.26, s * 0.13).fill(color);
      for (const end of [-1, 1]) {
        g.circle(end * s * 0.55, -s * 0.14, s * 0.17).fill(color);
        g.circle(end * s * 0.55, s * 0.14, s * 0.17).fill(color);
      }
      break;
    }
    case "hearts":
      heart(g, 0, 0, s * 0.8, color, color);
      break;
    case "rings":
      g.circle(0, 0, s * 0.5).stroke({ width: s * 0.16, color });
      break;
    case "gears": {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.rect(Math.cos(a) * s * 0.48 - s * 0.08, Math.sin(a) * s * 0.48 - s * 0.08, s * 0.16, s * 0.16).fill(color);
      }
      g.circle(0, 0, s * 0.42).fill(color);
      g.circle(0, 0, s * 0.16).cut();
      break;
    }
    case "snow": {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        g.moveTo(-Math.cos(a) * s * 0.5, -Math.sin(a) * s * 0.5)
          .lineTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5)
          .stroke({ width: s * 0.1, color });
      }
      break;
    }
    case "speed": {
      for (let i = 0; i < 3; i++) {
        const x = -s * 0.4 + i * s * 0.34;
        g.poly([x, -s * 0.32, x + s * 0.26, 0, x, s * 0.32, x + s * 0.1, 0]).fill(color);
      }
      break;
    }
    case "clouds": {
      g.circle(-s * 0.25, 0, s * 0.25).fill(color);
      g.circle(s * 0.05, -s * 0.12, s * 0.3).fill(color);
      g.circle(s * 0.35, 0.04 * s, s * 0.22).fill(color);
      g.rect(-s * 0.25, 0, s * 0.6, s * 0.24).fill(color);
      break;
    }
    case "embers":
      g.poly([0, -s * 0.5, s * 0.32, s * 0.3, 0, s * 0.12, -s * 0.32, s * 0.3]).fill(color);
      break;
    case "stars": {
      const pts: number[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const r = i % 2 === 0 ? s * 0.5 : s * 0.22;
        pts.push(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.poly(pts).fill(color);
      break;
    }
    case "bamboo": {
      g.roundRect(-s * 0.12, -s * 0.5, s * 0.24, s, s * 0.1).fill(color);
      g.rect(-s * 0.16, -s * 0.1, s * 0.32, s * 0.05).fill(color);
      break;
    }
    case "crosshair":
      g.circle(0, 0, s * 0.4).stroke({ width: s * 0.09, color });
      g.moveTo(-s * 0.55, 0).lineTo(s * 0.55, 0).stroke({ width: s * 0.09, color });
      g.moveTo(0, -s * 0.55).lineTo(0, s * 0.55).stroke({ width: s * 0.09, color });
      break;
    case "plain":
      break;
  }
}

/** Static background: gray letterbox with big theme decorations, white arena card. */
export function buildBackground(theme: ThemeId): Container {
  const c = new Container();

  const bg = new Graphics();
  bg.rect(0, 0, VIEW_W, VIEW_H).fill(0xd6d3cf);
  c.addChild(bg);

  // Big faint outline decorations scattered across the letterbox
  if (theme !== "plain") {
    const deco = new Graphics();
    const cells = [
      [90, 140], [420, 60], [830, 130], [1000, 320], [70, 420], [980, 640],
      [80, 900], [1010, 1060], [90, 1330], [990, 1440], [240, 1740], [620, 1800], [930, 1760],
      [420, 1560],
    ];
    cells.forEach(([x, y], i) => {
      const g = new Graphics();
      icon(g, theme, 90 + (i % 3) * 40, 0xbdb9b3);
      g.position.set(x, y);
      g.rotation = (i * 1.7) % (Math.PI * 2);
      g.alpha = 0.55;
      deco.addChild(g as any);
      c.addChild(g);
    });
    c.addChild(deco);
  }

  // Arena card: white with border
  const arena = new Graphics();
  arena.roundRect(ARENA_X - 4, ARENA_Y - 4, ARENA_SIZE + 8, ARENA_SIZE + 8, 10)
    .fill(0xffffff)
    .stroke({ width: 5, color: 0x2b2b31 });
  c.addChild(arena);

  // Faint theme pattern inside the arena
  if (theme !== "plain") {
    for (let i = 0; i < 6; i++) {
      const g = new Graphics();
      icon(g, theme, 120, 0xf0ede8);
      g.position.set(
        ARENA_X + 120 + (i % 3) * ((ARENA_SIZE - 240) / 2),
        ARENA_Y + 160 + Math.floor(i / 3) * (ARENA_SIZE - 320),
      );
      g.alpha = 0.8;
      c.addChild(g);
    }
  }

  // Watermark
  const wm = new Text({
    text: WATERMARK,
    style: { fontFamily: "Trebuchet MS, Verdana, sans-serif", fontSize: 26, fill: 0xcac6c0, fontWeight: "700" },
  });
  wm.anchor.set(0.5);
  wm.position.set(ARENA_X + ARENA_SIZE / 2, ARENA_Y + ARENA_SIZE / 2);
  c.addChild(wm);

  return c;
}
