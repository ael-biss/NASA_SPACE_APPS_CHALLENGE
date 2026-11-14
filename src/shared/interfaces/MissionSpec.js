/**
 * @file src/shared/interfaces/MissionSpec.js
 * @owner Shared (Produced by Member 1: Mission & Science; consumed by Members 2, 3, 4)
 * @goal Defines the MissionSpec data contract describing the chosen mission objective,
 *       selected scientific instruments, budget limit, and orbital/science constraints.
 */

/**
 * @typedef {Object} InstrumentSelection
 * @property {string} id - Unique instrument identifier
 * @property {string} name - Display name
 * @property {number} massKg - Instrument mass in kg
 * @property {number} powerWatts - Power draw in Watts
 * @property {number} dataRateKbps - Data generated in kbps
 * @property {number} costMillions - Cost in $M
 * @property {number} sciencePoints - Science score contribution
 */

/**
 * @typedef {Object} MissionSpec
 * @property {string} missionId - Selected mission template ID
 * @property {string} title - Mission title
 * @property {string} targetOrbitId - Target orbit key ("LEO" | "MEO" | "GEO" | "LUNAR")
 * @property {number} budgetMillions - Total allowed mission budget in $M
 * @property {number} minSciencePoints - Minimum science score required for mission success
 * @property {number} requiredDataRateKbps - Minimum downlink rate required
 * @property {number} targetDistanceKm - Communication distance for antenna range check
 * @property {InstrumentSelection[]} instruments - Chosen scientific payload instruments
 */

/**
 * Create a baseline MissionSpec object.
 * @returns {MissionSpec}
 */
export function createDefaultMissionSpec() {
  return {
    missionId: "",
    title: "",
    targetOrbitId: "LEO",
    budgetMillions: 100,
    minSciencePoints: 50,
    requiredDataRateKbps: 100,
    targetDistanceKm: 500,
    instruments: [],
  };
}

/**
 * Validate that a MissionSpec contains required fields and valid bounds.
 * @param {MissionSpec | null} spec
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateMissionSpec(spec) {
  const errors = [];
  if (!spec || !spec.missionId) errors.push("No mission objective selected.");
  if (!spec?.instruments?.length) errors.push("At least one science instrument is required.");
  return { valid: errors.length === 0, errors };
}
