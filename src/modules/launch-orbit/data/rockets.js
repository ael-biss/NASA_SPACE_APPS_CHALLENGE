/**
 * @file src/modules/launch-orbit/data/rockets.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Database of available launch vehicles (SmallSat, Medium, Heavy) with
 *       max payload mass to LEO, delta-v boost capability, fairing constraints, and cost.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * NOTES
 * ═══════════════════════════════════════════════════════════════════════
 * These are STYLIZED vehicles inspired by real launcher classes
 * (Electron, Falcon 9, Falcon Heavy, Saturn V / SLS). Masses, Isp and
 * thrust are rounded approximations of public figures, not exact specs.
 *
 * payloadCapacityKg is the published-style limit per orbit. Each limit was
 * set ~10-15% BELOW the payload at which the Tsiolkovsky Δv budget
 * (orbits.js requiredDeltaVMs) would run out, so a payload that fits the
 * table also passes the Δv check in OrbitMechanics.simulateLaunch().
 * `{ max: 0 }` means the vehicle cannot reach that orbit.
 * If you edit stage masses, Isp or orbit Δv values, re-run the test
 * (tests/launchMatrix.test.mjs) to keep the two consistent.
 *
 * STAGE FIELDS (read by RocketPhysics.js / OrbitMechanics.js)
 *   dryMassKg, propellantMassKg,
 *   ispSeaLevelS, ispVacuumS,
 *   thrustSeaLevelN (first stage), thrustVacuumN (upper stages)
 * Strap-on boosters are lumped into stage 1 (Falcon Heavy-class).
 * ═══════════════════════════════════════════════════════════════════════
 */

export const ROCKETS = [
  {
    id: 'SMALLSAT',
    name: 'Electron-class SmallSat Launcher',
    category: 'SmallSat',
    description: 'Cheap dedicated launch for cubesats and microsatellites. LEO only.',
    costMillionUsd: 7,
    fairing: { diameterM: 1.2, heightM: 2.5 },
    stages: [
      {
        name: 'Stage 1',
        dryMassKg: 950,
        propellantMassKg: 9250,
        ispSeaLevelS: 303,
        ispVacuumS: 311,
        thrustSeaLevelN: 190000
      },
      {
        name: 'Stage 2',
        dryMassKg: 250,
        propellantMassKg: 2050,
        ispVacuumS: 343,
        thrustVacuumN: 25800
      }
    ],
    payloadCapacityKg: {
      LEO: { max: 200 },
      MEO: { max: 0 },
      GEO: { max: 0 },
      LUNAR: { max: 0 }
    }
  },
  {
    id: 'MEDIUM',
    name: 'Falcon-class Medium Launcher',
    category: 'Medium',
    description: 'Workhorse two-stage vehicle for most commercial satellites.',
    costMillionUsd: 70,
    fairing: { diameterM: 5.2, heightM: 13.1 },
    stages: [
      {
        name: 'Stage 1',
        dryMassKg: 25600,
        propellantMassKg: 395700,
        ispSeaLevelS: 282,
        ispVacuumS: 311,
        thrustSeaLevelN: 7607000
      },
      {
        name: 'Stage 2',
        dryMassKg: 4000,
        propellantMassKg: 107500,
        ispVacuumS: 348,
        thrustVacuumN: 934000
      }
    ],
    payloadCapacityKg: {
      LEO: { max: 18000 },
      MEO: { max: 3500 },
      GEO: { max: 2800 },
      LUNAR: { max: 4500 }
    }
  },
  {
    id: 'HEAVY',
    name: 'Falcon Heavy-class Heavy Launcher',
    category: 'Heavy',
    description: 'Three-core heavy lifter (modelled as a strapped-on stage 1) for big GEO and lunar payloads.',
    costMillionUsd: 150,
    fairing: { diameterM: 5.2, heightM: 13.1 },
    stages: [
      {
        name: 'Core + boosters',
        dryMassKg: 92000,
        propellantMassKg: 1230000,
        ispSeaLevelS: 282,
        ispVacuumS: 311,
        thrustSeaLevelN: 22800000
      },
      {
        name: 'Stage 2',
        dryMassKg: 4000,
        propellantMassKg: 107500,
        ispVacuumS: 348,
        thrustVacuumN: 934000
      }
    ],
    payloadCapacityKg: {
      LEO: { max: 35000 },
      MEO: { max: 8500 },
      GEO: { max: 7000 },
      LUNAR: { max: 10000 }
    }
  },
  {
    id: 'SUPERHEAVY',
    name: 'Saturn-class Super-Heavy Launcher',
    category: 'Super-Heavy',
    description: 'Three-stage moon rocket for the largest payloads and crewed lunar missions.',
    costMillionUsd: 800,
    fairing: { diameterM: 8.4, heightM: 20 },
    stages: [
      {
        name: 'Stage 1',
        dryMassKg: 140000,
        propellantMassKg: 2100000,
        ispSeaLevelS: 263,
        ispVacuumS: 304,
        thrustSeaLevelN: 34000000
      },
      {
        name: 'Stage 2',
        dryMassKg: 36000,
        propellantMassKg: 440000,
        ispVacuumS: 421,
        thrustVacuumN: 1100000
      },
      {
        name: 'Stage 3',
        dryMassKg: 12000,
        propellantMassKg: 105000,
        ispVacuumS: 450,
        thrustVacuumN: 110000
      }
    ],
    payloadCapacityKg: {
      LEO: { max: 125000 },
      MEO: { max: 40000 },
      GEO: { max: 35000 },
      LUNAR: { max: 45000 }
    }
  }
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
