/**
 * @file src/modules/game-interface/ui/ResourceHUD.js
 * @owner Member 4 (Interface & Integration)
 * @goal Persistent top status bar displaying live Budget, Total Mass, Power Balance,
 *       and Readiness Status synchronized via GameState.subscribe().
 */

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
   * Refresh displayed budget, mass, power, and readiness indicators.
   * @param {import('../../../core/GameState.js').GameState} state
   */
  update(state) {
    // TODO: Format and display mission budget vs spent, spacecraft mass, and power margin
  }

  /** Unsubscribe from GameState and clear HUD DOM. */
  destroy() {
    this._unsubscribe?.();
    this.container.innerHTML = "";
  }
}
