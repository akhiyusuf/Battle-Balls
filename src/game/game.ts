import { Engine } from "./engine";
import { GameRenderer } from "./renderer";
import type { EngineEvent, LineupEntry } from "./types";

/** Owns the engine + renderer + rAF loop; the React studio drives it. */
export class Game {
  renderer = new GameRenderer();
  engine: Engine | null = null;
  speed = 1;
  onEvent: ((ev: EngineEvent) => void) | null = null;
  private raf = 0;
  private last = 0;
  private lastLineup: LineupEntry[] = [];
  private lastSeed = 1;

  async init(): Promise<HTMLCanvasElement> {
    const canvas = await this.renderer.init();
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (this.engine) {
        this.engine.update(dt * this.speed);
        for (const ev of this.engine.events) this.onEvent?.(ev);
        this.engine.events.length = 0;
        this.renderer.sync(this.engine);
      }
    };
    this.raf = requestAnimationFrame(loop);
    return canvas;
  }

  start(lineup: LineupEntry[], seed: number) {
    this.engine?.destroy();
    this.lastLineup = lineup;
    this.lastSeed = seed;
    this.engine = new Engine(lineup, seed);
    // clones appear mid-fight; renderer must learn about them
    const origAdd = this.engine.addFighter.bind(this.engine);
    this.engine.addFighter = (f) => {
      origAdd(f);
      if (this.renderer.app) this.renderer.addFighterView(f, this.engine!);
    };
    this.renderer.bind(this.engine);
  }

  /** Restart the exact same fight (same seed → same outcome). */
  replay() {
    if (this.lastLineup.length) this.start(this.lastLineup, this.lastSeed);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.engine?.destroy();
    this.renderer.destroy();
  }
}
