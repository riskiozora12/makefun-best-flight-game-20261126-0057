// render.js — the renderer and the two cameras: a chase camera that trails
// the plane and never fights the pilot, and a cockpit camera at the pilot's
// eyes. The plane model points down -z, so yaw is negated to match the
// flight model's heading.

import * as THREE from "three";
import { CAMERA } from "./config.js";

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(CAMERA.fovBase, window.innerWidth / window.innerHeight, 0.5, 9000);
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  return { renderer, camera };
}

function forwardOf(flight) {
  const cp = Math.cos(flight.pitch);
  return {
    x: Math.sin(flight.heading) * cp,
    y: Math.sin(flight.pitch),
    z: -Math.cos(flight.heading) * cp,
  };
}

// Keep the three.js model in sync with the flight state.
export function posePlane(group, flight) {
  group.position.set(flight.x, flight.y, flight.z);
  group.rotation.order = "YXZ";
  group.rotation.y = -flight.heading;
  group.rotation.x = flight.pitch;
  group.rotation.z = -flight.roll;
}

export function createCameraRig(camera) {
  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  let fov = CAMERA.fovBase;
  let initialised = false;

  return {
    updateChase(flight, dt) {
      const f = forwardOf(flight);
      fwd.set(f.x, f.y, f.z);
      desired.set(
        flight.x - f.x * CAMERA.chaseDistance,
        flight.y - f.y * CAMERA.chaseDistance + CAMERA.chaseHeight,
        flight.z - f.z * CAMERA.chaseDistance
      );
      // Never let the camera sink under the terrain.
      if (desired.y < 4) desired.y = 4;
      if (!initialised) {
        camera.position.copy(desired);
        initialised = true;
      } else {
        camera.position.lerp(desired, Math.min(1, CAMERA.smooth * dt));
      }
      look.set(flight.x + f.x * CAMERA.lookAhead, flight.y + f.y * CAMERA.lookAhead + 1, flight.z + f.z * CAMERA.lookAhead);
      camera.lookAt(look);
      const targetFov = CAMERA.fovBase + flight.speed * CAMERA.fovSpeed;
      if (Math.abs(targetFov - fov) > 0.1) {
        fov += (targetFov - fov) * Math.min(1, dt * 2);
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
    updateCockpit(flight) {
      // Pilot's eyes: just above the nose cowling, so the cowling frames
      // the bottom of the view and the sky ahead stays clear.
      const f = forwardOf(flight);
      camera.position.set(flight.x + f.x * 1.3, flight.y + 1.45, flight.z + f.z * 1.3);
      look.set(flight.x + f.x * 120, flight.y + f.y * 120 - 4, flight.z + f.z * 120);
      camera.lookAt(look);
      if (Math.abs(camera.fov - 68) > 0.1) {
        camera.fov = 68;
        camera.updateProjectionMatrix();
      }
    },
  };
}
