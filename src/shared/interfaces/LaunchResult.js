/**
 * @file src/shared/interfaces/LaunchResult.js
 * @owner Shared (Produced by Member 3: Launch & Orbit; consumed by Members 1, 4)
 * @goal Defines the LaunchResult data contract reporting rocket choice, achieved orbit,
 *       remaining delta-v margin, launch cost, and launch success/failure status.
 */

/**
 * @typedef {Object} LaunchResult
 * @property {string} rocketId - Selected launch vehicle ID
 * @property {string} targetOrbitId - Target orbit ID
 * @property {boolean} success - Whether the spacecraft reached the target orbit
 * @property {number} achievedAltitudeKm - Final orbital altitude reached in km
 * @property {number} remainingDeltaVMs - Remaining spacecraft delta-v in m/s
 * @property {number} launchCostMillions - Launch vehicle cost in $M
 * @property {string} failureReason - Explanation if launch failed (empty on success)
 */

/**
 * Create a baseline LaunchResult object.
 * @returns {LaunchResult}
 */
export function createDefaultLaunchResult() {
  return {
    rocketId: "",
    targetOrbitId: "LEO",
    success: false,
    achievedAltitudeKm: 0,
    remainingDeltaVMs: 0,
    launchCostMillions: 0,
    failureReason: "",
  };
}
