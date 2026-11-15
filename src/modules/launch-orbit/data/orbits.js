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

export const ORBITS = [
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