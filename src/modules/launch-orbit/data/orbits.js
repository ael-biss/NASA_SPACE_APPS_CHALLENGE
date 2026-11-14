/**
 * @file src/modules/launch-orbit/data/orbits.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Catalog of target orbital regimes (LEO, MEO, GEO, Lunar Transfer) with
 *       altitude, required delta-v, orbital period, and 3D visualization radius.
 */

export const ORBITS = [
  // TODO: Populate LEO, MEO, GEO, and LUNAR orbit definitions
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
