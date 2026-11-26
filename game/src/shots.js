// shots.js — frozen poses for the screenshots. Each shot parks the plane in
// a photogenic attitude with the HUD live, so the screenshots are real
// renders of the game's own code, taken in a browser, and reproducible.

import { MISSIONS } from "./config.js";

export const SHOT_MISSIONS = { 1: 0, 2: 1, 3: 0, 4: 2 };

export function getShotMission(shot) {
  return SHOT_MISSIONS[shot] ?? 0;
}

// flight: the mutable flight state; runner: the mission runner; rings: the
// ring handles. Returns the camera mode for the shot.
export function applyShot(shot, flight, runner, ringsApi) {
  const defs = {
    // Cover: banking through ring 3 of Dawn Patrol, valley and river below.
    1: {
      mission: 0,
      ringsCleared: 2,
      elapsed: 47,
      score: 2140,
      camera: "chase",
      pose: { x: 170, y: 132, z: -110, heading: -0.42, pitch: 0.06, roll: 0.38, speed: 56, throttle: 0.78 },
    },
    // Low over the river on River Run, the next ring glowing ahead.
    2: {
      mission: 1,
      ringsCleared: 1,
      elapsed: 63,
      score: 1080,
      camera: "chase",
      pose: { x: -54, y: 30, z: 520, heading: -0.1, pitch: 0.0, roll: -0.1, speed: 63, throttle: 0.82 },
    },
    // Final approach: gear and flaps down, runway 36 centred in the windscreen.
    3: {
      mission: 0,
      ringsCleared: 6,
      elapsed: 132,
      score: 6420,
      camera: "chase",
      pose: { x: 6, y: 62, z: 1780, heading: 0.02, pitch: -0.05, roll: 0.02, speed: 38, throttle: 0.34 },
      gearDown: true,
      flaps: true,
    },
    // Cockpit view climbing out of the pass on Storm Ridge.
    4: {
      mission: 2,
      ringsCleared: 4,
      elapsed: 118,
      score: 4310,
      camera: "cockpit",
      pose: { x: 690, y: 332, z: -820, heading: -0.55, pitch: 0.12, roll: -0.3, speed: 58, throttle: 0.85 },
    },
  };
  const shotDef = defs[shot] || defs[1];
  const p = shotDef.pose;
  flight.x = p.x;
  flight.y = p.y;
  flight.z = p.z;
  flight.heading = p.heading;
  flight.pitch = p.pitch;
  flight.roll = p.roll;
  flight.speed = p.speed;
  flight.throttle = p.throttle;
  flight.onGround = false;
  flight.fuel = 100 - shotDef.elapsed * 0.28;
  flight.damage = 0;
  flight.gearDown = shotDef.gearDown !== undefined ? shotDef.gearDown : true;
  flight.flaps = shotDef.flaps || false;
  // Mark the cleared rings and set the runner's counters to match the pose.
  ringsApi.rings.forEach((r, i) => {
    r.cleared = i < shotDef.ringsCleared;
  });
  runner.state.ringsCleared = shotDef.ringsCleared;
  runner.state.elapsed = shotDef.elapsed;
  runner.state.score = shotDef.score;
  runner.state.ringPoints = shotDef.ringsCleared * 1000;
  runner.state.phase = shotDef.ringsCleared >= MISSIONS[shotDef.mission].rings.length ? "return" : "rings";
  runner.state.started = true;
  ringsApi.markNext(runner.state.phase === "return" ? -1 : shotDef.ringsCleared);
  return shotDef.camera;
}
