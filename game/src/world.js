// world.js — the sky, the sun, the clouds and the glowing rings.
// Builds the scene around the terrain: light, fog, a gradient dome, drifting
// clouds, and the mission rings that the pilot flies through.

import * as THREE from "three";
import { WORLD, COLOURS } from "./config.js";
import { makeRng } from "./random.js";
import { terrainHeight } from "./terrain.js";

const rng = makeRng(777);

function skyDomeTexture() {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#2f6fb2");
  grad.addColorStop(0.45, "#7fb0d8");
  grad.addColorStop(0.72, "#f6c98a");
  grad.addColorStop(1, "#f2b878");
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildSky(scene) {
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(5200, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyDomeTexture(), side: THREE.BackSide, fog: false })
  );
  scene.add(dome);

  // Low dawn sun: a bright disc plus a soft halo sprite.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(150, 32),
    new THREE.MeshBasicMaterial({ color: COLOURS.sun, fog: false })
  );
  sun.position.set(-2600, 620, -4200);
  sun.lookAt(0, 0, 0);
  scene.add(sun);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.75);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffe0b0, 2.1);
  sunLight.position.set(-1800, 1400, -2600);
  scene.add(sunLight);
  scene.fog = new THREE.Fog(COLOURS.fog, WORLD.fogNear, WORLD.fogFar);
  scene.background = new THREE.Color(COLOURS.fog);
}

function buildClouds(scene) {
  // Bright, flat-shaded puffs: lit from the sun they read as clouds, not
  // as grey discs, and fog softens their far edges.
  const clouds = [];
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, fog: true });
  const puffGeo = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < WORLD.cloudCount; i++) {
    const cloud = new THREE.Group();
    const puffs = 4 + Math.floor(rng() * 4);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(puffGeo, mat);
      const s = 45 + rng() * 70;
      puff.scale.set(s, s * 0.26, s * 0.7);
      puff.position.set((rng() - 0.5) * 190, (rng() - 0.5) * 10, (rng() - 0.5) * 100);
      cloud.add(puff);
    }
    cloud.position.set((rng() - 0.5) * 4200, 700 + rng() * 350, (rng() - 0.5) * 4200);
    cloud.userData.drift = 2 + rng() * 3;
    scene.add(cloud);
    clouds.push(cloud);
  }
  return clouds;
}

// Rings: a torus plus a soft inner disc so they read from far away.
// buildRings places them from mission data, clamping each one above the ground.
export function buildRings(scene, ringDefs) {
  const group = new THREE.Group();
  const torusGeo = new THREE.TorusGeometry(1, 0.09, 10, 40);
  const discGeo = new THREE.CircleGeometry(0.92, 32);
  const rings = ringDefs.map((def, i) => {
    const y = Math.max(def.y, terrainHeight(def.x, def.z) + 30);
    const mat = new THREE.MeshBasicMaterial({ color: COLOURS.ring, transparent: true, opacity: 0.9 });
    const torus = new THREE.Mesh(torusGeo, mat);
    torus.scale.setScalar(def.r);
    const discMat = new THREE.MeshBasicMaterial({
      color: COLOURS.ring,
      transparent: true,
      opacity: 0.10,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.scale.setScalar(def.r);
    const ring = new THREE.Group();
    ring.add(torus, disc);
    ring.position.set(def.x, y, def.z);
    // Face the ring towards the previous ring (or the runway for the first).
    const prev = i === 0 ? { x: 0, z: 1450 } : ringDefs[i - 1];
    ring.lookAt(prev.x, y, prev.z);
    group.add(ring);
    return { group: ring, torus, disc, mat, discMat, def, cleared: false, index: i };
  });
  scene.add(group);
  return {
    rings,
    group,
    // Highlight the next ring green and dim the cleared ones.
    markNext(nextIndex) {
      rings.forEach((r, i) => {
        if (r.cleared) {
          r.mat.color.setHex(0x2aff66);
          r.mat.opacity = 0.25;
          r.discMat.opacity = 0.03;
        } else if (i === nextIndex) {
          r.mat.color.setHex(COLOURS.ringNext);
          r.mat.opacity = 1;
          r.discMat.opacity = 0.16;
        } else {
          r.mat.color.setHex(COLOURS.ring);
          r.mat.opacity = 0.85;
          r.discMat.opacity = 0.1;
        }
      });
    },
    pulse(time) {
      rings.forEach((r) => {
        if (r.cleared) return;
        const s = r.def.r * (1 + 0.02 * Math.sin(time * 3 + r.index));
        r.torus.scale.setScalar(s);
        r.disc.scale.setScalar(s);
      });
    },
    dispose() {
      scene.remove(group);
    },
  };
}

export function buildWorld(scene) {
  buildSky(scene);
  const clouds = buildClouds(scene);
  return {
    clouds,
    updateClouds(dt) {
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.drift * dt;
        if (cloud.position.x > 2200) cloud.position.x = -2200;
      }
    },
  };
}
