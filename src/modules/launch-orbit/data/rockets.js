/**
 * @file src/modules/launch-orbit/data/rockets.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Database of available launch vehicles (SmallSat, Medium, Heavy) with
 *       max payload mass to LEO, delta-v boost capability, fairing constraints, and cost.
 */

export const ROCKETS = [
  // TODO: Populate 3–4 launch vehicle options (e.g., Electron-class, Falcon-class, Heavy-lift)
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
