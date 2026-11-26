// terrain.js — the valley itself: heightfield, river, pines, airfield, village.
// terrainHeight(x, z) is the one source of truth for ground level: the mesh,
// the trees, the rings and the flight model all read it.

import * as THREE from "three";
import { WORLD, COLOURS, RUNWAY } from "./config.js";
import { makeNoise, makeRng } from "./random.js";

const noise = makeNoise(1337);
const rng = makeRng(20261126);

export const RUNWAY_ELEV = 14;

function smoothstep(a, b, t) {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

function riverCentreX(z) {
  return WORLD.riverX + 90 * Math.sin(z * 0.0011) + 40 * Math.sin(z * 0.0037);
}

// Pure height function: valley floor low, mountains rising to both sides,
// a carved riverbed, and the airfield flattened to the runway elevation.
export function terrainHeight(x, z) {
  const half = WORLD.size / 2;
  const edge = Math.abs(x) / half;
  const mountain = Math.pow(smoothstep(0.32, 0.92, edge), 1.6);
  const endRise = smoothstep(0.75, 1.0, Math.abs(z) / half) * 0.5;
  let h =
    mountain * WORLD.mountainHeight * (0.55 + 0.45 * noise.fbm(x * 0.0016, z * 0.0016)) +
    endRise * 260 +
    noise.fbm(x * 0.004, z * 0.004) * 16 +
    noise.fbm(x * 0.02, z * 0.02) * 2.5 +
    4; // valley floor sits a little above the riverbed

  // River carve: a smooth trench along the meandering river, deep enough
  // that the water plane (at waterLevel) shows as a blue ribbon, not dirt.
  const dRiver = Math.abs(x - riverCentreX(z));
  const carve = 1 - smoothstep(18, 110, dRiver);
  h = h * (1 - carve * 0.95) + 0.2 * carve;

  // Airfield flatten: blend to runway elevation near the strip.
  const dx = Math.abs(x - RUNWAY.x);
  const dz = Math.abs(z - RUNWAY.z);
  const flat = (1 - smoothstep(45, 150, dx)) * (1 - smoothstep(330, 480, dz));
  h = h * (1 - flat) + RUNWAY_ELEV * flat;
  return h;
}

function colourForHeight(h, x, z) {
  const c = new THREE.Color();
  const jitter = (noise.noise2(x * 0.05, z * 0.05) - 0.5) * 0.12;
  if (h < 3.5) c.setHex(COLOURS.sand);
  else if (h < 150) c.setHex(COLOURS.grass).lerp(new THREE.Color(COLOURS.meadow), smoothstep(20, 120, h));
  else if (h < 330) c.setHex(COLOURS.rock);
  else c.setHex(COLOURS.rock).lerp(new THREE.Color(COLOURS.snow), smoothstep(330, 430, h));
  c.offsetHSL(0, 0, jitter);
  return c;
}

function buildGroundMesh() {
  const seg = 150;
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const c = colourForHeight(h, x, z);
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  return new THREE.Mesh(geo, mat);
}

function buildRiver() {
  const steps = 100;
  const width = 36;
  const positions = new Float32Array((steps + 1) * 2 * 3);
  const indices = [];
  for (let i = 0; i <= steps; i++) {
    const z = -WORLD.size / 2 + (i / steps) * WORLD.size;
    const cx = riverCentreX(z);
    positions.set([cx - width, WORLD.waterLevel, z], i * 6);
    positions.set([cx + width, WORLD.waterLevel, z], i * 6 + 3);
    if (i < steps) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: COLOURS.water,
    roughness: 0.15,
    metalness: 0.35,
    transparent: true,
    opacity: 0.88,
  });
  return new THREE.Mesh(geo, mat);
}

function buildTrees(scene) {
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 5, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: COLOURS.trunk, roughness: 1 });
  const coneGeo = new THREE.ConeGeometry(4.2, 16, 7);
  const coneMat = new THREE.MeshStandardMaterial({ color: COLOURS.pine, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, WORLD.treeCount);
  const cones = new THREE.InstancedMesh(coneGeo, coneMat, WORLD.treeCount);
  const dummy = new THREE.Object3D();
  let placed = 0;
  let tries = 0;
  while (placed < WORLD.treeCount && tries < WORLD.treeCount * 30) {
    tries++;
    const x = (rng() - 0.5) * (WORLD.size - 200);
    const z = (rng() - 0.5) * (WORLD.size - 200);
    const h = terrainHeight(x, z);
    if (h < 7 || h > WORLD.treeline) continue;
    if (Math.abs(x - riverCentreX(z)) < 46) continue;
    if (Math.abs(x - RUNWAY.x) < 120 && Math.abs(z - RUNWAY.z) < 420) continue;
    const s = 0.7 + rng() * 0.9;
    dummy.position.set(x, h + 2.2 * s, z);
    dummy.scale.setScalar(s);
    dummy.rotation.y = rng() * Math.PI * 2;
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);
    dummy.position.y = h + (2.2 + 7.5) * s;
    dummy.updateMatrix();
    cones.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  trunks.count = placed;
  cones.count = placed;
  trunks.castShadow = false;
  cones.castShadow = false;
  scene.add(trunks);
  scene.add(cones);
}

function runwayTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 1024;
  const g = c.getContext("2d");
  g.fillStyle = "#3a3d42";
  g.fillRect(0, 0, 128, 1024);
  g.fillStyle = "#2f3236";
  g.fillRect(0, 0, 128, 1024);
  // Edge lines.
  g.fillStyle = "#e8e8e8";
  g.fillRect(6, 0, 4, 1024);
  g.fillRect(118, 0, 4, 1024);
  // Centreline dashes.
  for (let y = 40; y < 1024; y += 80) g.fillRect(61, y, 6, 44);
  // Threshold bars at both ends.
  for (const y0 of [24, 968]) {
    for (let x = 16; x < 112; x += 16) g.fillRect(x, y0, 9, 30);
  }
  // Runway numbers "36" (south end, read by a pilot landing north) and
  // "18" (north end, read by a pilot landing south). Canvas top is the
  // north end of the strip, so "36" sits upright at the bottom.
  g.fillStyle = "#ffffff";
  g.font = "bold 44px sans-serif";
  g.textAlign = "center";
  g.save();
  g.translate(64, 130);
  g.rotate(Math.PI);
  g.fillText("18", 0, 0);
  g.restore();
  g.fillText("36", 64, 940);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function buildAirfield(scene) {
  const group = new THREE.Group();
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY.width, RUNWAY.length),
    new THREE.MeshStandardMaterial({ map: runwayTexture(), roughness: 0.9 })
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(RUNWAY.x, RUNWAY_ELEV + 0.15, RUNWAY.z);
  group.add(strip);

  // Hangar: box + curved roof, east of the strip.
  const hangar = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(36, 12, 26),
    new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.8 })
  );
  body.position.y = 6;
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(13, 13, 36, 12, 1, false, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.7 })
  );
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 12;
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 9),
    new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.6, metalness: 0.4 })
  );
  door.position.set(0, 4.5, 13.05);
  hangar.add(body, roof, door);
  hangar.position.set(70, RUNWAY_ELEV, RUNWAY.z + 120);
  group.add(hangar);

  // Windsock on a pole west of the strip.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.35, 11, 6),
    new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.5, metalness: 0.6 })
  );
  pole.position.set(-52, RUNWAY_ELEV + 5.5, RUNWAY.z - 60);
  group.add(pole);
  const sockMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.8, side: THREE.DoubleSide });
  const sock = new THREE.Mesh(new THREE.ConeGeometry(1.5, 6, 8, 1, true), sockMat);
  sock.rotation.z = Math.PI / 2;
  sock.position.set(-49, RUNWAY_ELEV + 10.6, RUNWAY.z - 60);
  group.add(sock);

  // A few village houses north-east of the airfield.
  const roofColours = [0xa34a3a, 0x4a6a8a, 0x7a6a3a, 0x5a7a4a];
  for (let i = 0; i < 9; i++) {
    const hx = 260 + rng() * 260;
    const hz = RUNWAY.z + 120 + rng() * 260;
    const hy = terrainHeight(hx, hz);
    const house = new THREE.Group();
    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(10, 6, 8),
      new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 })
    );
    walls.position.y = 3;
    const roofMesh = new THREE.Mesh(
      new THREE.ConeGeometry(7.5, 4, 4),
      new THREE.MeshStandardMaterial({ color: roofColours[i % roofColours.length], roughness: 0.85 })
    );
    roofMesh.position.y = 8;
    roofMesh.rotation.y = Math.PI / 4;
    house.add(walls, roofMesh);
    house.position.set(hx, hy, hz);
    house.rotation.y = rng() * Math.PI;
    group.add(house);
  }

  scene.add(group);
  return {
    windsock: sock,
    updateWindsock(windSpeed, windDir, time) {
      // Points downwind, droops when the air is calm, flutters a little.
      sock.rotation.y = windDir + Math.PI / 2;
      const droop = Math.max(0.12, Math.min(1, windSpeed / 6));
      sock.rotation.z = Math.PI / 2 - 0.5 + droop * 0.5 + Math.sin(time * 7) * 0.03 * droop;
    },
  };
}

export function buildTerrain(scene) {
  const ground = buildGroundMesh();
  scene.add(ground);
  scene.add(buildRiver());
  buildTrees(scene);
  const airfield = buildAirfield(scene);
  return { ground, windsock: airfield.windsock, updateWindsock: airfield.updateWindsock };
}
