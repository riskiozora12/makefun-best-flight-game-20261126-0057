// main.js — bootstrap and the game loop. Owns the state machine
// (menu -> flying -> paused / debrief / crashed), wires input to the flight
// model, missions to the rings, and the HUD to everything.

import * as THREE from "three";
import { MISSIONS, WORLD } from "./config.js";
import { buildTerrain, terrainHeight } from "./terrain.js";
import { buildWorld, buildRings } from "./world.js";
import { buildPlane } from "./plane.js";
import { createFlightState, resetOnRunway, stepFlight } from "./physics.js";
import { createInput } from "./input.js";
import { createHud } from "./hud.js";
import { createAudio } from "./audio.js";
import { createMissionRunner } from "./missions.js";
import { createRenderer, posePlane, createCameraRig } from "./render.js";
import { applyShot, getShotMission } from "./shots.js";

const MS_TO_KT = 1.94384;
const M_TO_FT = 3.28084;
const DEG = 180 / Math.PI;

function loadBests() {
  try {
    return JSON.parse(localStorage.getItem("ridgeline-bests") || "{}");
  } catch {
    return {};
  }
}
function saveBest(missionId, score) {
  try {
    const bests = loadBests();
    if (!bests[missionId] || score > bests[missionId]) {
      bests[missionId] = score;
      localStorage.setItem("ridgeline-bests", JSON.stringify(bests));
    }
    return bests[missionId];
  } catch {
    return score;
  }
}

const app = document.getElementById("app");
const { renderer, camera } = createRenderer(app);
const scene = new THREE.Scene();
const terrain = buildTerrain(scene);
const world = buildWorld(scene);
const plane = buildPlane();
scene.add(plane.group);
const cameraRig = createCameraRig(camera);
const hud = createHud(document);
const input = createInput();
const audio = createAudio();
const flight = createFlightState();

let missionIndex = 0;
let missionDef = MISSIONS[0];
let ringsApi = null;
let runner = null;
let screen = "menu"; // menu | flying | paused | debrief | crashed | shot
let cameraMode = "chase";
let throttle = 0;
let time = 0;
let lastStallBeep = 0;

const params = new URLSearchParams(window.location.search);
const shotParam = parseInt(params.get("shot") || "0", 10);
const shotMode = shotParam >= 1 && shotParam <= 4;

function startMission(index) {
  missionIndex = index;
  missionDef = MISSIONS[index];
  if (ringsApi) ringsApi.dispose();
  ringsApi = buildRings(scene, missionDef.rings);
  runner = createMissionRunner(missionDef, ringsApi);
  resetOnRunway(flight);
  flight.y = terrainHeight(flight.x, flight.z) + 1.55;
  throttle = 0;
  cameraMode = "chase";
  hud.setCockpitMode(false);
  plane.setCockpitMode(false);
  runner.start();
  hud.showHud(missionDef.name);
  hud.flash(missionDef.briefing, "#ffe9b0");
  screen = "flying";
  audio.unlock();
}

function backToMenu() {
  screen = "menu";
  hud.showMenu(MISSIONS, loadBests(), (i) => startMission(i));
  audio.update({ throttle: 0, speed: 0, onGround: true, running: false });
}

function crashReasonText(reason) {
  return {
    terrain: "You flew into the terrain. The valley is beautiful, but it is also solid.",
    "runway heading": "You touched down across the runway. Line up with the strip first.",
    "bank angle": "You touched down banked over. Level the wings before the wheels touch.",
    "vertical speed": "You came down too hard. Flare gently — the ground forgives nothing.",
  }[reason] || "The Kestrel is down.";
}

function showDebrief(result) {
  screen = "debrief";
  saveBest(missionDef.id, result.score);
  const lines = [
    [`Rings cleared ${result.rings}/${result.ringsTotal}`, `+${result.rings * 1000}`],
    [`Time ${fmtClock(result.elapsed)} (par ${fmtClock(result.par)})`, `+${result.timeBonus}`],
    [
      `Landing — base ${result.landing.base}, soft ${result.landing.soft}, centre ${result.landing.centre}`,
      `+${result.landing.total}`,
    ],
    ["Fuel remaining bonus", `+${result.fuelBonus}`],
  ];
  if (result.hard) lines.push(["Hard landing — the undercarriage will remember this", ""]);
  if (result.belly) lines.push(["Belly landing — gear was up", ""]);
  const buttons = [];
  if (missionIndex + 1 < MISSIONS.length) {
    buttons.push({ label: `Next: ${MISSIONS[missionIndex + 1].name}`, onClick: () => startMission(missionIndex + 1) });
  }
  buttons.push({ label: "Fly again", onClick: () => startMission(missionIndex) });
  buttons.push({ label: "Menu", onClick: backToMenu });
  hud.showDebrief(`Sortie complete — ${missionDef.name}`, lines, result.score, buttons);
  audio.fanfare();
}

function fmtClock(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

// Wind for this mission: a steady valley breeze, gusting on Storm Ridge.
function windAt(t) {
  const base = missionDef.wind;
  const gust = base * (0.7 + 0.5 * Math.sin(t * 0.7) + 0.3 * Math.sin(t * 1.9));
  return { x: gust * 0.85, z: gust * 0.5, speed: Math.abs(gust), dir: Math.atan2(gust * 0.85, gust * 0.5) };
}

function hudView() {
  const nextPos = runner ? runner.nextRingPos() : null;
  let ringDist = null;
  let ringBearing = null;
  let ringAhead = false;
  if (nextPos) {
    const dx = nextPos.x - flight.x;
    const dz = nextPos.z - flight.z;
    ringDist = Math.sqrt(dx * dx + (nextPos.y - flight.y) ** 2 + dz * dz);
    const bearing = Math.atan2(dx, -dz) * DEG;
    let rel = ((bearing - flight.heading * DEG + 540) % 360) - 180;
    ringBearing = rel;
    ringAhead = Math.abs(rel) < 25;
  }
  const agl = flight.y - terrainHeight(flight.x, flight.z);
  return {
    speedKt: flight.speed * MS_TO_KT,
    altFt: flight.y * M_TO_FT,
    aglFt: agl * M_TO_FT,
    vsFpm: flight.verticalSpeed * 196.85,
    headingDeg: ((flight.heading * DEG) % 360 + 360) % 360,
    pitch: flight.pitch,
    roll: flight.roll,
    elapsed: runner ? runner.state.elapsed : 0,
    score: runner ? runner.state.score : 0,
    ringsCleared: runner ? runner.state.ringsCleared : 0,
    ringsTotal: missionDef.rings.length,
    nextRingDist: ringDist,
    ringBearing,
    ringAhead,
    objective: runner ? runner.objectiveText() : "",
    fuel: flight.fuel,
    damage: flight.damage,
    throttle,
    gearDown: flight.gearDown,
    flaps: flight.flaps,
    stalled: flight.stalled && !flight.onGround,
    gearWarning: !flight.onGround && !flight.gearDown && agl < 100,
  };
}

function handleFlightEvents(events) {
  for (const ev of events) {
    if (ev.type === "ring") {
      hud.flash(`Ring ${ev.index + 1} cleared  +${ev.points}`, "#7dff9a");
      audio.ring();
    } else if (ev.type === "all-rings") {
      hud.flash("All rings cleared — land on runway 36", "#ffe9b0");
    } else if (ev.type === "liftoff") {
      hud.flash("Airborne — gear up when ready", "#bfe9ff");
    } else if (ev.type === "stall") {
      hud.flash("STALL — lower the nose, add power", "#ff6a5e");
      audio.warning();
    } else if (ev.type === "fuel-empty") {
      hud.flash("FUEL EMPTY — gliding. Find the runway.", "#ff6a5e");
      audio.warning();
    } else if (ev.type === "touchdown" || ev.type === "hard-landing" || ev.type === "belly-landing") {
      audio.touchdown();
      const result = runner.onLanding(ev, flight);
      if (result && result.type === "complete") {
        showDebrief(result);
      } else if (result && result.type === "refuel") {
        hud.flash("Refuelled and patched — back in the air when ready", "#7dff9a");
      } else if (ev.type === "hard-landing") {
        hud.flash("Hard landing! Damage +25", "#ff6a5e");
      } else if (ev.type === "belly-landing") {
        hud.flash("Belly landing! Gear was up — damage +40", "#ff6a5e");
      } else {
        hud.flash("Touchdown", "#bfe9ff");
      }
    } else if (ev.type === "crash") {
      audio.crash();
      screen = "crashed";
      hud.showCrash(crashReasonText(ev.reason));
    }
  }
}

function step(dt) {
  time += dt;
  const wind = windAt(time);
  if (screen === "flying") {
    const f = input.readFlight();
    // Throttle: Shift/Ctrl keys, or the mouse wheel.
    throttle = Math.min(1, Math.max(0, throttle + f.throttleKey * 0.7 * dt + input.consumeWheel() * 0.08));
    // Storm Ridge gusts shove the wings around.
    const gustRoll = missionDef.wind >= 5 ? Math.sin(time * 1.3) * 0.12 + Math.sin(time * 3.1) * 0.06 : 0;
    if (input.consume("flaps")) {
      flight.flaps = !flight.flaps;
      hud.flash(flight.flaps ? "Flaps down" : "Flaps up", "#bfe9ff");
      audio.click();
    }
    if (input.consume("gear")) {
      flight.gearDown = !flight.gearDown;
      hud.flash(flight.gearDown ? "Gear down" : "Gear up", "#bfe9ff");
      audio.click();
    }
    if (input.consume("camera")) {
      cameraMode = cameraMode === "chase" ? "cockpit" : "chase";
      hud.setCockpitMode(cameraMode === "cockpit");
      plane.setCockpitMode(cameraMode === "cockpit");
      audio.click();
    }
    if (input.consume("mute")) {
      const muted = audio.toggleMute();
      hud.flash(muted ? "Sound off" : "Sound on", "#bfe9ff");
    }
    if (input.consume("pause")) {
      screen = "paused";
      hud.showPause(true);
      return;
    }
    const events = stepFlight(
      flight,
      { pitch: f.pitch, roll: f.roll + gustRoll, throttle },
      dt,
      { terrainHeight, wind, time }
    );
    handleFlightEvents(events);
    if (screen === "flying") {
      const ringEvents = runner.update(dt, flight);
      handleFlightEvents(ringEvents);
    }
    if (flight.stalled && !flight.onGround && time - lastStallBeep > 1.2) {
      lastStallBeep = time;
      audio.warning();
    }
    audio.update({ throttle, speed: flight.speed, onGround: flight.onGround, running: true });
    input.endFrame();
  } else if (screen === "paused") {
    if (input.consume("pause")) {
      screen = "flying";
      hud.showPause(false);
    }
    input.endFrame();
  } else if (screen === "shot") {
    // Frozen pose: the prop still spins and the clouds still drift.
    plane.setControls(
      { rollInput: 0, pitchInput: 0, throttle: flight.throttle, flapsDown: flight.flaps, gearDown: flight.gearDown },
      dt
    );
  }
  if (screen === "flying" || screen === "shot" || screen === "paused") {
    if (screen === "flying") {
      plane.setControls(
        {
          rollInput: input.readFlight().roll,
          pitchInput: input.readFlight().pitch,
          throttle,
          flapsDown: flight.flaps,
          gearDown: flight.gearDown,
        },
        dt
      );
    }
    posePlane(plane.group, flight);
    if (cameraMode === "cockpit") cameraRig.updateCockpit(flight);
    else cameraRig.updateChase(flight, dt);
    world.updateClouds(dt);
    terrain.updateWindsock(wind.speed, wind.dir, time);
    if (ringsApi) ringsApi.pulse(time);
    hud.update(hudView());
  }
}

// Crash / debrief buttons.
document.getElementById("crash-retry").addEventListener("click", () => startMission(missionIndex));
document.getElementById("crash-menu").addEventListener("click", backToMenu);
document.getElementById("pause-resume").addEventListener("click", () => {
  screen = "flying";
  hud.showPause(false);
});
document.getElementById("pause-menu").addEventListener("click", backToMenu);
document.getElementById("start-hint").addEventListener("click", () => {
  audio.unlock();
});

if (shotMode) {
  const mission = getShotMission(shotParam);
  missionIndex = mission;
  missionDef = MISSIONS[mission];
  ringsApi = buildRings(scene, missionDef.rings);
  runner = createMissionRunner(missionDef, ringsApi);
  resetOnRunway(flight);
  cameraMode = applyShot(shotParam, flight, runner, ringsApi);
  hud.setCockpitMode(cameraMode === "cockpit");
  plane.setCockpitMode(cameraMode === "cockpit");
  hud.showHud(missionDef.name);
  hud.flash(missionDef.name, "#ffe9b0");
  screen = "shot";
} else {
  backToMenu();
}

// Menu keyboard: Enter starts the first mission.
window.addEventListener("keydown", (e) => {
  if (screen === "menu" && e.code === "Enter") startMission(0);
});

// Debug handle for play-testing: lets a test drive the game and read state.
window.__ridgeline = {
  flight,
  startMission,
  get screen() {
    return screen;
  },
  get runner() {
    return runner;
  },
};

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  step(dt);
  renderer.render(scene, camera);
}
loop();
