# Battle Balls ⚔️ — fight studio

A faithful replica of [Ball Thing](https://ballthing.com)'s physics ball-fight
simulations (@ballthingsim on TikTok/YouTube), built on **his actual stack**:
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
| Berserker | WHIRLWIND | rages below 38% HP; ult heals + frenzies |
| Outlaw | **HIGH NOON** | six-shooter with Ammo x/6 + reloads; ult fans the cylinder |
| Magia | **HEARTBREAK FINALE** | homing heart orbs with AoE bursts |
| Monkey King | **TRICKSTER CLONE** | growing staff; ult spawns fighting clones |
| Stasis | **WORLD STASIS** | freeze pulses; every ult permanently quickens her |
| Mach | **FULL THROTTLE** | no weapon — pure speed rammer, Damage = 2× Speed |
| Juggernaut | **GRAVITY WELL** | heavy greatsword tank; ult pulls enemies in |
| Sword Saint | **SPATIAL REND** | fastest blade; ult drops a giant vertical rend |
| Judge | **ABSOLUTE EVASION** | Karma + decaying Recovery Rate; bone-beam barrage |
| Rogue | SHADOWSTRIKE | Crit % ramps; ult teleports behind you |
| Duelist | **SHELLSTORM** | rapier; damage ramps hard per hit |
| Shredder | **MAELSTROM SAW** | chainsaw; Damage = Lifesteal, both ramp |
| Sunderer | **CATACLYSM** | arena-spanning nails that pierce and pin |
| Samurai | IAIJUTSU | radial slash burst + permanent damage surge |
| Tyrant | **HEAVEN KINGDOM** | summons gates that volley golden blades |
| Axiom | **HORIZON** | blade-storm wings; Shred stat (Damage = 3× Shred) |
| Vessel | **DETERMINATION** | flat heavy damage; refuses to fall |
| Thunderclad | THUNDERCALL | chain lightning; ult strikes every enemy |

## Engine notes

- Weapons are real Matter.js bodies pinned to the ball's center and driven by
  motor torque — clashes physically stagger them, which is what gives the
  fights their flailing, reactive feel
- Deterministic seeded RNG end-to-end: replays are exact
- Projectiles lead their targets; nails pierce through fighters and stick
  into the arena border
- Ult meters charge from damage dealt + taken; ults fire automatically
- Sudden-death damage ramp keeps every fight converging
- Balance was tuned via headless 342-fight sweeps across all 171 matchups
