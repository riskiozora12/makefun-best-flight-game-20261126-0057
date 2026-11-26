// random.js — a seeded random generator and smooth value noise.
// The whole valley is built from this one seed, so the world is identical
// on every load and every screenshot is reproducible.

export function makeRng(seed) {
  let s = seed >>> 0;
  return function next() {
    // mulberry32: small, fast, deterministic.
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2D value noise: a grid of random heights, bilinearly interpolated
// with a smoothstep curve, layered into octaves by the caller.
export function makeNoise(seed) {
  const rand = makeRng(seed);
  const grid = 256;
  const values = new Float32Array(grid * grid);
  for (let i = 0; i < values.length; i++) values[i] = rand();
  const wrap = (v) => ((v % grid) + grid) % grid;
  const at = (ix, iz) => values[wrap(iz) * grid + wrap(ix)];
  const smooth = (t) => t * t * (3 - 2 * t);

  function noise2(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = smooth(x - ix);
    const fz = smooth(z - iz);
    const a = at(ix, iz);
    const b = at(ix + 1, iz);
    const c = at(ix, iz + 1);
    const d = at(ix + 1, iz + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }

  // Fractal Brownian motion: 4 octaves, returns roughly 0..1.
  function fbm(x, z, octaves = 4) {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise2(x * freq, z * freq);
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum;
  }

  return { noise2, fbm };
}
