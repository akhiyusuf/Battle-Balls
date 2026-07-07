import { useMemo, useState } from "react";
import type { CharacterDef } from "../game/types";
import type { MatchConfig } from "../App";

interface Props {
  roster: CharacterDef[];
  running: boolean;
  recording: boolean;
  exporting: boolean;
  speed: number;
  muted: boolean;
  lastUlt: string | null;
  onFight: (cfg: MatchConfig) => void;
  onReplay: () => void;
  onRecord: () => void;
  onExport: (cfg: MatchConfig) => void;
  onSpeed: (s: number) => void;
  onMute: () => void;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

export function StudioPanel(p: Props) {
  const [picks, setPicks] = useState<string[]>(["bladesman", "berserker"]);
  const [mode, setMode] = useState<"solo" | "teams">("solo");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000));

  const cfg: MatchConfig = useMemo(() => ({ picks, mode, seed }), [picks, mode, seed]);

  const toggle = (id: string) =>
    setPicks(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= 8 ? prev : [...prev, id]);

  const randomMatch = (n: number) => {
    const pool = [...p.roster.map(c => c.id)];
    const out: string[] = [];
    while (out.length < n && pool.length) {
      out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    setPicks(out);
    setSeed(Math.floor(Math.random() * 1_000_000));
    return out;
  };

  const canFight = picks.length >= 2;

  return (
    <aside className="panel">
      <header>
        <h1>BATTLE BALLS</h1>
        <p className="sub">fight studio</p>
      </header>

      <section>
        <h2>Fighters <span className="count">{picks.length}/8</span></h2>
        <div className="grid">
          {p.roster.map(c => {
            const idx = picks.indexOf(c.id);
            return (
              <button
                key={c.id}
                className={`card${idx >= 0 ? " on" : ""}`}
                style={{ ["--c" as string]: hex(c.color), ["--d" as string]: hex(c.dark) }}
                onClick={() => toggle(c.id)}
                title={`${c.name} — ${c.ult.name}`}
              >
                <span className="dot" />
                <span className="nm">{c.name}</span>
                <span className="ult">{c.ult.name}</span>
                {idx >= 0 && <span className="ord">{idx + 1}</span>}
              </button>
            );
          })}
        </div>
        <div className="row">
          <button onClick={() => randomMatch(2)}>🎲 1v1</button>
          <button onClick={() => { randomMatch(4); setMode("teams"); }}>🎲 2v2</button>
          <button onClick={() => { randomMatch(8); setMode("solo"); }}>🎲 FFA</button>
        </div>
      </section>

      <section>
        <h2>Setup</h2>
        <div className="row">
          <label className={mode === "solo" ? "on" : ""}>
            <input type="radio" checked={mode === "solo"} onChange={() => setMode("solo")} />
            Free-for-all
          </label>
          <label className={mode === "teams" ? "on" : ""}>
            <input type="radio" checked={mode === "teams"} onChange={() => setMode("teams")} />
            Teams (½ vs ½)
          </label>
        </div>
        <div className="row">
          <span className="lbl">Seed</span>
          <input
            className="seed"
            type="number"
            value={seed}
            onChange={e => setSeed(Number(e.target.value) | 0)}
          />
          <button onClick={() => setSeed(Math.floor(Math.random() * 1_000_000))}>↻</button>
        </div>
        <div className="row">
          <span className="lbl">Speed</span>
          {[0.5, 1, 2, 3].map(s => (
            <button key={s} className={p.speed === s ? "on" : ""} onClick={() => p.onSpeed(s)}>{s}×</button>
          ))}
          <button onClick={p.onMute}>{p.muted ? "🔇" : "🔊"}</button>
        </div>
      </section>

      <section className="actions">
        <button className="primary" disabled={!canFight} onClick={() => p.onFight(cfg)}>
          ▶ FIGHT
        </button>
        <button disabled={!p.running} onClick={p.onReplay}>↺ Replay (same seed)</button>
        <button disabled={!p.running || p.exporting} onClick={p.onRecord}>
          {p.recording && !p.exporting ? "⏹ Stop recording" : "⏺ Record"}
        </button>
        <button className="export" disabled={!canFight || p.exporting} onClick={() => p.onExport(cfg)}>
          {p.exporting ? "Exporting… (runs until K.O.)" : "🎬 Export video (auto)"}
        </button>
        <p className="hint">
          Export restarts the fight with this seed, records 1080×1920 @ 60fps,
          and downloads a .webm when the winner screen plays.
        </p>
        {p.lastUlt && <p className="ultlog">Last ult: {p.lastUlt}</p>}
      </section>

      <footer>
        Replica of <a href="https://ballthing.com" target="_blank" rel="noreferrer">Ball Thing</a>'s
        fight sims — React + TypeScript + Pixi + Matter.js
      </footer>
    </aside>
  );
}
