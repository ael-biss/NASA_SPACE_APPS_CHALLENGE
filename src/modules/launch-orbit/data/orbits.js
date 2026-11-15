/**
 * @file src/modules/launch-orbit/data/orbits.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Catalog of target orbital regimes (LEO, MEO, GEO, Lunar Transfer) with
 *       altitude, required delta-v, orbital period, and 3D visualization radius.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * SOURCE NOTES
 * ═══════════════════════════════════════════════════════════════════════
 * requiredDeltaVMs = total Δv from the launch pad (Earth surface) to the
 * target, INCLUDING gravity and drag losses (~1.5–1.8 km/s lumped).
 * These are standard textbook "Δv map" figures, rounded:
 *
 *   LEO    ≈ 9,400 m/s   (≈ 7.8 km/s orbital speed + ~1.6 km/s losses)
 *   MEO    ≈ 12,900 m/s  (LEO + ≈ 3.5 km/s Hohmann transfer to 20,200 km)
 *   GEO    ≈ 13,300 m/s  (LEO + ≈ 3.9 km/s Hohmann transfer to 35,786 km,
 *                          before any plane change)
 *   LUNAR  ≈ 12,500 m/s  (LEO + ≈ 3.1 km/s trans-lunar injection burn)
 *
 * Note that LUNAR is cheaper than MEO/GEO: reaching the Moon's distance
 * only needs a transfer ellipse, not a circularised orbit.
 *
 * Figures are approximate. Cite your own references (e.g. NASA mission
 * design handbooks, Wertz "Space Mission Analysis and Design", Braeunig's
 * rocket-and-space-technology Δv tables) in the final write-up.
 *
 * FIELD GUIDE
 *   id                key used in rocket.payloadCapacityKg
 *   altitudeKm        height above Earth's surface (NOT radius)
 *   requiredDeltaVMs  Δv budget from pad to this orbit [m/s]
 *   periodMin         orbital period [min]
 *   inclinationDeg    inclination used for the 3D ring tilt
 *   visualRadius      ring radius in scene units, 1.0 = Earth's radius.
 *                     Compressed on purpose: true scale would put GEO at
 *                     6.6 and the Moon at 60 Earth radii.
 *   isTransfer        true when the target is a transfer trajectory, not
 *                     a circular orbit (circular v/T formulas do not apply)
 * ═══════════════════════════════════════════════════════════════════════
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
    inclinationDeg: 28.5,
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
  {
    id: 'LEO',
    name: 'Low Earth Orbit',
    description: 'ISS-class orbit. Earth observation, crewed stations, small satellites.',
    altitudeKm: 400,
    requiredDeltaVMs: 9400,
    periodMin: 92.6,
    inclinationDeg: 51.6,
    visualRadius: 1.25,
    color: '#4fc3f7',
    isTransfer: false
  },
  {
    id: 'MEO',
    name: 'Medium Earth Orbit',
    description: 'GPS-class orbit (~12 h period). Navigation constellations.',
    altitudeKm: 20200,
    requiredDeltaVMs: 12900,
    periodMin: 718,
    inclinationDeg: 55,
    visualRadius: 2.0,
    color: '#81c784',
    isTransfer: false
  },
  {
    id: 'GEO',
    name: 'Geostationary Orbit',
    description: 'Period matches Earth’s rotation, so the satellite hovers over one spot.',
    altitudeKm: 35786,
    requiredDeltaVMs: 13300,
    periodMin: 1436,
    inclinationDeg: 0,
    visualRadius: 3.0,
    color: '#ffb74d',
    isTransfer: false
  },
  {
    id: 'LUNAR',
    name: 'Lunar Transfer',
    description: 'Trans-lunar trajectory reaching the Moon’s distance (~384,400 km from Earth’s centre).',
    altitudeKm: 378029, // 384,400 km Moon distance − 6,371 km Earth radius
    requiredDeltaVMs: 12500,
    periodMin: 39343, // Moon's sidereal period, ~27.3 days
    inclinationDeg: 28.5,
    visualRadius: 4.5,
    color: '#ba68c8',
    isTransfer: true
  }
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