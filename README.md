# Battle Balls ⚔️

A physics-based **ball fight simulator** inspired by [Ball Thing](https://ballthing.com)
(@ballthingsim on TikTok/YouTube) — character balls with weapons and abilities
bounce around a vertical 9:16 arena and battle until one side is left standing,
complete with HP bars, damage numbers, hitstop, slow-mo K.O.s, and a winner screen.

No frameworks, no build step, no dependencies — a small custom engine in vanilla
JavaScript + Canvas (`js/engine.js` handles the circle physics, orbiting weapon
colliders, projectiles, and effects).

## Run it

Just open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Modes

- **1v1 / team-less brawl** — pick any 2+ fighters and hit FIGHT
- **Random 1v1** — instant random matchup
- **2v2** — pick exactly 4; picks 1+2 vs picks 3+4
- **Free-for-all** — your picks (3+) or the whole roster

URL shortcuts: `?fight=bladesman,berserker` · `?ffa=1` · `?auto=1` (random 1v1)

## Roster

| Fighter | Gimmick |
| --- | --- |
| ⚔️ **Bladesman** | Orbiting sword that grows every time it lands a hit |
| 🪓 **Berserker** | Enrages below 50% HP — faster swings, much harder hits |
| 🔫 **Outlaw** | No melee; tracks the nearest enemy and fires bullets |
| 🔮 **Magia** | Launches slow homing orbs that burst in an AoE |
| 🐒 **Monkey King** | Staff periodically extends into a huge spinning sweep |
| ❄️ **Stasis** | Emits a freeze pulse that locks nearby enemies in place |
| ⚡ **Mach** | Fastest ball; dashes through enemies dealing contact damage |
| 🛡️ **Juggernaut** | Heavy spiked tank — hurts anything that touches it |

Weapons **clash** when they meet (sparks + knockback), and melee weapons can
deflect incoming bullets and orbs.

## Record clips (the "studio")

During a fight, hit **⏺** in the top-right to record the canvas at 1080×1920
(TikTok/Shorts resolution) — press again to stop and a `.webm` clip downloads.

Other controls: `R` rematch · `Esc` back to menu · 🔊 mute toggle.
