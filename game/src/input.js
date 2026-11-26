// input.js — keyboard and mouse, one object the flight model reads.
// Arrow keys / WASD fly the plane, Shift/Ctrl work the throttle, Space is
// flaps, G is the gear, C swaps the camera, P pauses, M mutes. The mouse
// steers while held: push it where you want the nose to go.

export function createInput() {
  const keys = new Set();
  const state = {
    mouseSteer: false,
    mouseX: 0, // -1..1 from screen centre
    mouseY: 0,
    wheelDelta: 0,
    // Edge-triggered actions, consumed by the game loop once.
    pressed: new Set(),
  };

  const KEYMAP = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    KeyW: "up",
    KeyS: "down",
    KeyA: "left",
    KeyD: "right",
    ShiftLeft: "throttleUp",
    ShiftRight: "throttleUp",
    ControlLeft: "throttleDown",
    ControlRight: "throttleDown",
    Space: "flaps",
    KeyG: "gear",
    KeyC: "camera",
    KeyP: "pause",
    Escape: "pause",
    KeyM: "mute",
    Enter: "confirm",
  };

  function onKeyDown(e) {
    const name = KEYMAP[e.code];
    if (!name) return;
    if (["up", "down", "left", "right", "Space"].includes(name) || e.code.startsWith("Arrow")) {
      e.preventDefault();
    }
    if (!keys.has(name)) state.pressed.add(name);
    keys.add(name);
  }
  function onKeyUp(e) {
    const name = KEYMAP[e.code];
    if (name) keys.delete(name);
  }
  function onMouseMove(e) {
    state.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    state.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
  }
  function onMouseDown(e) {
    if (e.button === 0) state.mouseSteer = true;
  }
  function onMouseUp() {
    state.mouseSteer = false;
  }
  function onWheel(e) {
    state.wheelDelta += e.deltaY < 0 ? 1 : -1;
    e.preventDefault();
  }
  function onBlur() {
    keys.clear();
    state.mouseSteer = false;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("blur", onBlur);

  return {
    state,
    // Read this frame's flight controls: -1..1 pitch and roll, plus the
    // throttle keys held down. Mouse steering overrides the keys while held.
    readFlight() {
      let pitch = 0;
      let roll = 0;
      if (keys.has("up")) pitch += 1;
      if (keys.has("down")) pitch -= 1;
      if (keys.has("left")) roll -= 1;
      if (keys.has("right")) roll += 1;
      if (state.mouseSteer) {
        roll = Math.max(-1, Math.min(1, state.mouseX * 1.4));
        pitch = Math.max(-1, Math.min(1, -state.mouseY * 1.2));
      }
      let throttleKey = 0;
      if (keys.has("throttleUp")) throttleKey += 1;
      if (keys.has("throttleDown")) throttleKey -= 1;
      return { pitch, roll, throttleKey };
    },
    // True once for the frame the key went down; the loop clears it.
    consume(action) {
      if (state.pressed.has(action)) {
        state.pressed.delete(action);
        return true;
      }
      return false;
    },
    endFrame() {
      state.pressed.clear();
    },
    consumeWheel() {
      const d = state.wheelDelta;
      state.wheelDelta = 0;
      return d;
    },
  };
}
