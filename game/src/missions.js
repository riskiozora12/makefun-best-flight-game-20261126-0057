// missions.js — the sortie: fly the rings in order, then bring the plane
// home. Landing early is allowed and refuels the plane, so fuel is a
// decision, not a timer. The score is rings, time under par, landing quality
// and fuel left over.

import { SCORING } from "./config.js";

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

export function createMissionRunner(def, ringsApi) {
  const state = {
    ringsCleared: 0,
    phase: "rings", // rings -> return -> done
    elapsed: 0,
    started: false,
    score: 0,
    ringPoints: 0,
    timeBonus: 0,
    landing: null,
    fuelBonus: 0,
  };

  function nextRing() {
    if (state.ringsCleared >= def.rings.length) return null;
    return ringsApi.rings[state.ringsCleared];
  }

  return {
    state,
    def,
    start() {
      state.started = true;
      state.elapsed = 0;
      ringsApi.markNext(0);
    },
    // Called every frame with the plane's position. Returns ring events.
    update(dt, planePos) {
      const events = [];
      if (!state.started || state.phase === "done") return events;
      state.elapsed += dt;
      const ring = nextRing();
      if (ring && state.phase === "rings") {
        const dx = planePos.x - ring.group.position.x;
        const dy = planePos.y - ring.group.position.y;
        const dz = planePos.z - ring.group.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < ring.def.r * 0.85) {
          ring.cleared = true;
          state.ringsCleared++;
          state.ringPoints += SCORING.ringPoints;
          state.score += SCORING.ringPoints;
          events.push({ type: "ring", index: ring.index, points: SCORING.ringPoints });
          if (state.ringsCleared >= def.rings.length) {
            state.phase = "return";
            ringsApi.markNext(-1);
            events.push({ type: "all-rings" });
          } else {
            ringsApi.markNext(state.ringsCleared);
          }
        }
      }
      return events;
    },
    nextRingPos() {
      const ring = nextRing();
      return ring ? ring.group.position : null;
    },
    nextRingDef() {
      return nextRing() ? nextRing().def : null;
    },
    // A touchdown (or a hard / belly landing) on the strip. Returns a result
    // object when the sortie ends, or null when the pilot just refuelled.
    onLanding(ev, flight) {
      if (state.phase === "done") return null;
      const vs = Math.abs(ev.vspeed || 0);
      const centreErr = Math.abs(flight.x);
      if (state.phase !== "return") {
        // Early landing: the crew refuels and patches the plane, and the
        // sortie continues from the runway.
        flight.fuel = 100;
        flight.damage = 0;
        return { type: "refuel" };
      }
      // Final landing: score it.
      const soft = clamp(1 - (vs - 1) / 2.5, 0, 1) * SCORING.landingSoftMax;
      const centre = clamp(1 - centreErr / 15, 0, 1) * SCORING.landingCentreMax;
      const base = ev.type === "belly-landing" ? 400 : SCORING.landingBase;
      const landingScore = Math.round(base + soft + centre);
      state.timeBonus = Math.max(0, Math.round((def.parSeconds - state.elapsed) * SCORING.timeBonusPerSecond));
      state.fuelBonus = Math.round(flight.fuel * SCORING.fuelBonusPerUnit);
      state.landing = { base, soft: Math.round(soft), centre: Math.round(centre), total: landingScore, vspeed: vs };
      state.score += landingScore + state.timeBonus + state.fuelBonus;
      state.phase = "done";
      return {
        type: "complete",
        score: state.score,
        rings: state.ringsCleared,
        ringsTotal: def.rings.length,
        elapsed: state.elapsed,
        par: def.parSeconds,
        timeBonus: state.timeBonus,
        landing: state.landing,
        fuelBonus: state.fuelBonus,
        hard: ev.type === "hard-landing",
        belly: ev.type === "belly-landing",
      };
    },
    objectiveText() {
      if (state.phase === "rings") return `Fly through ring ${state.ringsCleared + 1} of ${def.rings.length}`;
      if (state.phase === "return") return "All rings cleared — land on runway 36";
      return "Sortie complete";
    },
  };
}
