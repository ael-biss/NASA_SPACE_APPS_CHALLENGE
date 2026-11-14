/**
 * @file src/modules/spacecraft-design/logic/Compatibility.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Validates engineering compatibility between selected spacecraft components
 *       and mission constraints (mass capacity, power balance, antenna range, budget).
 */

export class Compatibility {
  /**
   * Run all compatibility checks on the current spacecraft configuration.
   * @param {Object} metrics - Computed spacecraft mass, power, range, cost, and part limits
   * @param {import('../../../shared/interfaces/MissionSpec.js').MissionSpec | null} missionSpec
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  validate(metrics, missionSpec) {
    // TODO: Check powerGenerated >= powerConsumed, bus payload capacity, antenna range >= targetDistanceKm
    return { valid: false, errors: ["Validation not implemented."], warnings: [] };
  }
}
