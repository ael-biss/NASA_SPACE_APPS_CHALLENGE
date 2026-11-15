/**
 * @file src/modules/launch-orbit/data/orbits.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Catalog of target orbital regimes (LEO, MEO, GEO, LUNAR, MARS) with
 *       altitude/distance, delta-v breakdown (ascent, transfer, capture), environmental
 *       flux/thermal/radiation figures, orbital period, and 3D visualization radius.
 */

import { ORBIT_IDS } from "../../../shared/data/constants.js";

export const ORBITS = [
  {
    id: ORBIT_IDS.LEO,
    name: "Low Earth Orbit (LEO)",
    targetBody: "Earth",
    altitudeKm: 500,
    requiredDeltaVMs: 9400,
    tpiDeltaVMs: 0,
    captureDeltaVMs: 0,
    insertionOverheadMs: 0,
    orbitalPeriodSec: 12,
    orbitRadius3D: 3.0,
    inclinationDeg: 28.6,
    cruiseDays: 1,
    solarDistanceAU: 1.0,
    radiationFluxKradPerDay: 0.08,
    eclipseMinutes: 35,
    ambientSunTempC: 38,
    ambientEclipseTempC: -32,
    description:
      "Close-range orbit (~500 km altitude, ~7.62 km/s orbital speed) ideal for Earth observation and rapid communications.",
  },
  {
    id: ORBIT_IDS.MEO,
    name: "Medium Earth Orbit (MEO)",
    targetBody: "Earth",
    altitudeKm: 20200,
    requiredDeltaVMs: 12800,
    tpiDeltaVMs: 2100,
    captureDeltaVMs: 1300,
    insertionOverheadMs: 26,
    orbitalPeriodSec: 22,
    orbitRadius3D: 5.2,
    inclinationDeg: 55,
    cruiseDays: 3,
    solarDistanceAU: 1.0,
    radiationFluxKradPerDay: 12.0,
    eclipseMinutes: 55,
    ambientSunTempC: 48,
    ambientEclipseTempC: -40,
    description:
      "High-radiation orbital regime (~20,200 km altitude, ~3.87 km/s) crossing Earth's Van Allen belts.",
  },
  {
    id: ORBIT_IDS.GEO,
    name: "Geostationary Orbit (GEO)",
    targetBody: "Earth",
    altitudeKm: 35786,
    requiredDeltaVMs: 13500,
    tpiDeltaVMs: 2450,
    captureDeltaVMs: 1650,
    insertionOverheadMs: 281,
    orbitalPeriodSec: 34,
    orbitRadius3D: 7.4,
    inclinationDeg: 0,
    cruiseDays: 2,
    solarDistanceAU: 1.0,
    radiationFluxKradPerDay: 2.8,
    eclipseMinutes: 72,
    ambientSunTempC: 52,
    ambientEclipseTempC: -55,
    description:
      "Equatorial orbit at 35,786 km (~3.07 km/s) matching Earth's 24-hour rotation for continuous weather coverage.",
  },
  {
    id: ORBIT_IDS.LUNAR,
    name: "Lunar Transfer & Polar Orbit (LUNAR)",
    targetBody: "Moon",
    altitudeKm: 384400,
    targetOrbitAltitudeKm: 50,
    requiredDeltaVMs: 14100,
    tpiDeltaVMs: 3130,
    captureDeltaVMs: 890,
    insertionOverheadMs: 816,
    orbitalPeriodSec: 48,
    orbitRadius3D: 11.2,
    inclinationDeg: 5.1,
    cruiseDays: 5,
    solarDistanceAU: 1.0,
    radiationFluxKradPerDay: 2.4,
    eclipseMinutes: 48,
    ambientSunTempC: 46,
    ambientEclipseTempC: -42,
    description:
      "LRO-class trans-lunar trajectory (~384,400 km) requiring ~3.13 km/s TLI plus ~0.89 km/s lunar orbit capture.",
  },
  {
    id: ORBIT_IDS.MARS,
    name: "Mars Transfer & Polar Orbit (MARS)",
    targetBody: "Mars",
    altitudeKm: 225000000,
    targetOrbitAltitudeKm: 400,
    requiredDeltaVMs: 14650,
    tpiDeltaVMs: 3650,
    captureDeltaVMs: 1400,
    insertionOverheadMs: 1200,
    orbitalPeriodSec: 60,
    orbitRadius3D: 14.5,
    inclinationDeg: 1.85,
    cruiseDays: 210,
    solarDistanceAU: 1.524,
    radiationFluxKradPerDay: 0.48,
    eclipseMinutes: 45,
    ambientSunTempC: 15,
    ambientEclipseTempC: -110,
    description:
      "MAVEN-class interplanetary trajectory (~225M km, 12.5-min signal delay, 43% solar flux) requiring TMI + Mars capture burn.",
  },
];

/**
 * Return all target orbits.
 * @returns {Array<Object>}
 */
export function getOrbits() {
  return ORBITS;
}

/**
 * Find an orbit definition by ID.
 * @param {string} orbitId
 * @returns {Object | undefined}
 */
export function getOrbitById(orbitId) {
  return ORBITS.find((o) => o.id === orbitId);
}
