/**
 * @file src/shared/interfaces/SpacecraftSpec.js
 * @owner Shared (Produced by Member 2: Spacecraft Design; consumed by Members 1, 3, 4)
 * @goal Defines the SpacecraftSpec data contract summarizing the assembled spacecraft's
 *       components, mass, power budget, delta-v, communications capability, and 3D model factory.
 */

/**
 * @typedef {Object} SpacecraftSelection
 * @property {string} structureId - Bus/chassis ID
 * @property {string} solarPanelId - Solar array ID
 * @property {string} batteryId - Battery pack ID
 * @property {string} propulsionId - Propulsion system ID
 * @property {string} antennaId - Communications antenna ID
 * @property {string} avionicsId - Avionics/flight computer ID
 */

/**
 * @typedef {Object} SpacecraftSpec
 * @property {SpacecraftSelection} selection - Selected component IDs
 * @property {number} dryMassKg - Spacecraft dry mass (structure + subsystems + payload)
 * @property {number} propellantMassKg - Propellant mass in kg
 * @property {number} totalMassKg - Wet mass (dry + propellant) in kg
 * @property {number} powerGeneratedWatts - Solar power generated in Watts
 * @property {number} powerConsumedWatts - Total power consumed (subsystems + instruments)
 * @property {number} ispSeconds - Specific impulse of chosen propulsion in seconds
 * @property {number} maxDataRateKbps - Supported communication data rate in kbps
 * @property {number} maxRangeKm - Supported communication distance in km
 * @property {number} costMillions - Spacecraft hardware cost in $M
 * @property {boolean} isValid - Whether all compatibility checks pass
 * @property {string[]} errors - Blocking compatibility errors
 * @property {string[]} warnings - Non-blocking engineering warnings
 */

/**
 * Create a baseline SpacecraftSpec object.
 * @returns {SpacecraftSpec}
 */
export function createDefaultSpacecraftSpec() {
  return {
    selection: {
      structureId: "",
      solarPanelId: "",
      batteryId: "",
      propulsionId: "",
      antennaId: "",
      avionicsId: "",
    },
    dryMassKg: 0,
    propellantMassKg: 0,
    totalMassKg: 0,
    powerGeneratedWatts: 0,
    powerConsumedWatts: 0,
    ispSeconds: 0,
    maxDataRateKbps: 0,
    maxRangeKm: 0,
    costMillions: 0,
    isValid: false,
    errors: ["Spacecraft not configured yet."],
    warnings: [],
  };
}
