/**
 * @file src/modules/launch-orbit/logic/OrbitMechanics.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Δv budget calculation and mission success determination.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * THE PHYSICS
 * ═══════════════════════════════════════════════════════════════════════
 *   TSIOLKOVSKY ROCKET EQUATION:
 *
 *       Δv = Isp · g₀ · ln( m₀ / m_f )
 *
 *   where:
 *     Δv     achievable velocity change   [m/s]
 *     Isp    specific impulse             [s]
 *     g₀     standard gravity = 9.80665   [m/s²]
 *     m₀     mass at ignition (wet)       [kg]
 *     m_f    mass at burnout (dry)        [kg]
 *
 *   PHYSICAL MEANING: Δv is the total velocity change the rocket can
 *   produce by burning all its propellant. Δv is the "currency" of
 *   spaceflight — every maneuver (launch, transfer, insertion) costs
 *   a certain amount of it, and if your budget exceeds your supply,
 *   the mission cannot happen.
 *
 *   MULTI-STAGE VEHICLES: sum Δv across stages. For each stage i,
 *   the "mass at ignition" includes that stage's propellant AND all
 *   upper stages (still attached, still full of propellant) AND the
 *   payload. The "mass at burnout" excludes only the stage's own
 *   propellant. Discarded stage structure goes away before the next
 *   stage fires, which is why staging works — the next stage accelerates
 *   less dead weight.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * HACKATHON SIMPLIFICATION
 * ═══════════════════════════════════════════════════════════════════════
 * Mission success rule:
 *   success = payload fits the tabulated capacity
 *             AND Tsiolkovsky Δv ≥ orbit's required Δv budget
 *
 *   The tabulated payload capacity is treated as authoritative (it is
 *   what the manufacturer publishes). The Δv computation is the physics
 *   check that explains *why* the capacity drops with orbit.
 *
 *   In a full implementation:
 *     - Δv budget would be computed from the actual trajectory
 *     - Gravity losses would be integrated, not lumped
 *     - Payload capacity would be derived from Δv, not looked up
 * ═══════════════════════════════════════════════════════════════════════
 */

import { createDefaultLaunchResult } from '../../../shared/interfaces/LaunchResult.js';
import { representativeStageIspS } from './RocketPhysics.js';
import { STANDARD_GRAVITY } from '../../../shared/data/constants.js';

export class OrbitMechanics {
  /**
   * Required Δv (m/s) to reach a target orbit.
   * Read from the orbit definition (data/orbits.js). See source notes
   * there for the origin of these figures.
   * @param {Object} orbit
   * @returns {number}
   */
  calculateRequiredDeltaV(orbit) {
    return orbit?.requiredDeltaVMs ?? 0;
  }

  /**
   * Spacecraft's own Δv via Tsiolkovsky.
   * Used to check whether the spacecraft can perform the orbital
   * insertion burn from its parking orbit, or (later) do any maneuvering.
   *
   * @param {Object} spacecraftSpec — requires { ispSeconds, totalMassKg, dryMassKg }
   * @returns {number} Δv [m/s]
   */
  calculateSpacecraftDeltaV(spacecraftSpec) {
    const isp = spacecraftSpec?.ispSeconds;
    const m0 = spacecraftSpec?.totalMassKg;
    const mf = spacecraftSpec?.dryMassKg;
    if (!isp || !m0 || !mf || mf <= 0 || m0 <= mf) return 0;
    return isp * STANDARD_GRAVITY * Math.log(m0 / mf);
  }

  /**
   * Total Δv the launch vehicle can produce with the given payload
   * attached. Summed across stages using Tsiolkovsky.
   *
   * @param {Object} rocket      vehicle object from data/rockets.js
   * @param {number} payloadKg   spacecraft mass
   * @returns {number} Δv [m/s]
   */
  calculateRocketDeltaV(rocket, payloadKg) {
    let total = 0;
    for (let i = 0; i < rocket.stages.length; i++) {
      const stage = rocket.stages[i];

      // Mass "above" this stage = payload + all later stages
      // (still attached, still fully fueled).
      let massAbove = payloadKg;
      for (let j = i + 1; j < rocket.stages.length; j++) {
        massAbove += rocket.stages[j].dryMassKg + rocket.stages[j].propellantMassKg;
      }

      const ignition = stage.dryMassKg + stage.propellantMassKg + massAbove;
      const burnout = stage.dryMassKg + massAbove;
      const isp = representativeStageIspS(stage);
      const stageDeltaV = isp * STANDARD_GRAVITY * Math.log(ignition / burnout);
      total += stageDeltaV;
    }
    return total;
  }

  /**
   * Full launch simulation → LaunchResult for the game state.
   *
   * Fills the LaunchResult produced by createDefaultLaunchResult() with
   * computed values. Any field the interface has that we do not set
   * stays at its default — that is a safe behavior because the interface
   * author designed the defaults.
   *
   * @param {Object} rocket
   * @param {Object} spacecraftSpec
   * @param {Object} targetOrbit
   * @returns {Object} LaunchResult
   */
  simulateLaunch(rocket, spacecraftSpec, targetOrbit) {
    const result = createDefaultLaunchResult();

    // ── Identity ──
    result.rocketId = rocket?.id ?? null;
    result.orbitId = targetOrbit?.id ?? null;
    result.payloadMassKg = spacecraftSpec?.totalMassKg ?? 0;

    // ── Guard: missing inputs ──
    if (!rocket || !spacecraftSpec || !targetOrbit) {
      result.success = false;
      result.reason = 'Missing rocket, spacecraft, or target orbit.';
      return result;
    }

    // ── Check 1: Payload capacity for this orbit ──
    const capacity = rocket.payloadCapacityKg?.[targetOrbit.id];
    if (!capacity || capacity.max === 0) {
      result.success = false;
      result.reason = `${rocket.name} cannot reach ${targetOrbit.name}.`;
      return result;
    }
    if (spacecraftSpec.totalMassKg > capacity.max) {
      result.success = false;
      result.reason =
        `Payload ${spacecraftSpec.totalMassKg.toFixed(0)} kg exceeds ` +
        `${capacity.max.toFixed(0)} kg limit for ${targetOrbit.id}.`;
      return result;
    }

    // ── Check 2: Δv budget vs. Δv available ──
    const required = this.calculateRequiredDeltaV(targetOrbit);
    const available = this.calculateRocketDeltaV(rocket, spacecraftSpec.totalMassKg);
    const margin = available - required;

    result.deltaVRequiredMs = required;
    result.deltaVAvailableMs = available;
    result.deltaVMarginMs = margin;

    if (margin < 0) {
      result.success = false;
      result.reason =
        `Insufficient Δv: needs ${required.toFixed(0)} m/s, ` +
        `vehicle provides ${available.toFixed(0)} m/s ` +
        `(shortfall ${Math.abs(margin).toFixed(0)} m/s).`;
      return result;
    }

    // ── Success ──
    result.success = true;
    result.reason =
      `Payload fits and Δv budget is satisfied ` +
      `(${margin.toFixed(0)} m/s of margin).`;
    return result;
  }
}