import { useCallback, useEffect, useRef, useState } from "react";
import { Game } from "./game/game";
import { ROSTER } from "./game/characters";
import { Sound } from "./game/audio";
import { ClipRecorder } from "./studio/recorder";
import { StudioPanel } from "./studio/StudioPanel";
import type { EngineEvent, LineupEntry } from "./game/types";
import "./App.css";

export interface MatchConfig {
  picks: string[];
  mode: "solo" | "teams";
  seed: number;
}

export default function App() {
  const canvasHost = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const recRef = useRef(new ClipRecorder());
  const exportingRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [lastUlt, setLastUlt] = useState<string | null>(null);

  useEffect(() => {
    const game = new Game();
    gameRef.current = game;
    (window as unknown as { __game: Game }).__game = game; // debugging/tests
    let alive = true;
    game.init().then((canvas) => {
      if (!alive) return;
      canvas.className = "game-canvas";
      canvasHost.current?.appendChild(canvas);
      if (location.search.includes("weapons")) {
        // dev sheet for eyeballing all weapon sprites at once
        game.renderer.debugWeaponSheet(ROSTER.map(c => ({ name: c.name, def: c })));
        return;
      }
      // open straight into a random demo fight
      const pool = ROSTER.map(c => c.id);
      const a = pool[Math.floor(Math.random() * pool.length)];
      let b = pool[Math.floor(Math.random() * pool.length)];
      while (b === a) b = pool[Math.floor(Math.random() * pool.length)];
      game.start([{ charId: a, team: 0 }, { charId: b, team: 1 }], Math.floor(Math.random() * 1_000_000));
      setRunning(true);
    });
    game.onEvent = (ev: EngineEvent) => {
      if (ev.type === "ult") setLastUlt(`${ev.fighter} — ${ev.ultName}`);
      if (ev.type === "phase" && ev.phase === "winner" && exportingRef.current) {
        // let the winner screen play, then finish the export
        setTimeout(() => {
          void recRef.current.stop(`battle-balls-${Date.now()}.webm`).then(() => {
            exportingRef.current = false;
            setExporting(false);
            setRecording(false);
          });
        }, 2600);
      }
    };
    return () => {
      alive = false;
      game.destroy();
    };
  }, []);

  const toLineup = (cfg: MatchConfig): LineupEntry[] =>
    cfg.picks.map((charId, i) => ({
      charId,
      team: cfg.mode === "teams" ? (i < cfg.picks.length / 2 ? 0 : 1) : i,
    }));

  const startFight = useCallback((cfg: MatchConfig) => {
    Sound.unlock();
    gameRef.current?.start(toLineup(cfg), cfg.seed);
    setRunning(true);
  }, []);

  const toggleRecord = useCallback(() => {
    const canvas = canvasHost.current?.querySelector("canvas");
    if (!canvas || !ClipRecorder.supported(canvas)) return;
    if (recRef.current.recording) {
      void recRef.current.stop(`battle-balls-${Date.now()}.webm`);
      setRecording(false);
    } else {
      recRef.current.start(canvas);
      setRecording(true);
    }
  }, []);

  /** One-click studio export: restart the fight, record start→winner, download. */
  const exportVideo = useCallback((cfg: MatchConfig) => {
    const canvas = canvasHost.current?.querySelector("canvas");
    if (!canvas || !ClipRecorder.supported(canvas) || exportingRef.current) return;
    Sound.unlock();
    gameRef.current?.start(toLineup(cfg), cfg.seed);
    setRunning(true);
    exportingRef.current = true;
    setExporting(true);
    recRef.current.start(canvas);
    setRecording(true);
  }, []);

  const setSpeed = useCallback((s: number) => {
    setSpeedState(s);
    if (gameRef.current) gameRef.current.speed = s;
  }, []);

  const toggleMute = useCallback(() => {
    Sound.muted = !Sound.muted;
    setMuted(Sound.muted);
  }, []);

  return (
    <div className="studio">
      <div className="stage">
        <div ref={canvasHost} className="canvas-host" />
        {recording && <div className="rec-dot">● REC</div>}
      </div>
      <StudioPanel
        roster={ROSTER}
        running={running}
        recording={recording}
        exporting={exporting}
        speed={speed}
        muted={muted}
        lastUlt={lastUlt}
        onFight={startFight}
        onReplay={() => { gameRef.current?.replay(); setRunning(true); }}
        onRecord={toggleRecord}
        onExport={exportVideo}
        onSpeed={setSpeed}
        onMute={toggleMute}
      />
    </div>
  );
}
