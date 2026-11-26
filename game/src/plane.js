// plane.js — the Kestrel bush plane, built from primitives.
// Cream fuselage, red cheatline, high wing, spinning prop, working flaps,
// ailerons, elevator and retractable gear. Nothing here is a copy of any
// real aircraft: it is a plain bush plane drawn from boxes and cylinders.

import * as THREE from "three";
import { COLOURS } from "./config.js";

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15, ...opts });
}

function box(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

// Build the aircraft. Returns the group plus an animator for its moving parts.
export function buildPlane() {
  const cream = std(COLOURS.planeCream);
  const red = std(COLOURS.planeRed);
  const dark = std(COLOURS.planeDark);
  const glass = std(0x1d2f42, { roughness: 0.15, metalness: 0.5 });
  const group = new THREE.Group();

  // Fuselage: a tapered tube along z (nose at -z), cream with a red belly stripe.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 4.6, 12), cream);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = 0.2;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 1.0, 12), cream);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -2.4;
  group.add(nose);
  const belly = box(1.1, 0.22, 4.4, red);
  belly.position.set(0, -0.72, 0.2);
  group.add(belly);

  // Cabin: glasshouse on top, two seats' worth of windows.
  const cabin = box(1.25, 0.75, 1.9, glass);
  cabin.position.set(0, 0.72, -0.5);
  group.add(cabin);
  const cabinRoof = box(1.3, 0.1, 2.0, cream);
  cabinRoof.position.set(0, 1.12, -0.5);
  group.add(cabinRoof);

  // High wing: one long slab with red tips, on short struts.
  const wing = box(11, 0.16, 1.8, cream);
  wing.position.set(0, 1.25, -0.35);
  group.add(wing);
  for (const side of [-1, 1]) {
    const tip = box(0.9, 0.18, 1.8, red);
    tip.position.set(side * 5.05, 1.25, -0.35);
    group.add(tip);
    const strut = box(0.08, 1.15, 0.08, dark);
    strut.position.set(side * 1.9, 0.62, -0.35);
    strut.rotation.z = side * 0.35;
    group.add(strut);
  }

  // Ailerons: outer trailing-edge panels, driven by roll input.
  const ailerons = {};
  for (const side of [-1, 1]) {
    const a = box(2.6, 0.08, 0.5, red);
    a.position.set(side * 3.9, 1.22, 0.68);
    a.geometry.translate(0, 0, 0.25); // hinge at the leading edge
    a.position.z = 0.43;
    group.add(a);
    ailerons[side < 0 ? "left" : "right"] = a;
  }

  // Flaps: inner trailing-edge panels, drop when the pilot calls for them.
  const flaps = {};
  for (const side of [-1, 1]) {
    const f = box(1.9, 0.08, 0.55, cream);
    f.geometry.translate(0, 0, 0.27);
    f.position.set(side * 1.6, 1.22, 0.43);
    group.add(f);
    flaps[side < 0 ? "left" : "right"] = f;
  }

  // Tail: horizontal stabiliser + fin, with a moving elevator.
  const tailplane = box(3.6, 0.1, 1.0, cream);
  tailplane.position.set(0, 0.15, 2.45);
  group.add(tailplane);
  const elevator = box(3.6, 0.08, 0.45, red);
  elevator.geometry.translate(0, 0, 0.22);
  elevator.position.set(0, 0.15, 2.95);
  group.add(elevator);
  const fin = box(0.1, 1.5, 1.3, red);
  fin.position.set(0, 0.75, 2.5);
  group.add(fin);
  const rudder = box(0.08, 1.1, 0.5, cream);
  rudder.geometry.translate(0, 0, 0.25);
  rudder.position.set(0, 0.7, 3.05);
  group.add(rudder);

  // Propeller: hub, two blades, and a translucent blur disc at speed.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 10), dark);
  hub.rotation.x = -Math.PI / 2;
  prop.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.22, 3.4, 0.06);
  bladeGeo.translate(0, 0, 0);
  const blade1 = new THREE.Mesh(bladeGeo, dark);
  const blade2 = blade1.clone();
  blade2.rotation.z = Math.PI / 2;
  prop.add(blade1, blade2);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.75, 24),
    new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  prop.add(disc);
  prop.position.set(0, 0, -2.95);
  group.add(prop);

  // Landing gear: two mains + tail wheel, folding up into the belly.
  const gear = new THREE.Group();
  for (const side of [-1, 1]) {
    const leg = box(0.1, 1.1, 0.1, dark);
    leg.position.set(side * 0.85, -1.0, -0.6);
    gear.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 0.85, -1.55, -0.6);
    gear.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 10), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.85, 2.5);
  gear.add(tailWheel);
  group.add(gear);

  // Navigation lights: red port, green starboard, white tail.
  const lightGeo = new THREE.SphereGeometry(0.09, 8, 8);
  const navL = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
  navL.position.set(-5.5, 1.25, -0.35);
  const navR = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0x2aff66 }));
  navR.position.set(5.5, 1.25, -0.35);
  const navT = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  navT.position.set(0, 0.15, 3.05);
  group.add(navL, navR, navT);

  let gearAmount = 1; // 1 = down, 0 = up
  let flapAmount = 0;

  return {
    group,
    // In cockpit view the cabin glass, roof, prop blades and blur disc sit
    // between the pilot's eyes and the sky, so hide them; the nose stays.
    setCockpitMode(on) {
      cabin.visible = !on;
      cabinRoof.visible = !on;
      blade1.visible = !on;
      blade2.visible = !on;
      disc.visible = !on;
    },
    // Drive the moving parts from the current control state.
    setControls({ rollInput, pitchInput, throttle, flapsDown, gearDown }, dt) {
      prop.rotation.z -= dt * (4 + throttle * 55);
      disc.material.opacity = Math.min(0.16, throttle * 0.2);
      ailerons.left.rotation.x = rollInput * 0.5;
      ailerons.right.rotation.x = -rollInput * 0.5;
      elevator.rotation.x = pitchInput * 0.45;
      rudder.rotation.y = -rollInput * 0.3;
      flapAmount += ((flapsDown ? 1 : 0) - flapAmount) * Math.min(1, dt * 3);
      flaps.left.rotation.x = flapAmount * 0.6;
      flaps.right.rotation.x = flapAmount * 0.6;
      gearAmount += ((gearDown ? 1 : 0) - gearAmount) * Math.min(1, dt * 2.2);
      gear.rotation.x = (1 - gearAmount) * 1.35;
      gear.position.y = (1 - gearAmount) * 0.9;
    },
  };
}
