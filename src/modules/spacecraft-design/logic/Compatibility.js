/**
 * @file src/modules/spacecraft-design/logic/Compatibility.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Validates engineering compatibility between selected spacecraft components
 *       and mission constraints (mass capacity, power balance, antenna range, budget, radiation).
 */

export class Compatibility {
  /**
   * Run all compatibility checks on the computed spacecraft metrics and optional mission.
   * @param {Object} metrics - Output from SpacecraftConfig.computeMetrics()
   * @param {import('../../../shared/interfaces/MissionSpec.js').MissionSpec | null} missionSpec
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  validate(metrics, missionSpec = null) {
    const errors = [];
    const warnings = [];

    if (!metrics.structure) errors.push("Select a spacecraft structure.");
    if (!metrics.solarPanel) errors.push("Select solar panels.");
    if (!metrics.battery) errors.push("Select a battery pack.");
    if (!metrics.propulsion) errors.push("Select a propulsion unit.");
    if (!metrics.antenna) errors.push("Select a communications antenna.");
    if (!metrics.avionics) errors.push("Select an avionics computer.");

    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }

    // 1. Structural payload mass limit (subsystems + propellant + instruments vs bus capacity)
    if (metrics.carriedMassKg > metrics.maxPayloadMassKg) {
      errors.push(
        `Carried mass (${Math.round(metrics.carriedMassKg)} kg) exceeds ${metrics.structure.name} limit (${metrics.maxPayloadMassKg} kg).`
      );
    } else if (metrics.carriedMassKg > metrics.maxPayloadMassKg * 0.9) {
      warnings.push("Bus structural load is above 90% capacity.");
    }

    // 2. Power budget check
    const powerMargin = metrics.powerGeneratedWatts - metrics.powerConsumedWatts;
    if (powerMargin < 0) {
      errors.push(
        `Power deficit of ${Math.abs(Math.round(powerMargin))} W (generated ${metrics.powerGeneratedWatts} W vs load ${metrics.powerConsumedWatts} W).`
      );
    } else if (powerMargin < metrics.powerConsumedWatts * 0.15) {
      warnings.push("Power margin is tight (< 15% reserve).");
    }

    // 3. Battery eclipse reserve check (assume ~35 min / 0.58 hr eclipse window)
    if (metrics.batteryCapacityWh < metrics.powerConsumedWatts * 0.58) {
      warnings.push(
        `Battery (${metrics.batteryCapacityWh} Wh) may run low during orbital eclipses.`
      );
    }

    // 4. Mission-specific compatibility checks
    if (missionSpec) {
      if (metrics.maxRangeKm < missionSpec.targetDistanceKm) {
        errors.push(
          `Antenna range (${metrics.maxRangeKm.toLocaleString()} km) cannot reach ${missionSpec.targetOrbitId} target (${missionSpec.targetDistanceKm.toLocaleString()} km).`
        );
      }

      if (metrics.maxDataRateKbps < missionSpec.requiredDataRateKbps) {
        errors.push(
          `Antenna data rate (${metrics.maxDataRateKbps} kbps) is below mission minimum (${missionSpec.requiredDataRateKbps} kbps).`
        );
      }

      const combinedCost = metrics.costMillions + metrics.payloadCostMillions;
      if (combinedCost > missionSpec.budgetMillions) {
        errors.push(
          `Spacecraft + payload ($${combinedCost.toFixed(1)}M) exceeds total budget ($${missionSpec.budgetMillions.toFixed(1)}M).`
        );
      } else if (combinedCost > missionSpec.budgetMillions * 0.78) {
        warnings.push(
          `Spacecraft + payload uses > 78% of budget — verify funds remain for a rocket.`
        );
      }

      if (
        missionSpec.targetOrbitId &&
        missionSpec.targetOrbitId !== "LEO" &&
        !metrics.avionics.radHardened
      ) {
        warnings.push(
          `Standard avionics are not radiation-hardened for ${missionSpec.targetOrbitId} environments.`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
