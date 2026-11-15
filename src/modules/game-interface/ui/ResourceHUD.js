/**
 * @file src/modules/game-interface/ui/ResourceHUD.js
 * @owner Member 4 (Interface & Integration)
 * @goal Persistent top status bar displaying live Mission, Budget, Total Mass, Power Balance,
 *       and Readiness Status synchronized via GameState.subscribe().
 */

import { computeBudgetSummary, formatBudget, formatMass } from "../../../shared/utils/formatters.js";

export class ResourceHUD {
  /**
   * @param {HTMLElement} container
   * @param {import('../../../core/GameState.js').GameState} gameState
   */
  constructor(container, gameState) {
    this.container = container;
    this.gameState = gameState;
    this._unsubscribe = null;
  }

  /** Render the HUD bar and subscribe to GameState updates. */
  mount() {
    this._unsubscribe = this.gameState.subscribe((state) => this.update(state));
    this.update(this.gameState);
  }

  /**
   * Refresh displayed mission, budget, mass, power, and readiness indicators.
   * @param {import('../../../core/GameState.js').GameState} state
   */
  update(state) {
    const mission = state.mission;
    const spacecraft = state.spacecraft;
    const launch = state.launch;

    const budget = computeBudgetSummary(
      mission,
      spacecraft,
      launch,
      state.pendingLaunchCostMillions ?? 0
    );
    const budgetClass =
      budget.ratio > 1 ? "gi-bad" : budget.ratio > 0.85 ? "gi-warn" : "gi-ok";
    const budgetText = !mission
      ? "—"
      : budget.budgetRemaining < 0
        ? `-$${Math.abs(budget.budgetRemaining).toFixed(1)}M over ($${budget.totalCost.toFixed(1)}M / $${budget.startingBudget}M)`
        : `${formatBudget(budget.budgetRemaining)} left ($${budget.totalCost.toFixed(1)}M / $${budget.startingBudget}M)`;
    const budgetTitle = mission
      ? `Starting Budget: $${budget.startingBudget}M · Instruments: $${budget.instrumentsCost.toFixed(1)}M · Spacecraft: $${budget.spacecraftCost.toFixed(1)}M · Launch: $${budget.launchCost.toFixed(1)}M · Total Spent: $${budget.totalCost.toFixed(1)}M`
      : "";

    const totalMass = spacecraft?.totalMassKg ?? 0;
    const powerMargin = spacecraft
      ? spacecraft.powerGeneratedWatts - spacecraft.powerConsumedWatts
      : null;
    const powerClass =
      powerMargin === null ? "" : powerMargin < 0 ? "gi-bad" : "gi-ok";

    const readyText = !mission
      ? "Select Mission"
      : !spacecraft
        ? "Build Craft"
        : spacecraft.isValid
          ? "Flight Ready"
          : `${spacecraft.errors.length} Issue${spacecraft.errors.length === 1 ? "" : "s"}`;
    const readyClass =
      spacecraft?.isValid ? "gi-ok" : spacecraft ? "gi-bad" : "gi-muted";

    this.container.innerHTML = `
      <div class="gi-hud" data-tour="topbar-hud">
        <div class="gi-hud-item">
          <span>Mission</span>
          <strong>${mission ? `${this._esc(mission.targetOrbitId)} · ${this._esc(mission.title)}` : "None"}</strong>
        </div>
        <div class="gi-hud-item" title="${this._esc(budgetTitle)}">
          <span>Budget</span>
          <strong class="${budgetClass}">${budgetText}</strong>
        </div>
        <div class="gi-hud-item">
          <span>Mass</span>
          <strong>${spacecraft ? formatMass(totalMass) : "—"}</strong>
        </div>
        <div class="gi-hud-item">
          <span>Power</span>
          <strong class="${powerClass}">${powerMargin === null ? "—" : `${powerMargin >= 0 ? "+" : ""}${Math.round(powerMargin)} W`}</strong>
        </div>
        <div class="gi-hud-item">
          <span>Status</span>
          <strong class="${readyClass}">${readyText}</strong>
        </div>
      </div>
    `;
  }

  _esc(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  /** Unsubscribe from GameState and clear HUD DOM. */
  destroy() {
    this._unsubscribe?.();
    this.container.innerHTML = "";
  }
}
