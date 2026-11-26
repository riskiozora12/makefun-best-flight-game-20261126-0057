// audio.js — every sound is synthesised with WebAudio, no audio files.
// A twin-oscillator engine hum follows the throttle, filtered noise is the
// wind, and short tones mark rings, warnings and touchdowns.

export function createAudio() {
  let ctx = null;
  let engineOsc1 = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    started = true;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Engine: a sawtooth plus a detuned twin, through a low-pass filter.
    engineOsc1 = ctx.createOscillator();
    engineOsc1.type = "sawtooth";
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = "square";
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc1.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc1.start();
    engineOsc2.start();
    // Wind: looped white noise through a band-pass filter.
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    windSource = ctx.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 700;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    windSource.start();
  }

  function tone(freq, dur, type = "sine", gain = 0.16, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    // Call from any user gesture; browsers block audio before one.
    unlock() {
      ensure();
      if (ctx && ctx.state === "suspended") ctx.resume();
    },
    toggleMute() {
      muted = !muted;
      if (ctx) ctx.destination.gain = muted ? 0 : 1;
      return muted;
    },
    get muted() {
      return muted;
    },
    // Continuous engine + wind, driven every frame from the flight state.
    update({ throttle, speed, onGround, running }) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const rpm = 42 + throttle * 58 + speed * 0.25;
      engineOsc1.frequency.setTargetAtTime(rpm, t, 0.08);
      engineOsc2.frequency.setTargetAtTime(rpm * 1.5 + 3, t, 0.08);
      engineGain.gain.setTargetAtTime(running ? 0.045 + throttle * 0.05 : 0, t, 0.1);
      const windLevel = onGround ? 0 : Math.min(0.16, speed * 0.0016);
      windGain.gain.setTargetAtTime(windLevel, t, 0.15);
      windFilter.frequency.setTargetAtTime(400 + speed * 9, t, 0.15);
    },
    ring() {
      tone(880, 0.22, "sine", 0.2);
      tone(1318, 0.3, "sine", 0.16, 0.09);
    },
    warning() {
      tone(620, 0.12, "square", 0.07);
      tone(620, 0.12, "square", 0.07, 0.16);
    },
    click() {
      tone(1200, 0.05, "square", 0.06);
    },
    touchdown() {
      tone(90, 0.25, "sine", 0.3);
      if (!ctx || muted) return;
      const t0 = ctx.currentTime;
      const len = ctx.sampleRate * 0.18;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      src.connect(g);
      g.connect(ctx.destination);
      src.start(t0);
    },
    crash() {
      tone(70, 0.6, "sawtooth", 0.25);
      tone(48, 0.8, "sine", 0.3, 0.05);
    },
    fanfare() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, "triangle", 0.16, i * 0.12));
    },
  };
}
