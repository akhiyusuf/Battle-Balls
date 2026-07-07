import { Application, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import type { Engine } from "./engine";
import type { Fighter } from "./fighter";
import { ARENA_SIZE, ARENA_X, ARENA_Y, METER_MAX, VIEW_H, VIEW_W } from "./constants";
import { buildBackground } from "./themes";
import { drawWeaponGraphic, heart } from "./weaponArt";

const FONT = '"Trebuchet MS", Verdana, sans-serif';

interface FighterView {
  f: Fighter;
  root: Container;
  aura: Graphics;
  ball: Graphics;
  flash: Graphics;
  shield: Graphics;
  hpText: Text;
  weapon?: Sprite;
  ghosts: Sprite[];
  // bottom UI
  barBg?: Graphics;
  barFill?: Graphics;
  barLabel?: Text;
  statTexts: Text[];
  nameText?: Text;
}

export class GameRenderer {
  app!: Application;
  private root = new Container();
  private bgHolder = new Container();
  private arenaContent = new Container();
  private trailG = new Graphics();
  private ghostLayer = new Container();
  private weaponLayer = new Container();
  private ballLayer = new Container();
  private fxG = new Graphics();
  private uiLayer = new Container();
  private popupLayer = new Container();
  private overlay = new Container();
  private views: FighterView[] = [];
  private popupPool: Text[] = [];
  private calloutText!: Text;
  private calloutSub!: Text;
  private centerText!: Text;
  private winnerSub!: Text;
  private dim!: Graphics;

  async init(): Promise<HTMLCanvasElement> {
    this.app = new Application();
    await this.app.init({
      width: VIEW_W,
      height: VIEW_H,
      background: 0xd6d3cf,
      antialias: true,
      preference: "webgl",
    });

    const mask = new Graphics().rect(ARENA_X, ARENA_Y, ARENA_SIZE, ARENA_SIZE).fill(0xffffff);
    this.arenaContent.mask = mask;
    this.arenaContent.addChild(this.trailG, this.ghostLayer, this.weaponLayer, this.ballLayer, this.fxG);

    this.dim = new Graphics().rect(0, 0, VIEW_W, VIEW_H).fill({ color: 0x1a1a20, alpha: 0.45 });
    this.dim.visible = false;

    this.calloutText = this.makeText(64, 0xffffff, 0x222222, 8);
    this.calloutText.position.set(VIEW_W / 2, ARENA_Y + ARENA_SIZE / 2 - 40);
    this.calloutSub = this.makeText(34, 0xffffff, 0x222222, 6);
    this.calloutSub.position.set(VIEW_W / 2, ARENA_Y + ARENA_SIZE / 2 + 26);
    this.centerText = this.makeText(150, 0xffe259, 0x2b2b31, 12);
    this.centerText.position.set(VIEW_W / 2, ARENA_Y + ARENA_SIZE / 2);
    this.winnerSub = this.makeText(56, 0xffffff, 0x2b2b31, 8);
    this.winnerSub.position.set(VIEW_W / 2, ARENA_Y + ARENA_SIZE / 2 + 120);
    this.overlay.addChild(this.dim, this.calloutText, this.calloutSub, this.centerText, this.winnerSub);

    this.root.addChild(this.bgHolder, this.arenaContent, mask, this.uiLayer, this.popupLayer, this.overlay);
    this.app.stage.addChild(this.root);
    return this.app.canvas;
  }

  private makeText(size: number, fill: number, stroke: number, strokeW: number): Text {
    const t = new Text({
      text: "",
      style: {
        fontFamily: FONT, fontSize: size, fontWeight: "900", fill,
        stroke: { color: stroke, width: strokeW, join: "round" },
        align: "center",
      },
    });
    t.anchor.set(0.5);
    return t;
  }

  /** Rebuild all per-fighter visuals for a fresh engine. */
  bind(engine: Engine) {
    this.bgHolder.removeChildren();
    const theme = engine.roster[Math.floor(engine.rng.next() * engine.roster.length)]?.def.theme ?? "plain";
    this.bgHolder.addChild(buildBackground(theme));

    this.ghostLayer.removeChildren();
    this.weaponLayer.removeChildren();
    this.ballLayer.removeChildren();
    this.uiLayer.removeChildren();
    for (const v of this.views) v.root.destroy({ children: true });
    this.views = [];

    for (const f of engine.fighters) this.addFighterView(f, engine);
    this.buildBottomUi(engine);
    this.buildNames(engine);
  }

  private weaponTexture(f: Fighter): Texture {
    const g = drawWeaponGraphic(f.def);
    return this.app.renderer.generateTexture({ target: g, resolution: 2 });
  }

  addFighterView(f: Fighter, _engine: Engine) {
    const root = new Container();
    const r = f.def.radius;

    const aura = new Graphics().circle(0, 0, r + 16).fill({ color: 0xffffff, alpha: 0.4 });
    aura.visible = false;

    const ball = new Graphics();
    ball.circle(0, 0, r).fill(f.def.color).stroke({ width: 6, color: f.def.dark });
    // small top-left sheen, flat-style
    ball.circle(-r * 0.35, -r * 0.38, r * 0.16).fill({ color: 0xffffff, alpha: 0.35 });

    const flash = new Graphics().circle(0, 0, r).fill(0xffffff);
    flash.alpha = 0;

    const shield = new Graphics().circle(0, 0, r + 10).stroke({ width: 5, color: 0xd8ffe8, alpha: 0.9 });
    shield.visible = false;

    const hpText = this.makeText(Math.round(r * 0.95), 0xffffff, f.def.dark, 6);
    hpText.text = String(f.hp);

    root.addChild(aura, ball, flash, shield, hpText);
    this.ballLayer.addChild(root);

    const view: FighterView = { f, root, aura, ball, flash, shield, hpText, ghosts: [], statTexts: [] };

    if (f.def.weapon.kind !== "none") {
      const tex = this.weaponTexture(f);
      const spr = new Sprite(tex);
      spr.anchor.set(0.5);
      this.weaponLayer.addChild(spr);
      view.weapon = spr;
      for (let i = 0; i < 4; i++) {
        const g = new Sprite(tex);
        g.anchor.set(0.5);
        g.alpha = 0.1 + i * 0.04;
        this.ghostLayer.addChild(g);
        view.ghosts.push(g);
      }
    }
    this.views.push(view);
  }

  private buildBottomUi(engine: Engine) {
    const roster = engine.roster;
    const two = roster.length === 2;
    const barW = two ? 470 : 470;
    const barH = two ? 42 : 34;
    const topY = ARENA_Y + ARENA_SIZE + 52;

    roster.forEach((f, i) => {
      const v = this.views.find(x => x.f === f)!;
      const col = two ? i : i % 2;
      const row = two ? 0 : Math.floor(i / 2);
      const x = col === 0 ? 40 : VIEW_W - 40 - barW;
      const y = topY + row * (barH + (roster.length > 4 ? 78 : 96));
      const rightAlign = col === 1;

      const bg = new Graphics().roundRect(x, y, barW, barH, 6).fill(0x3c3a42).stroke({ width: 4, color: 0x232128 });
      const fill = new Graphics();
      const label = new Text({
        text: f.def.ult.name,
        style: {
          fontFamily: FONT, fontSize: barH * 0.52, fontWeight: "900", fill: 0xffffff,
          stroke: { color: 0x232128, width: 4, join: "round" },
        },
      });
      label.anchor.set(rightAlign ? 1 : 0, 0.5);
      label.position.set(rightAlign ? x + barW - 12 : x + 12, y + barH / 2);

      v.barBg = bg;
      v.barFill = fill;
      v.barLabel = label;
      this.uiLayer.addChild(bg, fill, label);

      const statLines = f.def.stats(f);
      statLines.forEach((_, si) => {
        const t = new Text({
          text: "",
          style: {
            fontFamily: FONT, fontSize: roster.length > 4 ? 26 : 32, fontWeight: "900",
            fill: f.def.color, stroke: { color: f.def.dark, width: 4, join: "round" },
          },
        });
        t.anchor.set(rightAlign ? 1 : 0, 0);
        t.position.set(rightAlign ? x + barW : x, y + barH + 8 + si * (roster.length > 4 ? 28 : 36));
        v.statTexts.push(t);
        this.uiLayer.addChild(t);
      });
    });
  }

  private buildNames(engine: Engine) {
    const roster = engine.roster;
    const two = roster.length === 2;
    roster.forEach((f, i) => {
      const v = this.views.find(x => x.f === f)!;
      const col = two ? i : i % 2;
      const row = two ? 0 : Math.floor(i / 2);
      const size = two ? 56 : roster.length > 4 ? 34 : 42;
      const t = new Text({
        text: f.def.name,
        style: {
          fontFamily: FONT, fontSize: size, fontWeight: "900", fill: f.def.color,
          stroke: { color: f.def.dark, width: 6, join: "round" },
        },
      });
      const y = two ? ARENA_Y - 92 : ARENA_Y - 60 - (Math.ceil(roster.length / 2) - 1 - row) * (size + 10) - 10;
      t.anchor.set(col === 0 ? 0 : 1, 0.5);
      t.position.set(col === 0 ? ARENA_X : ARENA_X + ARENA_SIZE, y + (two ? 0 : size / 2));
      v.nameText = t;
      this.uiLayer.addChild(t);
    });
  }

  /** Per-frame sync from engine state. */
  sync(e: Engine) {
    // screen shake
    const s = e.shake;
    this.root.position.set(s > 0 ? (Math.random() - 0.5) * s : 0, s > 0 ? (Math.random() - 0.5) * s : 0);

    for (const v of this.views) {
      const f = v.f;
      if (!f.alive) {
        v.root.visible = false;
        if (v.weapon) v.weapon.visible = false;
        v.ghosts.forEach(g => (g.visible = false));
        if (v.nameText) { v.nameText.style.fill = 0x9a978f; v.nameText.style.stroke = { color: 0x6b6862, width: 6, join: "round" }; }
      } else {
        v.root.visible = true;
        v.root.position.set(f.x, f.y);
        v.hpText.text = String(Math.max(0, Math.ceil(f.hp)));
        v.flash.alpha = f.flash > 0 ? Math.min(1, f.flash * 7) : 0;
        v.aura.visible = f.aura !== 0;
        if (f.aura) v.aura.tint = f.aura;
        v.shield.visible = f.shieldT > 0;

        if (v.weapon && f.weapon) {
          v.weapon.visible = true;
          v.weapon.position.set(f.weapon.position.x, f.weapon.position.y);
          v.weapon.rotation = f.weapon.angle;
          const ws = f.st.wsize ?? 1;
          v.weapon.scale.set(ws);
          // ghost trail
          for (let i = 0; i < v.ghosts.length; i++) {
            const gh = f.ghosts[f.ghosts.length - 2 - i * 2];
            const g = v.ghosts[i];
            if (gh) {
              g.visible = true;
              g.position.set(gh.x, gh.y);
              g.rotation = gh.angle;
              g.scale.set(ws);
            } else g.visible = false;
          }
        }
      }

      // bottom UI
      if (v.barFill && v.barBg) {
        const roster = e.roster;
        const two = roster.length === 2;
        const i = roster.indexOf(f);
        const col = two ? i : i % 2;
        const row = two ? 0 : Math.floor(i / 2);
        const barW = 470, barH = two ? 42 : 34;
        const x = col === 0 ? 40 : VIEW_W - 40 - barW;
        const y = ARENA_Y + ARENA_SIZE + 52 + row * (barH + (roster.length > 4 ? 78 : 96));
        v.barFill.clear();
        const frac = f.alive ? f.meter / METER_MAX : 0;
        if (frac > 0.01) {
          const w = (barW - 8) * frac;
          v.barFill.roundRect(col === 1 ? x + barW - 4 - w : x + 4, y + 4, w, barH - 8, 4)
            .fill(f.alive ? f.def.color : 0x555258);
        }
        v.barBg.alpha = f.alive ? 1 : 0.45;
        if (v.barLabel) v.barLabel.alpha = f.alive ? 1 : 0.5;
        const lines = f.def.stats(f);
        v.statTexts.forEach((t, si) => {
          const line = lines[si];
          t.text = line ? `${line.label}: ${line.value()}` : "";
          t.alpha = f.alive ? 1 : 0.45;
        });
      }
    }

    this.drawFx(e);
    this.drawPopups(e);
    this.drawOverlay(e);
  }

  private drawFx(e: Engine) {
    const g = this.fxG;
    g.clear();
    const t = this.trailG;
    t.clear();

    // ball speed trails (Mach & co)
    for (const f of e.fighters) {
      if (!f.alive || f.def.weapon.kind !== "none" || !f.st.trail) continue;
      f.ghosts.forEach((gh, i) => {
        const a = (i / f.ghosts.length) * 0.3;
        t.circle(gh.x, gh.y, f.def.radius * (0.4 + (i / f.ghosts.length) * 0.6)).fill({ color: f.def.color, alpha: a });
      });
    }

    // gates (Tyrant)
    for (const gate of e.gates) {
      const p = Math.min(1, gate.t / gate.fireAt || 1);
      t.circle(gate.x, gate.y, 44).stroke({ width: 6, color: gate.color, alpha: 0.85 });
      t.circle(gate.x, gate.y, 44 * p).fill({ color: gate.color, alpha: 0.25 });
    }

    // gravity fields
    for (const f of e.fighters) {
      if (f.alive && f.st.field && f.ultT > 0) {
        t.circle(f.x, f.y, 420).fill({ color: f.def.color, alpha: 0.13 });
        t.circle(f.x, f.y, 420).stroke({ width: 4, color: f.def.color, alpha: 0.4 });
      }
    }

    // projectiles
    for (const p of e.projectiles) {
      const { x, y } = p.body.position;
      const a = p.body.angle;
      switch (p.kind) {
        case "bullet":
          g.circle(x, y, 9).fill(p.color).stroke({ width: 3, color: 0x3a3222 });
          g.circle(x, y, 4).fill(0xffffff);
          break;
        case "orb":
          g.circle(x, y, 13).fill(p.color).stroke({ width: 3, color: 0xffffff });
          break;
        case "heart":
          heart(g, x, y, 18, p.color, 0x8c2a5e);
          break;
        case "nail": {
          const L = (p.len ?? 180) / 2, ca = Math.cos(a), sa = Math.sin(a);
          g.moveTo(x - ca * L, y - sa * L).lineTo(x + ca * L, y + sa * L)
            .stroke({ width: 11, color: 0xc7ccd6 });
          g.moveTo(x - ca * L, y - sa * L).lineTo(x + ca * L, y + sa * L)
            .stroke({ width: 4, color: 0xf2f4f8 });
          // head cap + point
          g.rect(0, 0, 0, 0);
          g.circle(x - ca * L, y - sa * L, 9).fill(0x3a3f4a);
          g.poly([x + ca * (L + 14), y + sa * (L + 14), x + ca * L - sa * 8, y + sa * L + ca * 8, x + ca * L + sa * 8, y + sa * L - ca * 8]).fill(0x8a919e);
          break;
        }
        case "gateblade": {
          const L = (p.len ?? 110) / 2, ca = Math.cos(a), sa = Math.sin(a);
          g.poly([
            x + ca * L, y + sa * L,
            x - ca * L * 0.7 - sa * 9, y - sa * L * 0.7 + ca * 9,
            x - ca * L, y - sa * L,
            x - ca * L * 0.7 + sa * 9, y - sa * L * 0.7 - ca * 9,
          ]).fill(0xe8c96a).stroke({ width: 3, color: 0x6b5010 });
          break;
        }
      }
    }

    // beams
    for (const b of e.beams) {
      const alpha = 1 - b.t / b.life;
      const ex = b.x + Math.cos(b.angle) * b.length;
      const ey = b.y + Math.sin(b.angle) * b.length;
      g.moveTo(b.x, b.y).lineTo(ex, ey).stroke({ width: b.width * alpha, color: b.color, alpha: 0.35 + alpha * 0.5 });
      g.moveTo(b.x, b.y).lineTo(ex, ey).stroke({ width: b.width * 0.35 * alpha, color: 0xffffff, alpha });
    }

    // rings
    for (const r of e.rings) {
      g.circle(r.x, r.y, r.r).stroke({ width: r.w, color: r.color, alpha: 1 - r.t / r.life });
    }

    // particles
    for (const p of e.particles) {
      g.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: 1 - p.t / p.life });
    }

    // frozen overlays
    for (const f of e.fighters) {
      if (f.alive && f.frozen > 0) {
        g.circle(f.x, f.y, f.def.radius + 4).fill({ color: 0x9be8ff, alpha: 0.4 })
          .stroke({ width: 4, color: 0xd8f6ff, alpha: 0.8 });
      }
    }
  }

  private drawPopups(e: Engine) {
    while (this.popupPool.length < e.popups.length) {
      const t = this.makeText(40, 0xffffff, 0x2b2b31, 6);
      this.popupPool.push(t);
      this.popupLayer.addChild(t);
    }
    this.popupPool.forEach((t, i) => {
      const p = e.popups[i];
      if (!p) { t.visible = false; return; }
      t.visible = true;
      t.text = p.text;
      t.style.fontSize = p.crit ? 58 : 40;
      t.style.fill = p.crit ? 0xffe259 : p.color;
      t.position.set(p.x, p.y);
      t.alpha = 1 - Math.pow(p.t / p.life, 2);
    });
  }

  private drawOverlay(e: Engine) {
    const phase = e.phase;
    this.dim.visible = phase === "winner";
    this.centerText.visible = false;
    this.winnerSub.visible = false;
    this.calloutText.visible = false;
    this.calloutSub.visible = false;

    if (phase === "intro") {
      this.centerText.visible = true;
      this.centerText.text = "VS";
      const p = Math.min(1, e.phaseT / 0.4);
      this.centerText.scale.set(2.2 - 1.2 * p);
      this.centerText.alpha = p;
    } else if (phase === "ko") {
      this.centerText.visible = true;
      this.centerText.text = "K.O.";
      this.centerText.scale.set(1);
      this.centerText.alpha = 1;
    } else if (phase === "winner") {
      this.centerText.visible = true;
      this.winnerSub.visible = true;
      this.centerText.scale.set(0.62);
      this.centerText.alpha = 1;
      const names = e.winners.map(w => w.def.name).join(" & ");
      this.centerText.text = names || "DRAW";
      this.centerText.style.fill = e.winners[0]?.def.color ?? 0xffe259;
      this.centerText.style.stroke = { color: e.winners[0]?.def.dark ?? 0x2b2b31, width: 12, join: "round" };
      this.winnerSub.text = e.winners.length > 1 ? "WIN!" : "WINS!";
    } else {
      this.centerText.style.fill = 0xffe259;
      this.centerText.style.stroke = { color: 0x2b2b31, width: 12, join: "round" };
    }

    const c = e.callouts[e.callouts.length - 1];
    if (c && phase === "fight") {
      const p = c.t / c.life;
      this.calloutText.visible = true;
      this.calloutText.text = c.text;
      this.calloutText.style.fill = c.color;
      this.calloutText.alpha = p < 0.15 ? p / 0.15 : p > 0.75 ? (1 - p) / 0.25 : 1;
      this.calloutText.scale.set(1 + (1 - Math.min(1, p / 0.12)) * 0.6);
    }
  }

  destroy() {
    this.app.destroy(true, { children: true });
  }
}
