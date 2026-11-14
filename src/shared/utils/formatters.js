/**
 * @file src/shared/utils/formatters.js
 * @owner Shared (All 4 members)
 * @goal Formatting helpers for engineering units (mass, power, delta-v, budget)
 *       displayed across HUDs, configurators, and evaluation reports.
 */

/** @param {number} kg */
export function formatMass(kg) {
  return `${Math.round(kg)} kg`;
}

/** @param {number} watts */
export function formatPower(watts) {
  return `${Math.round(watts)} W`;
}

/** @param {number} millions */
export function formatBudget(millions) {
  return `$${millions.toFixed(1)}M`;
}

/** @param {number} ms */
export function formatDeltaV(ms) {
  return `${Math.round(ms)} m/s`;
}
