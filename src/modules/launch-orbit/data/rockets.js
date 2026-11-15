/**
 * @file src/modules/launch-orbit/data/rockets.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Database of available launch vehicles and payload fairings with real physics specs:
 *       liftoff thrust, vehicle mass, max payload to LEO, delta-v boost, fairing diameter,
 *       peak Max-Q pressure, launch g-load, vibration RMS, cost, multi-stage architecture,
 *       and high-fidelity 3D visual specifications.
 */

export const ROCKETS = [
  {
    id: "microlaunch",
    name: "MicroLaunch SmallSat",
    class: "Small-Lift",
    maxPayloadLeoKg: 320,
    launcherDeltaVMs: 9500,
    fairingDiameterM: 1.2,
    fairingHeightM: 2.5,
    costMillions: 8.5,
    liftoffThrustKN: 340,
    liftoffMassKg: 24500,
    maxQPa: 32000,
    peakLaunchG: 7.8,
    vibrationGrms: 7.3,
    description:
      "Dedicated small-satellite launcher optimized for CubeSats and lightweight LEO payloads.",
    stages: [
      {
        name: "Stage 1 (Booster)",
        type: "booster",
        dryMassKg: 1850,
        propellantMassKg: 18200,
        propellantType: "LOX / RP-1 (Electric Pump)",
        engineName: "9x Electric Turbopump Engines",
        engineCount: 9,
        thrustSeaLevelN: 340000,
        thrustVacuumN: 380000,
        ispSeaLevelS: 303,
        ispVacuumS: 311,
        diameterM: 1.2,
        heightM: 12.0,
        burnDurationSec: 155,
      },
      {
        name: "Stage 2 (Upper Stage)",
        type: "upper",
        dryMassKg: 450,
        propellantMassKg: 3680,
        propellantType: "LOX / RP-1",
        engineName: "1x Vacuum Engine",
        engineCount: 1,
        thrustSeaLevelN: 0,
        thrustVacuumN: 58000,
        ispSeaLevelS: 280,
        ispVacuumS: 343,
        diameterM: 1.2,
        heightM: 2.8,
        burnDurationSec: 215,
      },
    ],
    payloadCapacityKg: {
      LEO: { min: 1000, max: 5000 },
      MEO: { min: 600, max: 3200 },
      GEO: { min: 400, max: 2400 },
      LUNAR: { min: 250, max: 2500 },
      MARS: { min: 100, max: 3000 },
    },
    visuals: {
      coreDiameter: 0.12,
      coreHeight: 1.5,
      stage1Ratio: 0.73,
      stage2Ratio: 0.27,
      primaryColor: 0x1e293b, // Dark carbon-composite black
      accentColor: 0x0284c7, // Electric cyan telemetry stripe
      interstageColor: 0x0f172a, // Matte black interstage
      engineCluster: { count: 9, pattern: "circle", nozzleRadius: 0.016, throatColor: 0xffedd5 },
      upperEngine: { count: 1, nozzleRadius: 0.038, expansionLength: 0.08 },
      fins: false,
      gridFins: false,
      sideBoosters: 0,
      plumeStyle: "hydrocarbon-clean",
    },
  },
  {
    id: "solid-sprint",
    name: "Solid-Stage Express",
    class: "Medium-Solid",
    maxPayloadLeoKg: 850,
    launcherDeltaVMs: 11200,
    fairingDiameterM: 2.2,
    fairingHeightM: 4.2,
    costMillions: 16.0,
    liftoffThrustKN: 1450,
    liftoffMassKg: 82000,
    maxQPa: 39000,
    peakLaunchG: 9.0,
    vibrationGrms: 8.5,
    description:
      "Budget solid-motor rocket with high thrust and lower cost, but severe launch g-loads and acoustic vibration.",
    stages: [
      {
        name: "Stage 1 (Solid First Stage)",
        type: "booster",
        dryMassKg: 6200,
        propellantMassKg: 54000,
        propellantType: "HTPB Solid Propellant",
        engineName: "Monolithic Cast Solid Rocket Motor",
        engineCount: 1,
        thrustSeaLevelN: 1450000,
        thrustVacuumN: 1600000,
        ispSeaLevelS: 255,
        ispVacuumS: 280,
        diameterM: 2.2,
        heightM: 10.5,
        burnDurationSec: 92,
      },
      {
        name: "Stage 2 (Solid Second Stage)",
        type: "mid",
        dryMassKg: 2400,
        propellantMassKg: 16000,
        propellantType: "HTPB Solid Propellant",
        engineName: "Vacuum Optimized Solid Motor",
        engineCount: 1,
        thrustSeaLevelN: 0,
        thrustVacuumN: 540000,
        ispSeaLevelS: 250,
        ispVacuumS: 292,
        diameterM: 1.9,
        heightM: 5.5,
        burnDurationSec: 86,
      },
      {
        name: "Stage 3 (Upper Insertion Stage)",
        type: "upper",
        dryMassKg: 500,
        propellantMassKg: 2050,
        propellantType: "MMH / NTO Bi-propellant",
        engineName: "Restartable Orbital Insertion Engine",
        engineCount: 1,
        thrustSeaLevelN: 0,
        thrustVacuumN: 32000,
        ispSeaLevelS: 270,
        ispVacuumS: 320,
        diameterM: 1.5,
        heightM: 2.2,
        burnDurationSec: 205,
      },
    ],
    payloadCapacityKg: {
      LEO: { min: 200, max: 850 },
      MEO: { min: 50, max: 200 },
      GEO: { max: 0 },
      LUNAR: { max: 0 },
      MARS: { max: 0 },
    },
    visuals: {
      coreDiameter: 0.18,
      coreHeight: 1.6,
      stage1Ratio: 0.54,
      stage2Ratio: 0.28,
      stage3Ratio: 0.18,
      primaryColor: 0xf8fafc, // Clean industrial off-white
      accentColor: 0x475569, // Carbon segmentation joint rings
      interstageColor: 0x334155,
      engineCluster: { count: 1, pattern: "single", nozzleRadius: 0.052, throatColor: 0xfef08a },
      upperEngine: { count: 1, nozzleRadius: 0.042, expansionLength: 0.07 },
      fins: true, // 4 aerodynamic stabilization base delta fins
      gridFins: false,
      sideBoosters: 0,
      plumeStyle: "solid-smoky",
    },
  },
  {
    id: "medium-orbital",
    name: "Medium Orbital LV",
    class: "Medium-Lift",
    maxPayloadLeoKg: 1200,
    launcherDeltaVMs: 11800,
    fairingDiameterM: 3.2,
    fairingHeightM: 6.8,
    costMillions: 28.0,
    liftoffThrustKN: 1850,
    liftoffMassKg: 138000,
    maxQPa: 31000,
    peakLaunchG: 5.2,
    vibrationGrms: 5.4,
    description:
      "Reusable two-stage liquid workhorse capable of delivering medium buses to LEO, MEO, and GEO.",
    stages: [
      {
        name: "Stage 1 (Booster)",
        type: "booster",
        dryMassKg: 11200,
        propellantMassKg: 104000,
        propellantType: "Densified LOX / RP-1",
        engineName: "9x Gas-Generator Turbopump Engines",
        engineCount: 9,
        thrustSeaLevelN: 1850000,
        thrustVacuumN: 2050000,
        ispSeaLevelS: 310,
        ispVacuumS: 340,
        diameterM: 3.2,
        heightM: 26.0,
        burnDurationSec: 162,
      },
      {
        name: "Stage 2 (Upper Stage)",
        type: "upper",
        dryMassKg: 2800,
        propellantMassKg: 18800,
        propellantType: "Densified LOX / RP-1",
        engineName: "1x High-Expansion Vacuum Engine",
        engineCount: 1,
        thrustSeaLevelN: 0,
        thrustVacuumN: 180000,
        ispSeaLevelS: 280,
        ispVacuumS: 350,
        diameterM: 3.2,
        heightM: 7.2,
        burnDurationSec: 360,
      },
    ],
    payloadCapacityKg: {
      LEO: { min: 300, max: 1200 },
      MEO: { min: 100, max: 600 },
      GEO: { min: 50, max: 400 },
      LUNAR: { max: 0 },
      MARS: { max: 0 },
    },
    visuals: {
      coreDiameter: 0.22,
      coreHeight: 2.15,
      stage1Ratio: 0.72,
      stage2Ratio: 0.28,
      primaryColor: 0xf1f5f9, // Aerospace white enamel
      accentColor: 0x0f172a, // Black interstage ring
      interstageColor: 0x1e293b,
      engineCluster: { count: 9, pattern: "octaweb", nozzleRadius: 0.024, throatColor: 0xf97316 },
      upperEngine: { count: 1, nozzleRadius: 0.058, expansionLength: 0.12 },
      fins: false,
      gridFins: true, // 4 titanium folding hypersonic grid fins
      sideBoosters: 0,
      plumeStyle: "liquid-kerosene",
    },
  },
  {
    id: "heavy-lift",
    name: "Heavy Lift LV",
    class: "Heavy-Lift",
    maxPayloadLeoKg: 2500,
    launcherDeltaVMs: 12800,
    fairingDiameterM: 4.6,
    fairingHeightM: 9.2,
    costMillions: 52.0,
    liftoffThrustKN: 4400,
    liftoffMassKg: 315000,
    maxQPa: 29500,
    peakLaunchG: 4.6,
    vibrationGrms: 4.7,
    description:
      "High-energy multi-core launch vehicle built for GEO telecom satellites and LRO-class Lunar orbiters.",
    stages: [
      {
        name: "Stage 1 (Core + 2x Strap-on Boosters)",
        type: "booster",
        dryMassKg: 31600,
        propellantMassKg: 268000,
        propellantType: "Triple-Core Densified LOX / RP-1",
        engineName: "27x Staged Turbopump Engines (3 cores × 9)",
        engineCount: 27,
        thrustSeaLevelN: 4400000,
        thrustVacuumN: 4850000,
        ispSeaLevelS: 310,
        ispVacuumS: 342,
        diameterM: 3.0,
        heightM: 26.5,
        burnDurationSec: 175,
      },
      {
        name: "Stage 2 (High-Energy Upper Stage)",
        type: "upper",
        dryMassKg: 4200,
        propellantMassKg: 31000,
        propellantType: "Densified LOX / RP-1",
        engineName: "1x High-Expansion Restartable Vacuum Engine",
        engineCount: 1,
        thrustSeaLevelN: 0,
        thrustVacuumN: 260000,
        ispSeaLevelS: 280,
        ispVacuumS: 365,
        diameterM: 3.8,
        heightM: 8.5,
        burnDurationSec: 415,
      },
    ],
    payloadCapacityKg: {
      LEO: { min: 600, max: 2500 },
      MEO: { min: 300, max: 1400 },
      GEO: { min: 200, max: 1000 },
      LUNAR: { min: 100, max: 750 },
      MARS: { max: 0 },
    },
    visuals: {
      coreDiameter: 0.21,
      coreHeight: 2.25,
      stage1Ratio: 0.71,
      stage2Ratio: 0.29,
      primaryColor: 0xffffff,
      accentColor: 0x334155,
      interstageColor: 0x1e293b,
      engineCluster: { count: 9, pattern: "octaweb", nozzleRadius: 0.023, throatColor: 0xf97316 },
      upperEngine: { count: 1, nozzleRadius: 0.062, expansionLength: 0.13 },
      fins: false,
      gridFins: true,
      sideBoosters: 2, // 2 full-sized strap-on liquid booster cores
      boosterOffset: 0.28,
      plumeStyle: "heavy-triple",
    },
  },
  {
    id: "super-heavy",
    name: "Super-Heavy Deep Space",
    class: "Super-Heavy",
    maxPayloadLeoKg: 5000,
    launcherDeltaVMs: 13800,
    fairingDiameterM: 5.4,
    fairingHeightM: 12.0,
    costMillions: 85.0,
    liftoffThrustKN: 9200,
    liftoffMassKg: 640000,
    maxQPa: 28000,
    peakLaunchG: 4.2,
    vibrationGrms: 4.1,
    description:
      "Flagship deep-space launch system providing massive payload capacity, gentle ride, and Mars injection energy.",
    stages: [
      {
        name: "Stage 1 (Super-Heavy Booster Core)",
        type: "booster",
        dryMassKg: 48000,
        propellantMassKg: 470000,
        propellantType: "Sub-cooled LOX / Methane (Full-Flow Staged)",
        engineName: "19x High-Pressure Full-Flow Engines",
        engineCount: 19,
        thrustSeaLevelN: 9200000,
        thrustVacuumN: 10100000,
        ispSeaLevelS: 315,
        ispVacuumS: 345,
        diameterM: 5.4,
        heightM: 42.0,
        burnDurationSec: 158,
      },
      {
        name: "Stage 2 (Cryogenic Deep-Space Stage)",
        type: "upper",
        dryMassKg: 14000,
        propellantMassKg: 103000,
        propellantType: "High-Isp Cryogenic Hydrolox",
        engineName: "2x Expander-Cycle Vacuum Engines",
        engineCount: 2,
        thrustSeaLevelN: 0,
        thrustVacuumN: 980000,
        ispSeaLevelS: 320,
        ispVacuumS: 452,
        diameterM: 5.4,
        heightM: 14.0,
        burnDurationSec: 465,
      },
    ],
    payloadCapacityKg: {
      LEO: { min: 1000, max: 5000 },
      MEO: { min: 600, max: 3200 },
      GEO: { min: 400, max: 2400 },
      LUNAR: { min: 250, max: 1800 },
      MARS: { min: 100, max: 1200 },
    },
    visuals: {
      coreDiameter: 0.31,
      coreHeight: 2.85,
      stage1Ratio: 0.69,
      stage2Ratio: 0.31,
      primaryColor: 0xe2e8f0, // Stainless / roll pattern
      accentColor: 0x0f172a, // Black tile roll stripes
      interstageColor: 0x334155,
      engineCluster: { count: 19, pattern: "concentric", nozzleRadius: 0.022, throatColor: 0x38bdf8 },
      upperEngine: { count: 2, nozzleRadius: 0.065, expansionLength: 0.14 },
      fins: true, // 4 aerodynamic base strakes
      gridFins: false,
      sideBoosters: 0,
      plumeStyle: "super-cryogenic",
    },
  },
];

export const FAIRINGS = [
  {
    id: "standard-fairing",
    name: "Standard Composite Fairing",
    massKg: 0,
    costMillions: 0,
    protectsAero: true,
    vibrationDamping: 1.0,
    description: "Standard aerodynamic nose cone protecting payload through Max-Q.",
  },
  {
    id: "reinforced-fairing",
    name: "Acoustic-Damped Heavy Fairing",
    massKg: 35,
    costMillions: 2.5,
    protectsAero: true,
    vibrationDamping: 0.62,
    description: "Acoustic blanket & isolator ring cutting launch vibration by 38% for fragile optics.",
  },
  {
    id: "no-fairing",
    name: "Unfaired Adapter (Exposed)",
    massKg: 0,
    costMillions: 0,
    protectsAero: false,
    vibrationDamping: 1.15,
    description: "Mass-saving exposed mount; leaves panels and dishes unprotected against Max-Q airflow.",
  },
];

/**
 * Return all available launch vehicles.
 * @returns {Array<Object>}
 */
export function getRockets() {
  return ROCKETS;
}

/**
 * Find a launch vehicle by ID.
 * @param {string} rocketId
 * @returns {Object | undefined}
 */
export function getRocketById(rocketId) {
  return ROCKETS.find((r) => r.id === rocketId);
}

/**
 * Return all fairing configurations.
 * @returns {Array<Object>}
 */
export function getFairings() {
  return FAIRINGS;
}

/**
 * Find a fairing configuration by ID.
 * @param {string} fairingId
 * @returns {Object | undefined}
 */
export function getFairingById(fairingId) {
  return FAIRINGS.find((f) => f.id === fairingId);
}
