// hud.js — every instrument and screen the pilot sees: the lit HUD
// (airspeed, altitude, heading tape, attitude ball, fuel, throttle), the
// flash messages, and the menu / debrief / crash / pause screens.

const MS_TO_KT = 1.94384;
const M_TO_FT = 3.28084;

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function createHud(doc) {
  const $ = (id) => doc.getElementById(id);
  const els = {
    hud: $("hud"),
    missionName: $("mission-name"),
    ringCount: $("ring-count"),
    ringDistance: $("ring-distance"),
    timer: $("timer"),
    objective: $("objective"),
    compass: $("compass-canvas"),
    score: $("score"),
    fuelFill: $("fuel-fill"),
    fuelText: $("fuel-text"),
    damageFill: $("damage-fill"),
    speed: $("speed"),
    throttleFill: $("throttle-fill"),
    gearInd: $("gear-ind"),
    flapsInd: $("flaps-ind"),
    attitude: $("attitude-canvas"),
    altitude: $("altitude"),
    altAgl: $("alt-agl"),
    vspeed: $("vspeed"),
    ringArrow: $("ring-arrow"),
    message: $("message"),
    warnStall: $("warn-stall"),
    warnFuel: $("warn-fuel"),
    warnGear: $("warn-gear"),
    menu: $("menu"),
    missionList: $("mission-list"),
    debrief: $("debrief"),
    debriefTitle: $("debrief-title"),
    debriefLines: $("debrief-lines"),
    debriefTotal: $("debrief-total"),
    crash: $("crash-screen"),
    crashReason: $("crash-reason"),
    pause: $("pause-screen"),
    cockpitFrame: $("cockpit-frame"),
  };
  const compassCtx = els.compass.getContext("2d");
  const attCtx = els.attitude.getContext("2d");
  let messageTimer = null;

  function drawCompass(headingDeg) {
    const w = els.compass.width;
    const h = els.compass.height;
    compassCtx.clearRect(0, 0, w, h);
    compassCtx.fillStyle = "rgba(8, 14, 22, 0.55)";
    compassCtx.fillRect(0, 0, w, h);
    compassCtx.strokeStyle = "rgba(140, 220, 255, 0.7)";
    compassCtx.fillStyle = "#bfe9ff";
    compassCtx.font = "bold 13px sans-serif";
    compassCtx.textAlign = "center";
    const pxPerDeg = 2.2;
    const centre = w / 2;
    for (let d = -120; d <= 120; d += 5) {
      const deg = ((Math.round(headingDeg) + d) % 360 + 360) % 360;
      const x = centre + d * pxPerDeg;
      const major = deg % 30 === 0;
      const len = major ? 12 : 6;
      compassCtx.beginPath();
      compassCtx.moveTo(x, h - 4);
      compassCtx.lineTo(x, h - 4 - len);
      compassCtx.stroke();
      if (major) {
        const label = deg === 0 ? "N" : deg === 90 ? "E" : deg === 180 ? "S" : deg === 270 ? "W" : String(deg);
        compassCtx.fillText(label, x, 16);
      }
    }
    // Centre caret + heading readout.
    compassCtx.fillStyle = "#ffb02e";
    compassCtx.beginPath();
    compassCtx.moveTo(centre - 7, 0);
    compassCtx.lineTo(centre + 7, 0);
    compassCtx.lineTo(centre, 9);
    compassCtx.closePath();
    compassCtx.fill();
    compassCtx.font = "bold 15px sans-serif";
    compassCtx.fillText(`${String(Math.round(headingDeg) % 360).padStart(3, "0")}°`, centre, h - 18);
  }

  function drawAttitude(pitch, roll) {
    const w = els.attitude.width;
    const h = els.attitude.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = w / 2 - 4;
    attCtx.save();
    attCtx.beginPath();
    attCtx.arc(cx, cy, r, 0, Math.PI * 2);
    attCtx.clip();
    attCtx.translate(cx, cy);
    attCtx.rotate(-roll);
    const pitchPx = pitch * 70;
    attCtx.fillStyle = "#3f7fc9";
    attCtx.fillRect(-r - 10, -r - 10 - pitchPx, r * 2 + 20, r + 10 + pitchPx);
    attCtx.fillStyle = "#8a5a33";
    attCtx.fillRect(-r - 10, -pitchPx, r * 2 + 20, r + 10 + pitchPx);
    attCtx.strokeStyle = "#ffffff";
    attCtx.lineWidth = 2;
    attCtx.beginPath();
    attCtx.moveTo(-r, -pitchPx);
    attCtx.lineTo(r, -pitchPx);
    attCtx.stroke();
    // Pitch ladder.
    attCtx.lineWidth = 1;
    attCtx.font = "9px sans-serif";
    attCtx.textAlign = "left";
    for (const deg of [-20, -10, 10, 20]) {
      const y = -pitchPx - (deg * Math.PI) / 180 * 70;
      attCtx.beginPath();
      attCtx.moveTo(-18, y);
      attCtx.lineTo(18, y);
      attCtx.stroke();
    }
    attCtx.restore();
    // Fixed aircraft symbol + roll pointer.
    attCtx.strokeStyle = "#ffb02e";
    attCtx.lineWidth = 3;
    attCtx.beginPath();
    attCtx.moveTo(cx - 26, cy);
    attCtx.lineTo(cx + 26, cy);
    attCtx.moveTo(cx, cy - 4);
    attCtx.lineTo(cx, cy + 4);
    attCtx.stroke();
    attCtx.fillStyle = "#ffb02e";
    attCtx.beginPath();
    attCtx.arc(cx, cy - r + 8, 3, 0, Math.PI * 2);
    attCtx.fill();
    attCtx.strokeStyle = "rgba(255,255,255,0.5)";
    attCtx.lineWidth = 1;
    attCtx.beginPath();
    attCtx.arc(cx, cy, r, 0, Math.PI * 2);
    attCtx.stroke();
  }

  return {
    showMenu(missions, bests, onSelect) {
      els.menu.style.display = "flex";
      els.hud.style.display = "none";
      els.debrief.style.display = "none";
      els.crash.style.display = "none";
      els.pause.style.display = "none";
      els.missionList.innerHTML = "";
      missions.forEach((m, i) => {
        const card = doc.createElement("button");
        card.className = "mission-card";
        const best = bests[m.id];
        card.innerHTML =
          `<span class="mission-num">${i + 1}</span>` +
          `<span class="mission-title">${m.name}</span>` +
          `<span class="mission-brief">${m.briefing}</span>` +
          `<span class="mission-meta">${m.rings.length} rings · par ${fmtTime(m.parSeconds)}` +
          (best ? ` · best ${best.toLocaleString()} pts` : " · not flown yet") +
          `</span>`;
        card.addEventListener("click", () => onSelect(i));
        els.missionList.appendChild(card);
      });
    },
    showHud(missionName) {
      els.menu.style.display = "none";
      els.debrief.style.display = "none";
      els.crash.style.display = "none";
      els.pause.style.display = "none";
      els.hud.style.display = "block";
      els.missionName.textContent = missionName;
    },
    // Called every frame while flying.
    update(view) {
      els.speed.textContent = Math.round(view.speedKt);
      els.altitude.textContent = Math.round(view.altFt).toLocaleString();
      els.altAgl.textContent = `AGL ${Math.round(view.aglFt).toLocaleString()} ft`;
      els.vspeed.textContent = `${view.vsFpm >= 0 ? "+" : ""}${Math.round(view.vsFpm)} fpm`;
      els.timer.textContent = fmtTime(view.elapsed);
      els.score.textContent = view.score.toLocaleString();
      els.ringCount.textContent = `${view.ringsCleared}/${view.ringsTotal}`;
      els.ringDistance.textContent =
        view.nextRingDist == null ? "—" : `${Math.round(view.nextRingDist)} m`;
      els.objective.textContent = view.objective;
      els.fuelFill.style.width = `${Math.max(0, view.fuel)}%`;
      els.fuelFill.classList.toggle("low", view.fuel < 20);
      els.fuelText.textContent = `${Math.round(view.fuel)}%`;
      els.damageFill.style.width = `${view.damage}%`;
      els.throttleFill.style.width = `${Math.round(view.throttle * 100)}%`;
      els.gearInd.textContent = view.gearDown ? "GEAR DOWN" : "GEAR UP";
      els.gearInd.classList.toggle("warn", !view.gearDown);
      els.flapsInd.textContent = view.flaps ? "FLAPS" : "";
      drawCompass(view.headingDeg);
      drawAttitude(view.pitch, view.roll);
      if (view.ringBearing != null) {
        els.ringArrow.style.display = "block";
        els.ringArrow.style.transform = `translate(-50%, -50%) rotate(${view.ringBearing}deg)`;
        els.ringArrow.style.opacity = view.ringAhead ? "0.45" : "1";
      } else {
        els.ringArrow.style.display = "none";
      }
      els.warnStall.style.display = view.stalled ? "block" : "none";
      els.warnFuel.style.display = view.fuel < 20 && view.fuel > 0 ? "block" : "none";
      els.warnGear.style.display = view.gearWarning ? "block" : "none";
    },
    flash(text, color = "#ffffff") {
      els.message.textContent = text;
      els.message.style.color = color;
      els.message.style.opacity = "1";
      if (messageTimer) clearTimeout(messageTimer);
      messageTimer = setTimeout(() => {
        els.message.style.opacity = "0";
      }, 1800);
    },
    showDebrief(title, lines, total, buttons) {
      els.hud.style.display = "none";
      els.debrief.style.display = "flex";
      els.debriefTitle.textContent = title;
      els.debriefLines.innerHTML = lines.map((l) => `<div class="debrief-row"><span>${l[0]}</span><b>${l[1]}</b></div>`).join("");
      els.debriefTotal.textContent = total.toLocaleString();
      const bar = $("debrief-buttons");
      bar.innerHTML = "";
      buttons.forEach((b) => {
        const btn = doc.createElement("button");
        btn.className = "big-button";
        btn.textContent = b.label;
        btn.addEventListener("click", b.onClick);
        bar.appendChild(btn);
      });
    },
    showCrash(reason) {
      els.hud.style.display = "none";
      els.crash.style.display = "flex";
      els.crashReason.textContent = reason;
    },
    showPause(show) {
      els.pause.style.display = show ? "flex" : "none";
    },
    setCockpitMode(on) {
      els.cockpitFrame.style.display = on ? "block" : "none";
    },
    hideAllScreens() {
      els.menu.style.display = "none";
      els.debrief.style.display = "none";
      els.crash.style.display = "none";
      els.pause.style.display = "none";
    },
  };
}
