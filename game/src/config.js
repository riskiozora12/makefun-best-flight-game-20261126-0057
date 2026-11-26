// config.js — every tunable number and every mission of Ridgeline Run.
// One place for balance: physics, world size, scoring, missions, colours.

export const WORLD = {
  size: 4200, // metres, square terrain centred on (0, 0)
  valleyHalfWidth: 1050, // valley floor stays low inside |x| < this
  mountainHeight: 620, // peak height at the world edges
  riverX: -140, // river meanders around this x
  waterLevel: 3.2,
  treeline: 260, // no pines above this height
  treeCount: 650,
  cloudCount: 22,
  fogNear: 500,
  fogFar: 3400,
};

export const PLANE = {
  maxSpeed: 82, // m/s, level flight at full throttle
  cruiseSpeed: 55,
  stallClean: 30, // m/s, wings stop flying below this
  stallFlaps: 23, // m/s with flaps down
  thrustAccel: 26, // m/s^2 at full throttle
  dragK: 0.0038, // quadratic drag, tuned so top speed is maxSpeed
  flapDrag: 0.002, // extra drag with flaps (about +50% at approach speed)
  pitchRate: 0.85, // rad/s at full elevator
  rollRate: 1.9, // rad/s at full aileron
  maxBank: 1.05, // rad, about 60 degrees
  gravity: 9.81,
  fuelCapacity: 100,
  fuelBurnIdle: 0.10, // units per second
  fuelBurnFull: 0.42, // units per second at full throttle
  gearDamageOnBelly: 40,
};

export const CAMERA = {
  chaseDistance: 15,
  chaseHeight: 4.6,
  lookAhead: 26,
  fovBase: 62,
  fovSpeed: 0.14, // extra degrees per m/s
  smooth: 5.2, // lerp rate for the chase camera
};

// Missions: rings are (x, y, z, radius). Ring heights are clamped at runtime
// to at least 28 m above the terrain, so a misjudged number never buries one.
export const MISSIONS = [
  {
    id: "dawn-patrol",
    name: "Dawn Patrol",
    briefing:
      "Six rings over the valley, then bring her home on runway 36. Gentle morning air — learn the plane.",
    parSeconds: 150,
    wind: 0,
    rings: [
      { x: 0, y: 110, z: 700, r: 24 },
      { x: -260, y: 120, z: 250, r: 24 },
      { x: 240, y: 130, z: -200, r: 24 },
      { x: -320, y: 120, z: -650, r: 24 },
      { x: 180, y: 140, z: -1050, r: 24 },
      { x: 0, y: 120, z: -1450, r: 24 },
    ],
  },
  {
    id: "river-run",
    name: "River Run",
    briefing:
      "Ten rings low along the river. Stay under 60 metres, mind the pines, and keep your speed up.",
    parSeconds: 210,
    wind: 1.5,
    rings: [
      { x: -120, y: 55, z: 900, r: 19 },
      { x: -260, y: 50, z: 450, r: 19 },
      { x: -60, y: 55, z: 50, r: 19 },
      { x: -300, y: 48, z: -350, r: 19 },
      { x: -140, y: 52, z: -750, r: 19 },
      { x: -320, y: 50, z: -1100, r: 19 },
      { x: -100, y: 55, z: -1400, r: 19 },
      { x: -280, y: 48, z: -1650, r: 19 },
      { x: -80, y: 55, z: -1850, r: 19 },
      { x: 0, y: 90, z: -1500, r: 19 },
    ],
  },
  {
    id: "storm-ridge",
    name: "Storm Ridge",
    briefing:
      "Twelve rings through the mountain pass in gusty wind. Tight turns, thin air, no room for error.",
    parSeconds: 280,
    wind: 5.0,
    rings: [
      { x: 420, y: 240, z: 600, r: 16 },
      { x: 780, y: 300, z: 100, r: 16 },
      { x: 950, y: 340, z: -450, r: 16 },
      { x: 700, y: 330, z: -900, r: 16 },
      { x: 900, y: 360, z: -1300, r: 16 },
      { x: 620, y: 320, z: -1600, r: 16 },
      { x: 350, y: 260, z: -1750, r: 16 },
      { x: -420, y: 250, z: -1600, r: 16 },
      { x: -760, y: 310, z: -1250, r: 16 },
      { x: -950, y: 350, z: -850, r: 16 },
      { x: -700, y: 320, z: -450, r: 16 },
      { x: -350, y: 220, z: -100, r: 16 },
    ],
  },
];

export const SCORING = {
  ringPoints: 1000,
  timeBonusPerSecond: 10, // per second under par
  landingBase: 1000,
  landingSoftMax: 500, // gentle touchdown
  landingCentreMax: 500, // on the centreline
  fuelBonusPerUnit: 5,
  hardLandingVs: 3.0, // m/s vertical speed: hard above this
  crashVs: 4.6, // m/s vertical speed: crash above this
};

export const RUNWAY = {
  x: 0,
  z: 1250,
  heading: 0, // runway points north (towards -z)
  length: 620,
  width: 30,
  thresholdZ: 1250 - 310, // north end where you touch down
};

export const COLOURS = {
  skyTop: 0x2f6fb2,
  skyHorizon: 0xf6c98a, // dawn gold on the horizon
  fog: 0xd8c9ae,
  sun: 0xffe6b0,
  grass: 0x5d8a3c,
  meadow: 0x7fae4e,
  rock: 0x8a8178,
  snow: 0xf2f5f7,
  sand: 0xcbb98a,
  water: 0x3f7fb5,
  pine: 0x2e5d33,
  trunk: 0x5d4630,
  runway: 0x3a3d42,
  ring: 0xff8c1a,
  ringNext: 0x2eff8a,
  planeCream: 0xf3ead2,
  planeRed: 0xc23b2e,
  planeDark: 0x2c2f33,
};
