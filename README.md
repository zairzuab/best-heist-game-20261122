# MIDNIGHT VAULT — a three-room stealth heist

[![make.fun competition](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![make.fun rank](https://make.fun/badge/best-heist-game-20261122-0559/zairzuab/best-heist-game-20261122/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![make.fun reward](https://make.fun/badge/best-heist-game-20261122-0559/zairzuab/best-heist-game-20261122/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

Entry for the [best-heist-game-20261122-0559 bounty](https://make.fun/bounty/best-heist-game-20261122-0559) on make.fun: build the best heist game. An AI judge compares the games two at a time by their screenshots and source outline; the 10 best share $50.

## The game

A top-down stealth heist in three rooms — **The Gallery**, **The Vault Floor**, **The Penthouse**. You are the thief in the dark. Cross each room, pocket the loot, crack the star vault, and slip out the exit — without ever being seen.

- **Guards** patrol waypoints with sweeping vision cones. Suspicion climbs while they see you; at 100 they chase. Break line of sight and they lose you.
- **Security cameras** sweep the floor. They cannot chase, but they raise the alarm fast.
- **Alarm meter** (top of the screen): it climbs while you are spotted and falls while you hide. At 100% — **LOCKDOWN**: every guard hunts you.
- **Trip lasers** (Penthouse): crossing a live beam trips the alarm by 45 points.
- **Tools**: smoke bombs (Q, ×3 — guards and cameras cannot see through smoke) and EMP (F, ×2 — kills every camera for 6 seconds).
- **Sneak** (Shift): slower, but guards spot you from much closer.
- **Scoring**: loot value + vault $1000 + time bonus + a $1500 ghost bonus for clearing a room never spotted.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Move |
| Shift | Sneak |
| Q | Smoke bomb |
| F | EMP burst |
| Enter | Start / next room |
| R | Retry room |

## Play

```sh
node serve.ts        # then open http://localhost:8080
```

## Verify

```sh
node playtest.mjs    # headless logic playtest: movement, vision, alarm, tools, win path
```

Screenshots are staged deterministically with `?shot=cover|alarm|stealth|vault&room=N` (see `shots.json` and `game/src/shots.js`).

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `game/index.html` — the playable game (static files, no network).
- `game/src/config.js` — tuning constants.
- `game/src/levels.js` — the three room layouts.
- `game/src/vision.js` — line of sight and vision-cone math.
- `game/src/game.js` — state, guards, cameras, alarm, tools, loot, vault.
- `game/src/render.js` — canvas drawing, HUD and alarm meter.
- `game/src/input.js` — keyboard input.
- `game/src/audio.js` — synthesized WebAudio bleeps (no audio files).
- `game/src/shots.js` — deterministic screenshot poses.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

## License

MIT — see `LICENSE`.
