import { Graphics } from "pixi.js";
import type { CharacterDef } from "./types";

/**
 * Pixel-art weapon sprites, Ball Thing style: chunky pixels, hard dark
 * outlines, 2–3 shades per material, bright edge highlights.
 *
 * Each sprite is a map of rows; every character is a palette key and '.' is
 * transparent. Sprites point RIGHT (+x) and are drawn centered on the physics
 * body's center, sized so the sprite width matches the weapon's length.
 */

type Pal = Record<string, number>;

const OUT = 0x23262e;      // outline
const STEEL = 0xd9dfe9;    // blade light
const STEEL2 = 0x9ba6b6;   // blade shade
const SHINE = 0xffffff;
const WOOD = 0x8a5c33;
const WOOD2 = 0x5f3e20;

function drawMap(g: Graphics, rows: string[], pal: Pal, size: number) {
  const h = rows.length;
  const w = rows[0].length;
  const ox = -(w * size) / 2;
  const oy = -(h * size) / 2;
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const c = row[x];
      if (c === ".") continue;
      const col = pal[c];
      if (col === undefined) continue;
      g.rect(ox + x * size, oy + y * size, size + 0.5, size + 0.5).fill(col);
    }
  }
}

/* ------------------------------------------------------------------ */
/* sprite maps                                                          */
/* ------------------------------------------------------------------ */

const GREATSWORD = [
  "........###......................",
  "..###...#C#......................",
  ".#PP#...#C#######################",
  ".#P.#####C#SSSSSSSSSSSSSSSSSS##..",
  ".#P.GgGg#C#wwwwwwwwwwwwwwwwwSS#..",
  ".#P.#####C#ssssssssssssssssss##..",
  ".#PP#...#C#######################",
  "..###...#C#......................",
  "........###......................",
];
const KATANA = [
  "............####.................",
  "...........##CC##................",
  ".#######...#C##C################.",
  ".#GgGgG#####C##C#SSSSSSSSSSSSS##.",
  ".#gGgGg#...#C##C#wwwwwwwwwwwwSS#.",
  ".#######...#C##C###############..",
  "...........##CC##................",
  "............####.................",
];
const AXE = [
  "..................###.......",
  ".................#CCC##.....",
  ".................#CCCC##....",
  ".................#CCCCC#....",
  ".................#CCCCC##...",
  ".######..........#CCCCSw#...",
  ".#hHhH############CCCCSSw#..",
  ".#HhHhWWWWWWWWWWWWCCCCSSw#..",
  ".#hHhH############CCCCSSw#..",
  ".................#CCCCSw#...",
  ".................#CCCCC##...",
  ".................#CCCCC#....",
  ".................#CCCC##....",
  ".................#CCC##.....",
  "..................###.......",
];
const CHAINSAW = [
  "...#..#..#..#..#..#..#..#..#....",
  "..#################a#########...",
  ".##sssssssssssssssssssssssss##..",
  ".#sRRsSSSSSSSsRRsSSSSSSSSsRRs#..",
  "##sRRsSSSSSSSsRRsSSSSSSSSsRRs##.",
  ".#sRRsSSSSSSSsRRsSSSSSSSSsRRs#..",
  ".##sssssssssssssssssssssssss##..",
  "..#################a#########...",
  "...#..#..#..#..#..#..#..#..#....",
];
const STAFF = [
  "..................................",
  "#####============================#",
  "#GgG#RRRRRRRRRRRRRRRRRRRRRR#GgG##.",
  "#gGg#RrRrRrRrRrRrRrRrRrRrRr#gGg##.",
  "#GgG#RRRRRRRRRRRRRRRRRRRRRR#GgG##.",
  "#####============================#",
  "..................................",
];
const REVOLVER = [
  "..................",
  ".####.............",
  ".#ss############..",
  ".#sSSSSSSSSSSSSs#.",
  ".#ss##CCCC#####s#.",
  "..#G##CCCC#.......",
  "..#GG#####........",
  "..#GGG#...........",
  "..#GGG#...........",
  "...####...........",
];
const RAILGUN = [
  "....................",
  ".####..####..####...",
  ".#CC####CC####CC###.",
  "##nnnnnnnnnnnnnnnnn#",
  "#nwwwwwwwwwwwwwwwwb#",
  "##nnnnnnnnnnnnnnnnn#",
  ".#CC####CC####CC###.",
  ".####..####..####...",
  "....................",
];
const RAPIER = [
  "......####......................",
  ".....#CCCC#.....................",
  ".####*CCCC######################",
  ".#GgG*CC.CC#SSSSSSSSSSSSSSSSSS#.",
  ".####*CCCC######################",
  ".....#CCCC#.....................",
  "......####......................",
];
const KNIFE = [
  "..................",
  ".#######..........",
  ".#GGGGG###########",
  ".#GgGgG#SSSSSSSS##",
  ".#GGGGG#SSwwwwwSS#",
  ".#######SSSSSSS##.",
  "........########..",
  "..................",
];
const WAND = [
  "................####....",
  "..............##CCCC##..",
  ".............#CC#wwCCC#.",
  ".############CCCCCCCCCC#",
  ".#VvVvVvVvVv#CCCCCCCCCC#",
  ".############.#CCCCCC#..",
  "................#CCC#...",
  ".................#C#....",
  "..................#.....",
];
const ICEBLADE = [
  "...........................",
  ".#####.....................",
  ".#DdD######################",
  ".#dDd#IIIIiiIIIIIIiiIII##..",
  ".#DdD#wwIIIIIIwwIIIIIIII#..",
  ".#dDd#iiIIIIIIIIIIIIII##...",
  ".#####################.....",
  "...........................",
];
const GAVEL = [
  "..................######....",
  "..................#CCCC#....",
  ".................##HHHH##...",
  ".................#HwwwwH#...",
  ".#####............#HHHH#....",
  ".#WwW#############HHHHHH#...",
  ".#wWwWWWWWWWWWWWWWHHHHHH#...",
  ".#WwW#############HHHHHH#...",
  ".#####............#HHHH#....",
  ".................#HwwwwH#...",
  ".................##HHHH##...",
  "..................#CCCC#....",
  "..................######....",
];
const GOLDSWORD = [
  "........###.....................",
  "..###...#C#.....................",
  ".#CC#..##C##....................",
  ".#C.####CCC##GGGGG##GGGGG##GG##.",
  ".#C.gGgG#C#GgwwwwwGGwwwwwGGwG##.",
  ".#C.####CCC##GGGGG##GGGGG##GG##.",
  ".#CC#..##C##....................",
  "..###...#C#.....................",
  "........###.....................",
];
const BOLT = [
  "............................",
  ".#####......................",
  ".#CcC###....................",
  ".#cCc#YY####................",
  ".#CcC#YYYYYY####............",
  ".#cCc#wwYYYYYYYY####........",
  ".#CcC#YYYYwwwwYYYYYY####....",
  ".#cCc#..####YYYYwwwwYYYY##..",
  ".#CcC#......####YYYYYYYY#...",
  ".#####..........####YY##....",
  "..................####......",
];
const SHURIKEN = [
  "...#...",
  "..#S#..",
  ".#SsS#.",
  "#SsCsS#",
  ".#SsS#.",
  "..#S#..",
  "...#...",
];

/* ------------------------------------------------------------------ */

export function drawWeaponGraphic(def: CharacterDef): Graphics {
  const g = new Graphics();
  const w = def.weapon;
  const C = def.color, D = def.dark;

  const base: Pal = {
    "#": OUT, S: STEEL, s: STEEL2, w: SHINE,
    W: WOOD, // wood light
    C, D,
  };

  switch (w.kind) {
    case "blade": {
      const L = w.length;
      switch (w.style) {
        case "sword":
          drawMap(g, GOLDSWORD, { ...base, G: 0xe8c458, g: 0x8a6a1a, c: shade(C, -30) }, L / 30);
          break;
        case "greatsword":
          drawMap(g, GREATSWORD, { ...base, P: C, G: WOOD, g: WOOD2 }, L / 30);
          break;
        case "katana":
          drawMap(g, KATANA, { ...base, G: 0x2a2d36, g: 0x14161c, C: 0xc9a44a }, L / 30);
          break;
        case "axe":
          drawMap(g, AXE, { ...base, H: WOOD, h: WOOD2, W: WOOD }, L / 30);
          break;
        case "dagger":
          drawMap(g, KNIFE, { ...base, G: 0x4a3b2a, g: 0x2e2418 }, L / 16);
          break;
        case "rapier":
          drawMap(g, RAPIER, { ...base, G: 0x3a3f4d, g: 0x23262e, "*": shade(C, -35) }, L / 30);
          break;
        case "wand":
          drawMap(g, WAND, { ...base, V: 0x7a4a68, v: 0x54324a }, L / 22);
          break;
        case "iceblade":
          drawMap(g, ICEBLADE, { ...base, I: 0xcdeefc, i: 0x9fd8e8, D: 0x6ea8bc, d: 0x548ba0, "#": 0x2e6474 }, L / 24);
          break;
        case "gavel":
          drawMap(g, GAVEL, { ...base, H: 0x9a7448, h: 0x6b4a2f, C: 0xf0ead8, W: WOOD }, L / 26);
          break;
        case "chainsaw":
          drawMap(g, CHAINSAW, { ...base, R: 0xd33b2f, r: 0x8f1f16, a: OUT, s: 0x6f7b8c, S: 0x9aa5b5 }, L / 30);
          break;
        case "bolt":
          drawMap(g, BOLT, { ...base, Y: 0xf6d33c, y: 0xc9a41a, c: shade(C, -30) }, L / 26);
          break;
        case "hammer":
        case "scythe":
          // fallback chunky bar for unused styles
          drawMap(g, KNIFE, { ...base, G: 0x4a3b2a, g: 0x2e2418 }, L / 16);
          break;
      }
      break;
    }
    case "gun": {
      const L = w.length;
      if (w.style === "revolver") {
        drawMap(g, REVOLVER, { ...base, G: 0x6b4326, C: 0x4a505e }, L / 16);
      } else {
        drawMap(g, RAILGUN, { ...base, n: 0x39405a, b: 0x9fd8ff }, L / 18);
      }
      break;
    }
    case "staff": {
      drawMap(g, STAFF, {
        "#": 0x2b1a12, "=": 0x2b1a12,
        R: 0xb32828, r: 0x7c1717,
        G: 0xe0b53c, g: 0x9c7a1e,
      }, w.length / 33);
      break;
    }
    case "orbitals": {
      for (let i = 0; i < w.count; i++) {
        const a = (i / w.count) * Math.PI * 2;
        const x = Math.cos(a) * w.dist, y = Math.sin(a) * w.dist;
        const g2 = new Graphics();
        drawMap(g2, SHURIKEN, { "#": OUT, S: STEEL, s: STEEL2, C: C }, (w.radius * 2.4) / 7);
        g2.position.set(x, y);
        g2.rotation = a;
        g.addChild(g2);
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
      g.poly(pts).fill(STEEL2).stroke({ width: 3.5, color: OUT });
      g.circle(0, 0, R * 0.34).fill(C).stroke({ width: 3, color: D });
      break;
    }
    case "none":
      break;
  }
  return g;
}

/** Lighten (+) / darken (-) a color. */
function shade(hex: number, amt: number): number {
  const r = Math.max(0, Math.min(255, ((hex >> 16) & 255) + amt));
  const gg = Math.max(0, Math.min(255, ((hex >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (hex & 255) + amt));
  return (r << 16) | (gg << 8) | b;
}

/** Heart shape used by Magia's projectiles and the hearts theme. */
export function heart(g: Graphics, x: number, y: number, s: number, color: number, dark: number) {
  g.moveTo(x, y + s * 0.35)
    .bezierCurveTo(x - s, y - s * 0.4, x - s * 0.5, y - s, x, y - s * 0.35)
    .bezierCurveTo(x + s * 0.5, y - s, x + s, y - s * 0.4, x, y + s * 0.35)
    .fill(color).stroke({ width: 3, color: dark });
}
