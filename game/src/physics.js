// physics.js — the arcade flight model: thrust, drag, lift, stall, banking
// turns, wind, and the ground. It knows nothing about rendering; it steps a
// plain state object and reports what happened as events.

import { PLANE, RUNWAY, SCORING } from "./config.js";

export function createFlightState() {
  return {
    x: RUNWAY.x,
    y: 0, // set by resetOnRunway
    z: RUNWAY.z + 200,
    heading: 0, // 0 = north, towards -z
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    flaps: false,
    gearDown: true,
    fuel: PLANE.fuelCapacity,
    damage: 0,
    onGround: true,
    verticalSpeed: 0,
    stalled: false,
    engineOut: false,
  };
}

export function resetOnRunway(state) {
  state.x = RUNWAY.x;
  state.z = RUNWAY.z + 200;
  state.heading = 0;
  state.pitch = 0;
  state.roll = 0;
  state.speed = 0;
  state.throttle = 0;
  state.flaps = false;
  state.gearDown = true;
  state.fuel = PLANE.fuelCapacity;
  state.damage = 0;
  state.onGround = true;
  state.verticalSpeed = 0;
  state.stalled = false;
  state.engineOut = false;
  state._stallReported = false;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// input: { pitch: -1..1 (positive pulls the nose up),
//          roll: -1..1 (positive banks right),
//          throttle: 0..1 }
// env: { terrainHeight(x, z), wind: { x, z, speed, dir }, time }
// Returns an array of events: stall, fuel-empty, touchdown, hard-landing,
// belly-landing, crash.
export function stepFlight(state, input, dt, env) {
  const events = [];
  const stallSpeed = state.flaps ? PLANE.stallFlaps : PLANE.stallClean;

  // Fuel burns with throttle; an empty tank kills the engine.
  if (!state.engineOut) {
    const burn = PLANE.fuelBurnIdle + (PLANE.fuelBurnFull - PLANE.fuelBurnIdle) * input.throttle;
    state.fuel = Math.max(0, state.fuel - burn * dt);
    if (state.fuel <= 0) {
      state.engineOut = true;
      events.push({ type: "fuel-empty" });
    }
  }
  state.throttle = state.engineOut ? 0 : input.throttle;

  const speedAuthority = 0.35 + 0.65 * Math.min(1, state.speed / 45);

  if (state.onGround) {
    // Rolling on the strip: throttle accelerates, the nose stays level,
    // and the pilot can steer gently with the ailerons.
    const rollingDrag = 0.9 + 0.0015 * state.speed * state.speed;
    const accel = state.throttle * PLANE.thrustAccel - rollingDrag;
    state.speed = Math.max(0, state.speed + accel * dt);
    state.heading += input.roll * 0.5 * Math.min(1, state.speed / 20) * dt;
    state.pitch = 0;
    state.roll *= Math.max(0, 1 - dt * 3);
    if (state.speed > stallSpeed * 0.95 && input.pitch > 0.25) {
      state.onGround = false;
      state.pitch = 0.12;
      // Clear the ground so this step's contact check does not re-touchdown.
      state.y = env.terrainHeight(state.x, state.z) + 2.2;
      events.push({ type: "liftoff" });
    }
  } else {
    // In the air: elevator, ailerons, and a coordinated banking turn.
    state.pitch += input.pitch * PLANE.pitchRate * speedAuthority * dt;
    state.pitch = clamp(state.pitch, -0.6, 0.6);
    if (Math.abs(input.pitch) < 0.05) state.pitch -= state.pitch * 0.12 * dt;
    state.roll += input.roll * PLANE.rollRate * speedAuthority * dt;
    state.roll = clamp(state.roll, -PLANE.maxBank, PLANE.maxBank);
    if (Math.abs(input.roll) < 0.05) state.roll -= state.roll * 1.1 * dt;
    state.heading += (PLANE.gravity * Math.tan(state.roll) / Math.max(state.speed, 12)) * dt;

    // Thrust fights drag and the cost of climbing.
    const drag = (PLANE.dragK + (state.flaps ? PLANE.flapDrag : 0)) * state.speed * state.speed;
    const accel = state.throttle * PLANE.thrustAccel - drag - PLANE.gravity * Math.sin(state.pitch);
    state.speed = Math.max(0, state.speed + accel * dt);

    // Lift: below stall speed the wing gives up and the plane sinks.
    const lift = clamp(state.speed / stallSpeed, 0, 1);
    state.stalled = state.speed < stallSpeed * 0.92;
    if (state.stalled && !state._stallReported) {
      events.push({ type: "stall" });
      state._stallReported = true;
    } else if (!state.stalled) {
      state._stallReported = false;
    }
    const sink = (1 - lift) * 9;
    const cp = Math.cos(state.pitch);
    const vx = Math.sin(state.heading) * cp * state.speed + env.wind.x;
    const vy = Math.sin(state.pitch) * state.speed - sink;
    const vz = -Math.cos(state.heading) * cp * state.speed + env.wind.z;
    state.x += vx * dt;
    state.y += vy * dt;
    state.z += vz * dt;
    state.verticalSpeed = vy;
  }

  if (state.onGround) {
    // Roll along the ground in the heading direction.
    const vx = Math.sin(state.heading) * state.speed;
    const vz = -Math.cos(state.heading) * state.speed;
    state.x += vx * dt;
    state.z += vz * dt;
    state.verticalSpeed = 0;
    // Friction and brakes bleed speed when the throttle is closed.
    if (state.throttle < 0.05) state.speed = Math.max(0, state.speed - 2.5 * dt);
  }

  // Keep the plane inside the world; the mountains are a wall, not a void.
  const half = 2050;
  state.x = clamp(state.x, -half, half);
  state.z = clamp(state.z, -half, half);

  // Ground contact.
  const groundY = env.terrainHeight(state.x, state.z) + 1.55;
  if (!state.onGround && state.y <= groundY) {
    state.y = groundY;
    const vs = state.verticalSpeed;
    const onStrip =
      Math.abs(state.x - RUNWAY.x) < RUNWAY.width / 2 + 3 &&
      Math.abs(state.z - RUNWAY.z) < RUNWAY.length / 2 + 10;
    const aligned = Math.abs(Math.sin(state.heading)) < 0.35; // roughly north/south
    const level = Math.abs(state.roll) < 0.6;
    if (onStrip && aligned && level && vs > -SCORING.crashVs) {
      state.onGround = true;
      state.pitch = 0;
      state.roll = 0;
      if (vs < -SCORING.hardLandingVs) {
        state.damage = Math.min(100, state.damage + 25);
        events.push({ type: "hard-landing", vspeed: vs, gearDown: state.gearDown });
      } else if (!state.gearDown) {
        state.damage = Math.min(100, state.damage + PLANE.gearDamageOnBelly);
        events.push({ type: "belly-landing", vspeed: vs });
      } else {
        events.push({ type: "touchdown", vspeed: vs, x: state.x, z: state.z, heading: state.heading });
      }
    } else {
      const reason = !onStrip
        ? "terrain"
        : !aligned
          ? "runway heading"
          : !level
            ? "bank angle"
            : "vertical speed";
      events.push({ type: "crash", reason, vspeed: vs });
    }
  }
  if (state.onGround) state.y = env.terrainHeight(state.x, state.z) + 1.55;
  return events;
}
