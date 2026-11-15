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
  SPACECRAFT_COMPONENTS,
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
   * Replace multiple subsystem selections at once (e.g., from Auto-fix).
   * @param {Partial<import('../../../shared/interfaces/SpacecraftSpec.js').SpacecraftSelection>} nextSelection
   */
  applySelection(nextSelection) {
    if (!nextSelection) return;
    for (const cat of ALL_SUBSYSTEM_CATEGORIES) {
      const nextId = nextSelection[cat.selectionKey];
      if (nextId && getComponentById(cat.key, nextId)) {
        this.selection[cat.selectionKey] = nextId;
      }
    }
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

/**
 * Compute the cheapest subsystem modification set that resolves compatibility errors and warnings.
 * Prefers preserving propulsion selection and minimizing cost increase (and number of swapped parts).
 *
 * @param {Partial<import('../../../shared/interfaces/SpacecraftSpec.js').SpacecraftSelection>} currentSelection
 * @param {Array<Object>} [instruments=[]]
 * @param {import('../../../shared/interfaces/MissionSpec.js').MissionSpec | null} [missionSpec=null]
 * @returns {{
 *   selection: Object,
 *   costDelta: number,
 *   newTotalCost: number,
 *   changes: Array<{ category: string, label: string, selectionKey: string, fromId: string, fromName: string, toId: string, toName: string, costDelta: number }>,
 *   remainingErrors: number,
 *   remainingWarnings: number,
 * } | null}
 */
export function computeCheapestAutoFix(currentSelection, instruments = [], missionSpec = null) {
  const baseSelection = { ...DEFAULT_SELECTION, ...(currentSelection ?? {}) };
  const baseConfig = new SpacecraftConfig(baseSelection);
  baseConfig.setInstruments(instruments);
  const baseSpec = baseConfig.toSpacecraftSpec(missionSpec);

  const baseErrs = baseSpec.errors?.length ?? 0;
  const baseWarns = baseSpec.warnings?.length ?? 0;
  if (baseErrs === 0 && baseWarns === 0) return null;

  const baseCost = baseSpec.costMillions ?? 0;
  const instList = Array.isArray(instruments) ? instruments : [];
  const payloadMassKg = instList.reduce((s, i) => s + (i?.massKg || 0), 0);
  const payloadPowerW = instList.reduce((s, i) => s + (i?.powerWatts || 0), 0);
  const payloadCostM = instList.reduce((s, i) => s + (i?.costMillions || 0), 0);

  const targetOrbit = missionSpec?.targetOrbitId ?? "";
  const isLunarOrMars = targetOrbit === "LUNAR" || targetOrbit === "MARS";
  const isMars = targetOrbit === "MARS";
  const targetDistKm = missionSpec?.targetDistanceKm ?? 0;
  const reqRateKbps = missionSpec?.requiredDataRateKbps ?? 0;
  const budgetCap = missionSpec?.budgetMillions ?? Infinity;

  const compat = new Compatibility();
  const cfg = new SpacecraftConfig(baseSelection);
  cfg.setInstruments(instList);

  const countChanges = (sel) =>
    ALL_SUBSYSTEM_CATEGORIES.reduce(
      (n, c) => n + (sel[c.selectionKey] !== baseSelection[c.selectionKey] ? 1 : 0),
      0
    );

  const currentOverBudget =
    Number.isFinite(budgetCap) && baseCost + payloadCostM > budgetCap * 0.78;

  const searchPass = (allowPropulsionChange, requireZeroWarnings, allowDowngrades = true) => {
    let best = null;

    const filterNoDowngrade = (catKey, pool, baseId) => {
      if (allowDowngrades) return pool;
      const baseItem = getComponentById(catKey, baseId);
      const minCost = baseItem?.costMillions ?? 0;
      const filtered = pool.filter((item) => (item.costMillions ?? 0) >= minCost);
      return filtered.length > 0 ? filtered : pool;
    };

    const currentProp = getComponentById("propulsion", baseSelection.propulsionId);
    const propPool = allowPropulsionChange
      ? SPACECRAFT_COMPONENTS.propulsion
      : currentProp
        ? [currentProp]
        : SPACECRAFT_COMPONENTS.propulsion;

    const antennaRaw = requireZeroWarnings && missionSpec
      ? SPACECRAFT_COMPONENTS.antennas.filter(
          (a) => a.maxRangeKm >= targetDistKm && a.maxDataRateKbps >= reqRateKbps
        )
      : SPACECRAFT_COMPONENTS.antennas;
    const antennaPool = filterNoDowngrade("antennas", antennaRaw, baseSelection.antennaId);

    const avionicsRaw = requireZeroWarnings && missionSpec && targetOrbit !== "LEO"
      ? SPACECRAFT_COMPONENTS.avionics.filter((a) => a.radHardened)
      : SPACECRAFT_COMPONENTS.avionics;
    const avionicsPool = filterNoDowngrade("avionics", avionicsRaw, baseSelection.avionicsId);

    const thermalRaw = requireZeroWarnings && isLunarOrMars
      ? SPACECRAFT_COMPONENTS.thermalControl.filter((t) => t.id !== "baseline-mli")
      : SPACECRAFT_COMPONENTS.thermalControl;
    const thermalPool = filterNoDowngrade("thermalControl", thermalRaw, baseSelection.thermalId);

    const shieldRaw = requireZeroWarnings && isMars
      ? SPACECRAFT_COMPONENTS.radiationShielding.filter((s) => s.id !== "none-shield")
      : SPACECRAFT_COMPONENTS.radiationShielding;
    const shieldPool = filterNoDowngrade("radiationShielding", shieldRaw, baseSelection.shieldingId);

    const solarPool = filterNoDowngrade("solarPanels", SPACECRAFT_COMPONENTS.solarPanels, baseSelection.solarPanelId);
    const batteryPool = filterNoDowngrade("batteries", SPACECRAFT_COMPONENTS.batteries, baseSelection.batteryId);
    const structurePool = filterNoDowngrade("structures", SPACECRAFT_COMPONENTS.structures, baseSelection.structureId);

    const massLoadRatio = requireZeroWarnings ? 0.9 : 1.0;
    const budgetCeiling = Number.isFinite(budgetCap)
      ? requireZeroWarnings
        ? budgetCap * 0.78
        : budgetCap
      : Infinity;

    for (const propulsion of propPool) {
      for (const antenna of antennaPool) {
        const rwRaw = requireZeroWarnings && isLunarOrMars
          ? SPACECRAFT_COMPONENTS.reactionWheels.filter(
              (rw) => rw.pointingAccuracyDeg <= (antenna.minPointingDeg ?? 15)
            )
          : SPACECRAFT_COMPONENTS.reactionWheels;
        const rwPool = filterNoDowngrade("reactionWheels", rwRaw, baseSelection.reactionWheelId);

        for (const avionics of avionicsPool) {
          for (const thermal of thermalPool) {
            for (const shielding of shieldPool) {
              for (const rw of rwPool) {
                const powerDraw =
                  (propulsion.powerWatts || 0) +
                  (antenna.powerWatts || 0) +
                  (avionics.powerWatts || 0) +
                  (thermal.powerWatts || 0) +
                  (rw.powerWatts || 0) +
                  payloadPowerW;

                const subMassNoSolarBat =
                  (propulsion.dryMassKg || 0) +
                  (propulsion.propellantMassKg || 0) +
                  (antenna.massKg || 0) +
                  (avionics.massKg || 0) +
                  (thermal.massKg || 0) +
                  (shielding.massKg || 0) +
                  (rw.massKg || 0) +
                  payloadMassKg;

                const subCostNoSolarBatSt =
                  (propulsion.costMillions || 0) +
                  (antenna.costMillions || 0) +
                  (avionics.costMillions || 0) +
                  (thermal.costMillions || 0) +
                  (shielding.costMillions || 0) +
                  (rw.costMillions || 0);

                for (const solar of solarPool) {
                  if (requireZeroWarnings) {
                    if (solar.powerGeneratedWatts - powerDraw < powerDraw * 0.15) continue;
                    if (isMars && solar.powerGeneratedWatts * 0.43 < powerDraw) continue;
                  } else if (solar.powerGeneratedWatts < powerDraw) {
                    continue;
                  }

                  for (const battery of batteryPool) {
                    if (requireZeroWarnings && battery.capacityWh < powerDraw * 0.58) continue;

                    const carriedMass =
                      subMassNoSolarBat + (solar.massKg || 0) + (battery.massKg || 0);

                    for (const structure of structurePool) {
                      if (carriedMass > structure.maxPayloadMassKg * massLoadRatio) continue;

                      const craftCost =
                        subCostNoSolarBatSt +
                        (solar.costMillions || 0) +
                        (battery.costMillions || 0) +
                        (structure.costMillions || 0);

                      if (missionSpec && craftCost + payloadCostM > budgetCeiling) {
                        // In Tier 3/4 allow fallback only if even bare minimum fails budget
                        if (requireZeroWarnings) continue;
                      }

                      const candSelection = {
                        structureId: structure.id,
                        solarPanelId: solar.id,
                        batteryId: battery.id,
                        propulsionId: propulsion.id,
                        antennaId: antenna.id,
                        avionicsId: avionics.id,
                        thermalId: thermal.id,
                        shieldingId: shielding.id,
                        reactionWheelId: rw.id,
                      };

                      cfg.selection = candSelection;
                      const metrics = cfg.computeMetrics();
                      const res = compat.validate(metrics, missionSpec);
                      const errCount = res.errors.length;
                      const warnCount = res.warnings.length;

                      if (requireZeroWarnings && (errCount > 0 || warnCount > 0)) continue;

                      const costDelta = Number((craftCost - baseCost).toFixed(2));
                      const changesCount = countChanges(candSelection);
                      if (changesCount === 0) continue;

                      const isBetter =
                        !best ||
                        errCount < best.errCount ||
                        (errCount === best.errCount && warnCount < best.warnCount) ||
                        (errCount === best.errCount &&
                          warnCount === best.warnCount &&
                          (costDelta < best.costDelta - 1e-6 ||
                            (Math.abs(costDelta - best.costDelta) <= 1e-6 &&
                              (changesCount < best.changesCount ||
                                (changesCount === best.changesCount &&
                                  metrics.totalMassKg < best.totalMassKg)))));

                      if (isBetter) {
                        best = {
                          selection: candSelection,
                          craftCost,
                          costDelta,
                          changesCount,
                          errCount,
                          warnCount,
                          totalMassKg: metrics.totalMassKg,
                        };
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return best;
  };

  // Prefer pure upgrades (no part downgrades) when budget allows; allow cost-cutting swaps if over budget or needed
  const winner =
    (!currentOverBudget ? searchPass(false, true, false) : null) ??
    searchPass(false, true, true) ??
    searchPass(true, true, true) ??
    searchPass(false, false, true) ??
    searchPass(true, false, true);

  if (!winner) return null;

  // Ensure the winning fix actually improves issues compared to current state
  const currentIssueScore = baseErrs * 100 + baseWarns;
  const winnerIssueScore = winner.errCount * 100 + winner.warnCount;
  if (winnerIssueScore >= currentIssueScore) return null;

  const changes = [];
  for (const cat of ALL_SUBSYSTEM_CATEGORIES) {
    const prevId = baseSelection[cat.selectionKey];
    const nextId = winner.selection[cat.selectionKey];
    if (prevId !== nextId) {
      const prevItem = getComponentById(cat.key, prevId);
      const nextItem = getComponentById(cat.key, nextId);
      const delta = Number(
        (((nextItem?.costMillions ?? 0) - (prevItem?.costMillions ?? 0))).toFixed(2)
      );
      changes.push({
        category: cat.key,
        label: cat.label,
        selectionKey: cat.selectionKey,
        fromId: prevId,
        fromName: prevItem?.name ?? prevId,
        toId: nextId,
        toName: nextItem?.name ?? nextId,
        costDelta: delta,
      });
    }
  }

  return {
    selection: winner.selection,
    costDelta: winner.costDelta,
    newTotalCost: Number(winner.craftCost.toFixed(2)),
    changes,
    remainingErrors: winner.errCount,
    remainingWarnings: winner.warnCount,
  };
}
