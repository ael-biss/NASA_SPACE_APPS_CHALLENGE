/**
 * @file src/modules/game-interface/ui/ResourceHUD.js
 * @owner Member 4 (Interface & Integration)
 * @goal Persistent top status bar displaying live Mission, Budget, Total Mass, Power Balance,
 *       and Readiness Status synchronized via GameState.subscribe().
 */

import { formatBudget, formatMass } from "../../../shared/utils/formatters.js";

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

    const payloadCost = (mission?.instruments ?? []).reduce(
      (sum, i) => sum + (i.costMillions ?? 0),
      0
    );
    const scCost = spacecraft?.costMillions ?? 0;
    const launchCost = launch?.launchCostMillions ?? 0;
    const totalCost = payloadCost + scCost + launchCost;
    const budgetCap = mission?.budgetMillions ?? 0;

    const budgetRatio = budgetCap > 0 ? totalCost / budgetCap : 0;
    const budgetClass =
      budgetRatio > 1 ? "gi-bad" : budgetRatio > 0.85 ? "gi-warn" : "gi-ok";

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
          : `${spacecraft.errors.length} Error(s)`;
    const readyClass =
      spacecraft?.isValid ? "gi-ok" : spacecraft ? "gi-bad" : "gi-muted";

    this.container.innerHTML = `
      <div class="gi-hud">
        <div class="gi-hud-item">
          <span>Mission</span>
          <strong>${mission ? `${this._esc(mission.targetOrbitId)} · ${this._esc(mission.title)}` : "None"}</strong>
        </div>
        <div class="gi-hud-item">
          <span>Budget</span>
          <strong class="${budgetClass}">${mission ? `${formatBudget(totalCost)} / $${budgetCap}M` : "—"}</strong>
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
