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

/**
 * Single source of truth for mission cost vs budget reconciliation across all HUDs & phases.
 * @param {Object | null} mission
 * @param {Object | null} spacecraft
 * @param {Object | null} launch
 * @param {number} [pendingLaunchCostMillions=0]
 */
export function computeBudgetSummary(mission, spacecraft, launch, pendingLaunchCostMillions = 0) {
  const startingBudget = typeof mission?.budgetMillions === "number" ? mission.budgetMillions : 0;
  const instrumentsCost = (mission?.instruments ?? []).reduce(
    (sum, i) => sum + (i?.costMillions ?? 0),
    0
  );
  const spacecraftCost = typeof spacecraft?.costMillions === "number" ? spacecraft.costMillions : 0;
  const launchCost =
    typeof launch?.launchCostMillions === "number" && launch.launchCostMillions > 0
      ? launch.launchCostMillions
      : typeof pendingLaunchCostMillions === "number" && Number.isFinite(pendingLaunchCostMillions)
        ? pendingLaunchCostMillions
        : 0;
  const totalCost = instrumentsCost + spacecraftCost + launchCost;
  const budgetRemaining = startingBudget - totalCost;
  const ratio = startingBudget > 0 ? totalCost / startingBudget : 0;
  return {
    startingBudget,
    instrumentsCost,
    spacecraftCost,
    launchCost,
    totalCost,
    budgetRemaining,
    overBudget: startingBudget > 0 && budgetRemaining < 0,
    ratio,
  };
}
