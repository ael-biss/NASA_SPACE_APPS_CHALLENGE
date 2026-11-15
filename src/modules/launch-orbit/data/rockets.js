/**
 * @file src/modules/launch-orbit/data/rockets.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Database of available launch vehicles and payload fairings with real physics specs:
 *       liftoff thrust, vehicle mass, max payload to LEO, delta-v boost, fairing diameter,
 *       peak Max-Q pressure, launch g-load, vibration RMS, and cost.
 */

export const ROCKETS = [
  {
    id: "microlaunch",
    name: "MicroLaunch SmallSat",
    class: "Small-Lift",
    maxPayloadLeoKg: 320,
    launcherDeltaVMs: 9500,
    fairingDiameterM: 1.2,
    costMillions: 8.5,
    liftoffThrustKN: 340,
    liftoffMassKg: 24500,
    maxQPa: 32000,
    peakLaunchG: 7.8,
    vibrationGrms: 7.3,
    description:
      "Dedicated small-satellite launcher optimized for CubeSats and lightweight LEO payloads.",
  },
  {
    id: "solid-sprint",
    name: "Solid-Stage Express",
    class: "Medium-Solid",
    maxPayloadLeoKg: 850,
    launcherDeltaVMs: 11200,
    fairingDiameterM: 2.2,
    costMillions: 16.0,
    liftoffThrustKN: 1450,
    liftoffMassKg: 82000,
    maxQPa: 39000,
    peakLaunchG: 9.0,
    vibrationGrms: 8.5,
    description:
      "Budget solid-motor rocket with high thrust and lower cost, but severe launch g-loads and acoustic vibration.",
  },
  {
    id: "medium-orbital",
    name: "Medium Orbital LV",
    class: "Medium-Lift",
    maxPayloadLeoKg: 1200,
    launcherDeltaVMs: 11800,
    fairingDiameterM: 3.2,
    costMillions: 28.0,
    liftoffThrustKN: 1850,
    liftoffMassKg: 138000,
    maxQPa: 31000,
    peakLaunchG: 5.2,
    vibrationGrms: 5.4,
    description:
      "Reusable two-stage liquid workhorse capable of delivering medium buses to LEO, MEO, and GEO.",
  },
  {
    id: "heavy-lift",
    name: "Heavy Lift LV",
    class: "Heavy-Lift",
    maxPayloadLeoKg: 2500,
    launcherDeltaVMs: 12800,
    fairingDiameterM: 4.6,
    costMillions: 52.0,
    liftoffThrustKN: 4400,
    liftoffMassKg: 315000,
    maxQPa: 29500,
    peakLaunchG: 4.6,
    vibrationGrms: 4.7,
    description:
      "High-energy multi-core launch vehicle built for GEO telecom satellites and LRO-class Lunar orbiters.",
  },
  {
    id: "super-heavy",
    name: "Super-Heavy Deep Space",
    class: "Super-Heavy",
    maxPayloadLeoKg: 5000,
    launcherDeltaVMs: 13800,
    fairingDiameterM: 5.4,
    costMillions: 85.0,
    liftoffThrustKN: 9200,
    liftoffMassKg: 640000,
    maxQPa: 28000,
    peakLaunchG: 4.2,
    vibrationGrms: 4.1,
    description:
      "Flagship deep-space launch system providing massive payload capacity, gentle ride, and Mars injection energy.",
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
