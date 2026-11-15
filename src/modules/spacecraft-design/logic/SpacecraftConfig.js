/**
 * @file src/modules/spacecraft-design/logic/SpacecraftConfig.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Maintains current subsystem selections, computes mass, power, delta-v, comms,
 *       physical survivability limits (g-load, thermal, radiation, pointing), and cost totals,
 *       validates compatibility, and outputs a SpacecraftSpec contract.
 */

import { PHYSICS } from "../../../shared/data/constants.js";
import {
  ALL_SUBSYSTEM_CATEGORIES,
  DEFAULT_SELECTION,
  getComponentById,
} from "../data/components.js";
import { Compatibility } from "./Compatibility.js";

export class SpacecraftConfig {
  /** @param {Partial<import('../../../shared/interfaces/SpacecraftSpec.js').SpacecraftSelection>} initialSelection */
  constructor(initialSelection = DEFAULT_SELECTION) {
    this.selection = { ...DEFAULT_SELECTION, ...initialSelection };
    this.instruments = [];
    this._compatibility = new Compatibility();
  }

  /**
   * Select or replace a component in one subsystem category.
   * @param {string} category - Category key from ALL_SUBSYSTEM_CATEGORIES
   * @param {string} componentId
   */
  setComponent(category, componentId) {
    const meta = ALL_SUBSYSTEM_CATEGORIES.find((c) => c.key === category);
    if (!meta) return;
    const item = getComponentById(category, componentId);
    if (!item) return;
    this.selection[meta.selectionKey] = componentId;
  }

  /**
   * Attach mission payload instruments from MissionSpec so mass/power/cost totals stay accurate.
   * @param {Array<import('../../../shared/interfaces/MissionSpec.js').InstrumentSelection>} instruments
   */
  setInstruments(instruments) {
    this.instruments = Array.isArray(instruments) ? instruments : [];
  }

  /**
   * Calculate aggregate engineering metrics across all selected parts + instruments.
   * @returns {Object}
   */
  computeMetrics() {
    const structure = getComponentById("structures", this.selection.structureId);
    const solarPanel = getComponentById("solarPanels", this.selection.solarPanelId);
    const battery = getComponentById("batteries", this.selection.batteryId);
    const propulsion = getComponentById("propulsion", this.selection.propulsionId);
    const antenna = getComponentById("antennas", this.selection.antennaId);
    const avionics = getComponentById("avionics", this.selection.avionicsId);
    const thermal =
      getComponentById("thermalControl", this.selection.thermalId || "baseline-mli") ??
      getComponentById("thermalControl", "baseline-mli");
    const shielding =
      getComponentById("radiationShielding", this.selection.shieldingId || "none-shield") ??
      getComponentById("radiationShielding", "none-shield");
    const reactionWheel =
      getComponentById("reactionWheels", this.selection.reactionWheelId || "baseline-rcs") ??
      getComponentById("reactionWheels", "baseline-rcs");

    const payloadMassKg = this.instruments.reduce((sum, i) => sum + (i.massKg || 0), 0);
    const payloadPowerWatts = this.instruments.reduce((sum, i) => sum + (i.powerWatts || 0), 0);
    const payloadCostMillions = this.instruments.reduce((sum, i) => sum + (i.costMillions || 0), 0);

    const subsystemsMassKg =
      (solarPanel?.massKg || 0) +
      (battery?.massKg || 0) +
      (propulsion?.dryMassKg || 0) +
      (antenna?.massKg || 0) +
      (avionics?.massKg || 0) +
      (thermal?.massKg || 0) +
      (shielding?.massKg || 0) +
      (reactionWheel?.massKg || 0);

    const dryMassKg = (structure?.massKg || 0) + subsystemsMassKg + payloadMassKg;
    const propellantMassKg = propulsion?.propellantMassKg || 0;
    const totalMassKg = dryMassKg + propellantMassKg;
    const carriedMassKg = subsystemsMassKg + propellantMassKg + payloadMassKg;

    const powerGeneratedWatts = solarPanel?.powerGeneratedWatts || 0;
    const powerConsumedWatts =
      (propulsion?.powerWatts || 0) +
      (antenna?.powerWatts || 0) +
      (avionics?.powerWatts || 0) +
      (thermal?.powerWatts || 0) +
      (reactionWheel?.powerWatts || 0) +
      payloadPowerWatts;

    const ispSeconds = propulsion?.ispSeconds || 0;
    const deltaVMs =
      ispSeconds > 0 && dryMassKg > 0 && totalMassKg > dryMassKg
        ? ispSeconds * PHYSICS.STANDARD_GRAVITY_MS2 * Math.log(totalMassKg / dryMassKg)
        : 0;

    const costMillions =
      (structure?.costMillions || 0) +
      (solarPanel?.costMillions || 0) +
      (battery?.costMillions || 0) +
      (propulsion?.costMillions || 0) +
      (antenna?.costMillions || 0) +
      (avionics?.costMillions || 0) +
      (thermal?.costMillions || 0) +
      (shielding?.costMillions || 0) +
      (reactionWheel?.costMillions || 0);

    // Physical survivability limits across all chosen parts
    const gCandidates = [
      structure?.maxG,
      solarPanel?.maxG,
      battery?.maxG,
      propulsion?.maxG,
      antenna?.maxG,
      avionics?.maxG,
    ].filter((v) => typeof v === "number");
    const maxG = gCandidates.length > 0 ? Math.min(...gCandidates) : 8.0;

    // Fragile optical/active instruments lower payload vibration tolerance slightly
    const instrumentVibLimit = this.instruments.length > 0 ? 7.2 : 9.0;
    const vibrationLimitG = Math.min(structure?.vibrationLimitG ?? 7.5, instrumentVibLimit);

    const lowCandidates = [
      structure?.tempMinC,
      battery?.tempMinC,
      propulsion?.tempMinC,
      avionics?.tempMinC,
    ].filter((v) => typeof v === "number");
    const highCandidates = [
      structure?.tempMaxC,
      battery?.tempMaxC,
      propulsion?.tempMaxC,
      avionics?.tempMaxC,
    ].filter((v) => typeof v === "number");

    const baseTempMinC = lowCandidates.length > 0 ? Math.max(...lowCandidates) : -15;
    const baseTempMaxC = highCandidates.length > 0 ? Math.min(...highCandidates) : 55;
    const tempMinC = baseTempMinC + (thermal?.tempShiftLowC ?? 0);
    const tempMaxC = baseTempMaxC + (thermal?.tempShiftHighC ?? 0);

    const baseRadLimitKrad = avionics?.radLimitKrad ?? 12;
    const attenuationFactor = shielding?.attenuationFactor ?? 1.0;
    const effectiveRadLimitKrad = baseRadLimitKrad / attenuationFactor;

    // Stowed launch envelope diameter (bus width + folded panels/dish collar)
    const busSpan = Math.max(structure?.width ?? 1.0, structure?.depth ?? 1.0);
    const antennaStowed = (antenna?.radius ?? 0.3) * 1.4;
    const stowedDiameterM = Number(Math.max(busSpan + 0.2, antennaStowed).toFixed(2));

    const limits = {
      maxG,
      vibrationLimitG,
      structuralStrengthKpa: structure?.structuralStrengthKpa ?? 45,
      maxQExposedKpa: Math.min(
        solarPanel?.maxQExposedKpa ?? 45,
        antenna?.maxQExposedKpa ?? 45
      ),
      tempMinC,
      tempMaxC,
      insulationFactor: thermal?.insulationFactor ?? 0.28,
      coolingCapacityW: thermal?.coolingCapacityW ?? 120,
      baseRadLimitKrad,
      attenuationFactor,
      effectiveRadLimitKrad,
      pointingAccuracyDeg: reactionWheel?.pointingAccuracyDeg ?? 2.5,
      minAntennaPointingDeg: antenna?.minPointingDeg ?? 15.0,
      burnStability: reactionWheel?.burnStability ?? 0.78,
      stowedDiameterM,
      deployableSolar: Boolean(solarPanel?.deployable),
      deployRisk: solarPanel?.deployRisk ?? 0,
      radHardened: Boolean(avionics?.radHardened),
      thermalId: thermal?.id ?? "baseline-mli",
      shieldingId: shielding?.id ?? "none-shield",
      reactionWheelId: reactionWheel?.id ?? "baseline-rcs",
    };

    return {
      structure,
      solarPanel,
      battery,
      propulsion,
      antenna,
      avionics,
      thermal,
      shielding,
      reactionWheel,
      dryMassKg,
      propellantMassKg,
      totalMassKg,
      carriedMassKg,
      payloadMassKg,
      payloadCostMillions,
      maxPayloadMassKg: structure?.maxPayloadMassKg || 0,
      powerGeneratedWatts,
      powerConsumedWatts,
      batteryCapacityWh: battery?.capacityWh || 0,
      ispSeconds,
      thrustN: propulsion?.thrustN || 0,
      deltaVMs,
      maxDataRateKbps: antenna?.maxDataRateKbps || 0,
      maxRangeKm: antenna?.maxRangeKm || 0,
      costMillions,
      limits,
    };
  }

  /**
   * Build the standardized SpacecraftSpec contract for GameState.
   * @param {import('../../../shared/interfaces/MissionSpec.js').MissionSpec | null} missionSpec
   * @returns {import('../../../shared/interfaces/SpacecraftSpec.js').SpacecraftSpec}
   */
  toSpacecraftSpec(missionSpec = null) {
    const metrics = this.computeMetrics();
    const validation = this._compatibility.validate(metrics, missionSpec);

    return {
      selection: { ...this.selection },
      dryMassKg: metrics.dryMassKg,
      propellantMassKg: metrics.propellantMassKg,
      totalMassKg: metrics.totalMassKg,
      carriedMassKg: metrics.carriedMassKg,
      maxPayloadMassKg: metrics.maxPayloadMassKg,
      powerGeneratedWatts: metrics.powerGeneratedWatts,
      powerConsumedWatts: metrics.powerConsumedWatts,
      batteryCapacityWh: metrics.batteryCapacityWh,
      ispSeconds: metrics.ispSeconds,
      thrustN: metrics.thrustN,
      deltaVMs: metrics.deltaVMs,
      maxDataRateKbps: metrics.maxDataRateKbps,
      maxRangeKm: metrics.maxRangeKm,
      costMillions: metrics.costMillions,
      limits: metrics.limits,
      isValid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }
}
