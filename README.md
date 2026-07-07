# Battle Balls ⚔️ — fight studio

A faithful replica of [Ball Thing](https://ballthing.com)'s physics ball-fight
simulations (@ballthingsim on TikTok/YouTube — his upcoming mobile game is
called **Ball Fight League**), built on **his actual stack**:
**React + TypeScript** on top of **Pixi.js** (rendering) and **Matter.js**
(physics) — plus a **studio that exports fights into videos quickly**.

The design was reverse-engineered from real gameplay frames of his shorts:
the light paper-style square arena with themed wallpapers, HP numbers inside
the balls, per-fighter **named ult meters**, live ramping stat readouts
(Damage, Crit %, Ammo, Karma, Weapon Size, Clones…), physics-driven weapons
with ghost trails, damage popups, and the K.O. → winner flow.

## Run it

```sh
npm install
npm run dev        # local dev server
npm run build      # production build (deployed to GitHub Pages)
```

## The studio

- Pick any 2–8 of the 19 fighters, free-for-all or teams
- **Seeded fights** — the same seed always reproduces the same fight
- Playback speed control (0.5× / 1× / 2×)
- **⏺ Record** — capture any moment to .webm
- **🎬 Export video** — one click: restarts the fight, records 1080×1920 @ 60fps
  (TikTok/Shorts resolution), and auto-downloads the clip when the winner
  screen plays

## The roster

Ult names in **bold** were read directly off the meter bars in his videos.

| Fighter | Ult | Gimmick |
| --- | --- | --- |
| Bladesman | **BLADE RUSH** | damage snowballs per hit (Damage = 2× Spin Speed) |
| Berserker | **WHIRLWIND** | rages below 38% HP; ult heals + frenzies |
| Outlaw | **HIGH NOON** | six-shooter with Ammo x/6 + reloads; ult fans the cylinder |
| Magia | **HEARTBREAK FINALE** | homing heart orbs with AoE bursts |
| Monkey King | **TRICKSTER CLONE** | growing staff; ult spawns fighting clones |
| Stasis | **WORLD STASIS** | time-stop ult (arena grays out); every cast permanently quickens her |
| Mach | **FULL THROTTLE** | no weapon — pure speed rammer, Damage = 2× Speed |
| Juggernaut | **GRAVITY WELL** | heavy greatsword tank; ult pulls enemies in |
| Sword Saint | **SPATIAL REND** | fastest blade; ult drops a giant vertical rend |
| Judge | **ABSOLUTE EVASION** | Sans homage: **1 HP**, dodges via decaying Recovery Rate, Karma barrage |
| Rogue | **BATTLE TRANCE** | Crit % ramps; ult teleports behind you |
| Duelist | **SHELLSTORM** | rapier; damage ramps hard per hit |
| Shredder | **MAELSTROM SAW** | chainsaw; Damage = Lifesteal, lifesteal overheals past max HP |
| Sunderer | **CATACLYSM** | arena-spanning nails that pierce and pin |
| Samurai | **DASH** | radial slash burst + permanent damage surge |
| Tyrant | **HEAVEN BINDING** | summons gates that volley golden blades |
| Axiom | **HORIZON** | blade-storm wings; Shred stat (Damage = 3× Shred) |
| Vessel | **DETERMINATION** | flat heavy damage; refuses to fall |
| Thunderclad | THUNDERCALL | chain lightning; ult strikes every enemy |

## Code layout

The `src/game` engine is split by concern:

| Module | Responsibility |
| --- | --- |
| `engine.ts` | Orchestration: phase machine, combat resolution, projectiles, ults |
| `movement.ts` | The steering model (bounce + distance-scaled homing) |
| `effects.ts` | `Fx` — particles, rings, damage popups, beams, callouts, shake |
| `geometry.ts` | Capsule/circle hit-testing for reliable melee |
| `tuning.ts` | All feel knobs in one place (physics, movement, combat) |
| `characters.ts` | The 19-fighter roster + staged ult scripts |
| `weaponArt.ts` / `themes.ts` | Pixel-art weapon sprites and arena wallpapers |
| `renderer.ts` | Pixi scene graph, synced from engine state each frame |

## Engine notes

- **Movement**: balls keep constant cruise speed and ricochet off walls and
  each other; a distance-scaled homing bias pulls them back together only once
  they drift apart, so they bounce-and-brawl instead of gluing together or
  drifting off. (Matter.js velocity is per-tick, not per-second — everything
  converts at the physics boundary via `VEL`, or the sim runs ~60× too fast.)
- **Melee** is hit-tested with capsule geometry each step, not Matter
  collisions — a fast thin spinning blade tunnels straight through Matter's
  discrete detector, so physics-based melee barely registers.
- Weapons are sensor bodies (they detect but never shove), so the balls cluster
  and the weapons overlap in a tight brawl.
- Deterministic seeded RNG end-to-end: replays are exact.
- Ults are staged animations driven by an in-engine scheduler; meters charge
  from damage dealt + taken and fire automatically.
- Projectiles lead their targets and deal no knockback (melee does); nails
  pierce and stick into the arena border.
- A sudden-death damage ramp keeps every fight converging.
- Balance was tuned via headless 342-fight sweeps across all 171 matchups to a
  ~28–75% win-rate band.
