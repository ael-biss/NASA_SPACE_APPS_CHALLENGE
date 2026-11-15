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
 * @property {string} [thermalId] - Thermal control subsystem ID
 * @property {string} [shieldingId] - Radiation shielding ID
 * @property {string} [reactionWheelId] - Attitude control / reaction wheel ID
 */

/**
 * @typedef {Object} SpacecraftSpec
 * @property {SpacecraftSelection} selection - Selected component IDs
 * @property {number} dryMassKg - Spacecraft dry mass (structure + subsystems + payload)
 * @property {number} propellantMassKg - Propellant mass in kg
 * @property {number} totalMassKg - Wet mass (dry + propellant) in kg
 * @property {number} [carriedMassKg] - Mass carried by the bus (subsystems + propellant + payload) in kg
 * @property {number} [maxPayloadMassKg] - Maximum carried mass supported by the selected structure in kg
 * @property {number} powerGeneratedWatts - Solar power generated in Watts
 * @property {number} powerConsumedWatts - Total power consumed (subsystems + instruments)
 * @property {number} [batteryCapacityWh] - Selected battery pack energy capacity in Watt-hours
 * @property {number} ispSeconds - Specific impulse of chosen propulsion in seconds
 * @property {number} [thrustN] - Main engine thrust in Newtons
 * @property {number} [deltaVMs] - Spacecraft onboard delta-v capacity in m/s
 * @property {number} maxDataRateKbps - Supported communication data rate in kbps
 * @property {number} maxRangeKm - Supported communication distance in km
 * @property {number} costMillions - Spacecraft hardware cost in $M
 * @property {Object} [limits] - Physical survivability envelope (maxG, vibrationLimitG, tempRangeC, radLimitKrad, stowedDiameterM, etc.)
 * @property {boolean} isValid - Whether all compatibility checks pass
 * @property {string[]} errors - Blocking compatibility errors
 * @property {string[]} warnings - Non-blocking engineering warnings
 */

const REQUIRED_SUBSYSTEMS = [
  { key: "structureId", label: "structure" },
  { key: "solarPanelId", label: "solar panels" },
  { key: "batteryId", label: "battery pack" },
  { key: "propulsionId", label: "propulsion unit" },
  { key: "antennaId", label: "communications antenna" },
  { key: "avionicsId", label: "avionics computer" },
];

const NUMERIC_FIELDS = [
  { key: "dryMassKg", required: true },
  { key: "propellantMassKg", required: true },
  { key: "totalMassKg", required: true },
  { key: "powerGeneratedWatts", required: true },
  { key: "powerConsumedWatts", required: true },
  { key: "ispSeconds", required: true },
  { key: "maxDataRateKbps", required: true },
  { key: "maxRangeKm", required: true },
  { key: "costMillions", required: true },
  { key: "carriedMassKg", required: false },
  { key: "maxPayloadMassKg", required: false },
  { key: "batteryCapacityWh", required: false },
  { key: "deltaVMs", required: false },
];

function isNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validateSelection(selection, errors, addError) {
  if (!selection || typeof selection !== "object") {
    addError("Spacecraft subsystem selection is missing.");
    return false;
  }

  const missing = REQUIRED_SUBSYSTEMS.filter(
    ({ key }) => typeof selection[key] !== "string" || selection[key].trim() === ""
  );

  if (missing.length === REQUIRED_SUBSYSTEMS.length) {
    if (errors.length === 0) {
      addError("Spacecraft not configured yet.");
    }
    return false;
  }

  if (missing.length > 0 && !errors.some((e) => e.startsWith("Select "))) {
    addError(`Missing required subsystem(s): ${missing.map((m) => m.label).join(", ")}.`);
  }

  return missing.length === 0;
}

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
    carriedMassKg: 0,
    maxPayloadMassKg: 0,
    powerGeneratedWatts: 0,
    powerConsumedWatts: 0,
    batteryCapacityWh: 0,
    ispSeconds: 0,
    deltaVMs: 0,
    maxDataRateKbps: 0,
    maxRangeKm: 0,
    costMillions: 0,
    isValid: false,
    errors: ["Spacecraft not configured yet."],
    warnings: [],
  };
}

/**
 * Validate that a SpacecraftSpec contains complete subsystem selections, valid bounds,
 * and no blocking engineering compatibility errors.
 * @param {SpacecraftSpec | null} spec
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSpacecraftSpec(spec) {
  if (!spec || typeof spec !== "object") {
    return { valid: false, errors: ["No spacecraft configuration provided."] };
  }

  const errors = [];
  const addError = (msg) => {
    if (typeof msg === "string" && msg.trim() && !errors.includes(msg)) {
      errors.push(msg);
    }
  };

  if (Array.isArray(spec.errors)) {
    for (const err of spec.errors) {
      addError(err);
    }
  }

  const hasAllSubsystems = validateSelection(spec.selection, errors, addError);

  for (const { key, required } of NUMERIC_FIELDS) {
    if ((required || spec[key] !== undefined) && !isNonNegativeNumber(spec[key])) {
      addError(`Invalid spacecraft metric: ${key} must be a non-negative number.`);
    }
  }

  if (hasAllSubsystems) {
    if (typeof spec.dryMassKg === "number" && spec.dryMassKg <= 0) {
      addError("Spacecraft dry mass must be greater than 0 kg.");
    }
    if (typeof spec.totalMassKg === "number" && spec.totalMassKg <= 0) {
      addError("Spacecraft total mass must be greater than 0 kg.");
    }
    if (
      typeof spec.totalMassKg === "number" &&
      typeof spec.dryMassKg === "number" &&
      spec.totalMassKg < spec.dryMassKg
    ) {
      addError("Spacecraft total wet mass cannot be less than dry mass.");
    }
    if (
      typeof spec.maxPayloadMassKg === "number" &&
      spec.maxPayloadMassKg > 0 &&
      typeof spec.carriedMassKg === "number" &&
      spec.carriedMassKg > spec.maxPayloadMassKg &&
      !errors.some((e) => e.includes("exceeds") || e.includes("limit"))
    ) {
      addError("Carried mass exceeds bus structural payload limit.");
    }
    if (
      typeof spec.powerGeneratedWatts === "number" &&
      typeof spec.powerConsumedWatts === "number" &&
      spec.powerGeneratedWatts < spec.powerConsumedWatts &&
      !errors.some((e) => e.toLowerCase().includes("power"))
    ) {
      addError("Power generated is insufficient for total power consumption.");
    }
  }

  if (spec.isValid === false && errors.length === 0) {
    addError("Spacecraft configuration failed compatibility checks.");
  }

  return { valid: errors.length === 0, errors };
}
