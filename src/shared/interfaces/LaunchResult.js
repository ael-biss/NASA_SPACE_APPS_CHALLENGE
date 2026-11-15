/**
 * @file src/shared/interfaces/LaunchResult.js
 * @owner Shared (Produced by Member 3: Launch & Orbit; consumed by Members 1, 4)
 * @goal Defines the LaunchResult data contract reporting rocket choice, achieved orbit,
 *       remaining delta-v margin, launch cost, and launch success/failure status.
 */

/**
 * @typedef {Object} FlightPhaseResult
 * @property {string} id - Phase identifier
 * @property {string} name - Human-readable phase title
 * @property {"passed" | "failed" | "skipped"} status - Outcome of this phase
 * @property {string} summary - Concise physics readout summary
 * @property {Object} [metrics] - Phase-specific physics numbers
 * @property {string} [cause] - Root cause explanation when status === "failed"
 * @property {string} [fix] - Actionable engineering fix when status === "failed"
 */

/**
 * @typedef {Object} LaunchResult
 * @property {string} rocketId - Selected launch vehicle ID
 * @property {string} fairingId - Selected fairing / launch adapter ID
 * @property {string} targetOrbitId - Target orbit ID
 * @property {boolean} success - Whether the spacecraft reached the target orbit
 * @property {number} achievedAltitudeKm - Final orbital altitude reached in km
 * @property {number} remainingDeltaVMs - Remaining spacecraft delta-v in m/s
 * @property {number} launchCostMillions - Launch vehicle + fairing cost in $M
 * @property {string} failureReason - Explanation if launch failed (empty on success)
 * @property {string | null} failedPhaseId - ID of the phase where mission failed, or null
 * @property {string} failureCause - Detailed physics cause of failure
 * @property {string} failureFix - Actionable design/launch fix for the failure
 * @property {string} failureMode - Visual/physical failure mode ("explosion" | "structural-breakup" | "suborbital-fall" | "signal-lost" | "power-loss" | "thermal-failure" | "radiation-fried" | "missed-capture" | "")
 * @property {FlightPhaseResult[]} phases - Ordered phase-by-phase flight timeline
 * @property {Record<string, number>} componentHealth - Remaining health (0-100) per subsystem
 * @property {Object} missionStats - Summary physics telemetry across the flight
 */

/**
 * Create a baseline LaunchResult object.
 * @returns {LaunchResult}
 */
export function createDefaultLaunchResult() {
  return {
    rocketId: "",
    fairingId: "standard-fairing",
    targetOrbitId: "LEO",
    success: false,
    achievedAltitudeKm: 0,
    remainingDeltaVMs: 0,
    launchCostMillions: 0,
    failureReason: "",
    failedPhaseId: null,
    failureCause: "",
    failureFix: "",
    failureMode: "",
    phases: [],
    componentHealth: {
      structure: 100,
      solarPanels: 100,
      batteries: 100,
      propulsion: 100,
      antenna: 100,
      avionics: 100,
      thermal: 100,
      payload: 100,
    },
    missionStats: {},
  };
}
