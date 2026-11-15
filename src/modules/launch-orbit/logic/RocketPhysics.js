/**
 * @file src/modules/launch-orbit/logic/RocketPhysics.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Per-vehicle physics helpers: representative Isp per stage,
 *       liftoff mass, and thrust-to-weight ratio (TWR).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * THE PHYSICS
 * ═══════════════════════════════════════════════════════════════════════
 *   SPECIFIC IMPULSE (Isp) measures engine efficiency: seconds a engine
 *   can produce 1 kg·g₀ of thrust from 1 kg of propellant. It depends on
 *   ambient pressure, so engines have two values:
 *       Isp_sl   at sea level (lower, exhaust is squeezed by air)
 *       Isp_vac  in vacuum    (higher)
 *
 *   THRUST-TO-WEIGHT RATIO at liftoff:
 *       TWR = F_thrust / (m₀ · g₀)
 *   TWR must exceed 1 or the rocket never leaves the pad. Real launchers
 *   sit around 1.2 – 1.8 at liftoff.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * HACKATHON SIMPLIFICATION
 * ═══════════════════════════════════════════════════════════════════════
 *   A stage burns through changing ambient pressure, so its true average
 *   Isp comes from integrating the trajectory. We use ONE representative
 *   number per stage:
 *       - both Isp values given → mean of sea-level and vacuum
 *       - only vacuum given     → vacuum (typical for upper stages)
 *       - only a single `isp`   → that value
 *
 * EXPECTED STAGE FIELDS (aliases accepted, see pick() calls below):
 *   dryMassKg, propellantMassKg,
 *   ispSeaLevelS, ispVacuumS   (or a single ispS / isp)
 *   thrustSeaLevelN, thrustVacuumN  (or a single thrustN / thrust)
 * ═══════════════════════════════════════════════════════════════════════
 */

import { STANDARD_GRAVITY } from '../../../shared/data/constants.js';

/** TWR below this cannot lift off. */
export const MIN_LIFTOFF_TWR = 1.0;
/** TWR below this is flagged as marginal (gravity losses become large). */
export const RECOMMENDED_LIFTOFF_TWR = 1.2;

/** Return the first finite, positive number among the given values. */
function pick(...values) {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  }
  return 0;
}

/**
 * Representative specific impulse of a stage [s].
 * @param {Object} stage
 * @returns {number} Isp [s]; 0 if the stage has no usable Isp data
 */
export function representativeStageIspS(stage) {
  if (!stage) return 0;
  const sl = pick(stage.ispSeaLevelS, stage.ispSlS);
  const vac = pick(stage.ispVacuumS, stage.ispVacS);
  if (sl && vac) return (sl + vac) / 2;
  return pick(vac, sl, stage.ispS, stage.isp);
}

/**
 * Sea-level thrust of a stage [N]. Falls back to vacuum or a single value.
 * @param {Object} stage
 * @returns {number} thrust [N]; 0 if unknown
 */
export function stageLiftoffThrustN(stage) {
  if (!stage) return 0;
  return pick(
    stage.thrustSeaLevelN,
    stage.thrustSlN,
    stage.thrustN,
    stage.thrust,
    stage.thrustVacuumN
  );
}

/**
 * Wet mass of a single stage (structure + propellant) [kg].
 * @param {Object} stage
 * @returns {number}
 */
export function stageWetMassKg(stage) {
  return (stage?.dryMassKg ?? 0) + (stage?.propellantMassKg ?? 0);
}

/**
 * Total vehicle mass on the pad: every stage fully fueled + payload [kg].
 * @param {Object} rocket
 * @param {number} payloadKg
 * @returns {number}
 */
export function liftoffMassKg(rocket, payloadKg = 0) {
  const stages = rocket?.stages ?? [];
  if (stages.length > 0) {
    return stages.reduce((sum, s) => sum + stageWetMassKg(s), 0) + (payloadKg || 0);
  }
  return (rocket?.liftoffMassKg ?? 0) + (payloadKg || 0);
}

/**
 * Thrust-to-weight ratio from raw numbers.
 *   TWR = F / (m · g₀)
 * @param {number} thrustN
 * @param {number} massKg
 * @returns {number} dimensionless; 0 if inputs are invalid
 */
export function thrustToWeightRatio(thrustN, massKg) {
  if (!(thrustN > 0) || !(massKg > 0)) return 0;
  return thrustN / (massKg * STANDARD_GRAVITY);
}

/**
 * Liftoff TWR of a rocket carrying a given payload. Only the first stage
 * produces thrust at liftoff (add `rocket.boosterThrustN` for strap-ons).
 * @param {Object} rocket
 * @param {number} payloadKg
 * @returns {number}
 */
export function calculateLiftoffTWR(rocket, payloadKg = 0) {
  const first = rocket?.stages?.[0];
  const thrust = first
    ? stageLiftoffThrustN(first) + (rocket?.boosterThrustN ?? 0)
    : (rocket?.liftoffThrustKN ?? 0) * 1000;
  return thrustToWeightRatio(thrust, liftoffMassKg(rocket, payloadKg));
}

/**
 * Validation result for the control panel.
 * @param {Object} rocket
 * @param {number} payloadKg
 * @returns {{valid:boolean, twr:number, headline:string, explain:string}}
 */
export function validateLiftoffTWR(rocket, payloadKg = 0) {
  const twr = calculateLiftoffTWR(rocket, payloadKg);

  if (!rocket || twr === 0) {
    return {
      valid: false,
      twr,
      headline: '✗ TWR unavailable.',
      explain: 'Select a rocket whose first stage has thrust data.'
    };
  }
  if (twr < MIN_LIFTOFF_TWR) {
    return {
      valid: false,
      twr,
      headline: `✗ TWR ${twr.toFixed(2)} is below 1.0.`,
      explain:
        'Thrust is less than the vehicle’s weight, so it cannot leave the ' +
        'pad. Reduce payload or pick a more powerful vehicle.'
    };
  }
  const marginal = twr < RECOMMENDED_LIFTOFF_TWR;
  return {
    valid: true,
    twr,
    headline: `✓ TWR ${twr.toFixed(2)}${marginal ? ' (marginal)' : ''}.`,
    explain: marginal
      ? 'It will lift off, but slowly; gravity losses will be high.'
      : 'Thrust comfortably exceeds weight at liftoff.'
  };
}

/**
 * Calculates a scientifically rigorous multi-stage Tsiolkovsky delta-v breakdown.
 * Evaluates mass at ignition, mass at burnout, propellant mass fraction, TWR curve,
 * and burn time for every stage from liftoff to orbit insertion.
 *
 * @param {Object} rocket
 * @param {number} [payloadKg=0]
 * @param {number} [fairingKg=0]
 * @returns {{
 *   totalIdealDeltaVMs: number,
 *   stages: Array<{
 *     name: string,
 *     type: string,
 *     ignitionMassKg: number,
 *     burnoutMassKg: number,
 *     propellantMassKg: number,
 *     effectiveIspS: number,
 *     deltaVMs: number,
 *     burnDurationSec: number,
 *     liftoffTWR: number,
 *     burnoutTWR: number,
 *     massRatio: number,
 *   }>
 * }}
 */
export function calculateMultiStageDeltaV(rocket, payloadKg = 0, fairingKg = 0) {
  const stages = rocket?.stages ?? [];
  if (!stages.length) {
    return {
      totalIdealDeltaVMs: rocket?.launcherDeltaVMs ?? 0,
      stages: [],
    };
  }

  let totalIdealDeltaVMs = 0;
  const stageBreakdown = [];

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const isFirstStage = i === 0;

    // Mass above this stage consists of all subsequent stages plus payload
    let massAboveKg = payloadKg;
    for (let j = i + 1; j < stages.length; j++) {
      massAboveKg += stageWetMassKg(stages[j]);
    }

    // Fairing is jettisoned after the first stage clears sensible atmosphere
    const fairingOnThisStageKg = isFirstStage ? fairingKg : 0;
    const ignitionMassKg = stageWetMassKg(stage) + massAboveKg + fairingOnThisStageKg;
    const burnoutMassKg = (stage.dryMassKg ?? 0) + massAboveKg + fairingOnThisStageKg;

    // Effective Isp: atmospheric weighted for booster; vacuum for upper stages
    let effectiveIspS = representativeStageIspS(stage);
    if (isFirstStage && stage.ispSeaLevelS && stage.ispVacuumS) {
      effectiveIspS = stage.ispSeaLevelS * 0.35 + stage.ispVacuumS * 0.65;
    } else if (!isFirstStage && stage.ispVacuumS) {
      effectiveIspS = stage.ispVacuumS;
    }

    const massRatio = burnoutMassKg > 0 ? ignitionMassKg / burnoutMassKg : 1;
    const stageDeltaVMs = massRatio > 1
      ? effectiveIspS * STANDARD_GRAVITY * Math.log(massRatio)
      : 0;

    const thrustN = isFirstStage
      ? stageLiftoffThrustN(stage)
      : (stage.thrustVacuumN ?? stage.thrustN ?? stageLiftoffThrustN(stage));

    const liftoffTWR = thrustToWeightRatio(thrustN, ignitionMassKg);
    const burnoutTWR = thrustToWeightRatio(thrustN, burnoutMassKg);

    const massFlowRateKgS = effectiveIspS > 0 && thrustN > 0
      ? thrustN / (effectiveIspS * STANDARD_GRAVITY)
      : 0;
    const burnDurationSec = massFlowRateKgS > 0
      ? (stage.propellantMassKg ?? 0) / massFlowRateKgS
      : (stage.burnDurationSec ?? 0);

    totalIdealDeltaVMs += stageDeltaVMs;
    stageBreakdown.push({
      name: stage.name ?? `Stage ${i + 1}`,
      type: stage.type ?? (isFirstStage ? "booster" : "upper"),
      ignitionMassKg: Math.round(ignitionMassKg),
      burnoutMassKg: Math.round(burnoutMassKg),
      propellantMassKg: stage.propellantMassKg ?? 0,
      effectiveIspS: Number(effectiveIspS.toFixed(1)),
      deltaVMs: Math.round(stageDeltaVMs),
      burnDurationSec: Number(burnDurationSec.toFixed(1)),
      liftoffTWR: Number(liftoffTWR.toFixed(2)),
      burnoutTWR: Number(burnoutTWR.toFixed(2)),
      massRatio: Number(massRatio.toFixed(3)),
    });
  }

  return {
    totalIdealDeltaVMs: Math.round(totalIdealDeltaVMs),
    stages: stageBreakdown,
  };
}

/**
 * Calculates a scientifically rigorous multi-stage Tsiolkovsky delta-v breakdown.
 * Evaluates mass at ignition, mass at burnout, propellant mass fraction, TWR curve,
 * and burn time for every stage from liftoff to orbit insertion.
 *
 * @param {Object} rocket
 * @param {number} [payloadKg=0]
 * @param {number} [fairingKg=0]
 * @returns {{
 *   totalIdealDeltaVMs: number,
 *   stages: Array<{
 *     name: string,
 *     type: string,
 *     ignitionMassKg: number,
 *     burnoutMassKg: number,
 *     propellantMassKg: number,
 *     effectiveIspS: number,
 *     deltaVMs: number,
 *     burnDurationSec: number,
 *     liftoffTWR: number,
 *     burnoutTWR: number,
 *     massRatio: number,
 *   }>
 * }}
 */

