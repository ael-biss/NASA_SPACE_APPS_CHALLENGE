/**
 * @file src/modules/mission-science/data/missions.js
 * @owner Member 1 (Mission & Science)
 * @goal Catalog of selectable space mission scenarios (target orbit, budget cap,
 *       minimum science score, required downlink data rate, and mission distance).
 */

export const MISSIONS = [
  // TODO: Populate 3–5 playable mission scenarios (e.g., Earth Observation LEO, Weather GEO, Lunar Orbiter)
];

/**
 * Return all available mission scenarios.
 * @returns {Array<Object>}
 */
export function getMissions() {
  return MISSIONS;
}

/**
 * Find a mission scenario by ID.
 * @param {string} missionId
 * @returns {Object | undefined}
 */
export function getMissionById(missionId) {
  return MISSIONS.find((m) => m.id === missionId);
}
