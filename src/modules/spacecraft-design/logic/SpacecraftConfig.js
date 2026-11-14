/**
 * @file src/modules/spacecraft-design/logic/SpacecraftConfig.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Maintains the player's current subsystem selections, aggregates total mass,
 *       power generation/consumption, cost, and data rate, and exports a SpacecraftSpec.
 */

import { createDefaultSpacecraftSpec } from "../../../shared/interfaces/SpacecraftSpec.js";

export class SpacecraftConfig {
  constructor() {
    this.selection = {
      structureId: "",
      solarPanelId: "",
      batteryId: "",
      propulsionId: "",
      antennaId: "",
      avionicsId: "",
    };
    this.instruments = [];
  }

  /**
   * Select or replace a component in one subsystem category.
   * @param {string} category
   * @param {string} componentId
   */
  setComponent(category, componentId) {
    // TODO: Update this.selection for the given subsystem
  }

  /**
   * Attach mission payload instruments from MissionSpec so mass/power totals stay accurate.
   * @param {Array<import('../../../shared/interfaces/MissionSpec.js').InstrumentSelection>} instruments
   */
  setInstruments(instruments) {
    this.instruments = instruments ?? [];
  }

  /**
   * Calculate aggregate engineering metrics across all selected parts + instruments.
   * @returns {Object}
   */
  computeMetrics() {
    // TODO: Sum dryMassKg, propellantMassKg, powerGeneratedWatts, powerConsumedWatts, costMillions
    return {};
  }

  /**
   * Build the standardized SpacecraftSpec contract for GameState.
   * @param {import('../../../shared/interfaces/MissionSpec.js').MissionSpec | null} missionSpec
   * @returns {import('../../../shared/interfaces/SpacecraftSpec.js').SpacecraftSpec}
   */
  toSpacecraftSpec(missionSpec = null) {
    // TODO: Combine computeMetrics() + Compatibility.validate(...) into SpacecraftSpec
    return createDefaultSpacecraftSpec();
  }
}
