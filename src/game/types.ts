import type { Engine } from "./engine";
import type { Fighter } from "./fighter";

/** Weapon archetypes — how the physical weapon body is built. */
export type WeaponShape =
  | { kind: "blade"; length: number; width: number; style: BladeStyle }
  | { kind: "gun"; length: number; width: number; style: "revolver" | "railgun" }
  | { kind: "saw"; radius: number; teeth: number }
  | { kind: "staff"; length: number; width: number; stripes: number }
  | { kind: "orbitals"; count: number; radius: number; dist: number }
  | { kind: "none" };

export type BladeStyle =
  | "sword" | "greatsword" | "katana" | "axe" | "dagger" | "rapier"
  | "hammer" | "scythe" | "wand" | "iceblade" | "gavel" | "chainsaw" | "bolt";

/** A live, per-fighter stat line rendered under the ult meter (his signature UI). */
export interface StatLine {
  label: string;
  value: () => string;
}

export interface CharacterDef {
  id: string;
  name: string;
  /** Ball fill color. */
  color: number;
  /** Darker outline/accent. */
  dark: number;
  /** Letterbox/arena theme accent + pattern id. */
  theme: ThemeId;
  hp: number;
  /** Cruise speed the ball is steered back toward (px/s). */
  speed: number;
  radius: number;
  /** Base body density multiplier (Juggernaut is heavy). */
  massMult?: number;
  weapon: WeaponShape;
  /** Target weapon angular velocity (rad/s); the motor torques toward it. */
  spin: number;
  /** Contact damage dealt by the weapon on hit. */
  damage: number;
  /** Ultimate — the labeled meter at the bottom. */
  ult: {
    name: string;
    /** Meter gained per point of damage dealt / taken. */
    gainDealt: number;
    gainTaken: number;
    fire: (f: Fighter, e: Engine) => void;
  };
  /** Per-tick character logic (ability timers, passives). */
  update?: (f: Fighter, e: Engine, dt: number) => void;
  /** Called when this fighter's weapon lands a hit. */
  onDealHit?: (f: Fighter, target: Fighter, e: Engine, dmg: number) => void;
  /** Called when this fighter takes a hit. */
  onTakeHit?: (f: Fighter, from: Fighter | null, e: Engine, dmg: number) => void;
  /** Modify outgoing damage (crits, rage...). Returns final damage. */
  modDamage?: (f: Fighter, base: number, e: Engine) => number;
  /** Chance to fully evade an incoming hit (Judge's Sans-style dodge). */
  dodge?: (f: Fighter, e: Engine) => boolean;
  /** Live stat readout lines. */
  stats: (f: Fighter) => StatLine[];
}

export type ThemeId =
  | "plain" | "bones" | "hearts" | "rings" | "gears" | "snow" | "speed"
  | "clouds" | "embers" | "stars" | "bamboo" | "crosshair";

export interface LineupEntry {
  charId: string;
  team: number;
}

export type MatchPhase = "intro" | "fight" | "ko" | "winner";

/** Events the engine emits for the shell (recorder auto-stop, sounds already internal). */
export type EngineEvent =
  | { type: "phase"; phase: MatchPhase }
  | { type: "winner"; names: string[]; team: number | null }
  | { type: "ult"; fighter: string; ultName: string };
