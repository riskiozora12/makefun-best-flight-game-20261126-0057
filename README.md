# Ridgeline Run — a bush-plane flight game

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/riskiozora12/makefun-best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/riskiozora12/makefun-best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A complete flight game for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057) — built with Three.js, plain static files, no network requests. Fly the Kestrel bush plane through glowing rings over a mountain valley, mind your fuel, and bring her home on runway 36.

## Play

Serve `game/` with any static server (or `node serve.ts`, then open http://localhost:8080) and play in a desktop browser.

- **↑ / ↓** pitch, **← / →** bank and turn
- **Shift / Ctrl** throttle, **mouse wheel** throttle, **hold mouse** to steer
- **Space** flaps, **G** landing gear, **C** cockpit view, **P** pause, **M** sound

## The game

Three sorties over one valley — a river, pine forest, a lakeside village and a grass airstrip between two mountain ridges:

1. **Dawn Patrol** — six rings over the valley, then land. Learn the plane.
2. **River Run** — ten rings low along the river. Stay under the pines.
3. **Storm Ridge** — twelve rings through the mountain pass in gusty wind.

Score comes from rings, time under par, landing quality (softness and centreline) and fuel left over. Land early and the crew refuels and patches the plane — fuel is a decision, not a timer. Land badly and the undercarriage remembers it; land on the mountain and the sortie ends.

The HUD shows airspeed, altitude (MSL and AGL), a heading tape, an attitude ball, fuel, damage, throttle, gear and flaps, plus a ring-direction arrow and a live objective. All sounds are synthesised in WebAudio: engine hum, wind, ring chimes, stall warnings and touchdown thuds.

## Layout

- `main.ts` — hands the game in (copies `game/` + `screenshots/`, writes `dossier.json`)
- `serve.ts` — tiny static server for local play
- `game/index.html` — page shell and HUD
- `game/style.css` — the lit-instrument look
- `game/src/config.js` — tuning, missions, scoring
- `game/src/random.js` — seeded RNG and value noise
- `game/src/terrain.js` — valley, river, pines, airfield, village
- `game/src/world.js` — sky, sun, clouds, rings
- `game/src/plane.js` — the Kestrel, built from primitives
- `game/src/physics.js` — thrust, drag, lift, stall, banking turns
- `game/src/input.js` — keyboard and mouse
- `game/src/hud.js` — instruments, menus, debrief
- `game/src/audio.js` — synthesised engine, wind and chimes
- `game/src/missions.js` — ring flow, scoring, landing evaluation
- `game/src/shots.js` — frozen poses for the screenshots
- `game/src/render.js` — renderer and chase / cockpit cameras
- `game/src/main.js` — bootstrap and game loop
- `game/vendor/three.module.min.js` — Three.js r160 (vendored, minified)

## Screenshots

`?shot=1` banking through a ring, `?shot=2` low over the river, `?shot=3` on final approach, `?shot=4` from the cockpit — frozen poses rendered by the game's own code.

## Referral

Built for make.fun — https://make.fun/?ref=wt28nn7m
