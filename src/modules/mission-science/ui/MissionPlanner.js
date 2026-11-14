/**
 * @file src/modules/mission-science/ui/MissionPlanner.js
 * @owner Member 1 (Mission & Science)
 * @goal Interactive UI panel allowing players to choose a mission objective and select
 *       scientific payload instruments while seeing budget, mass, and science trade-offs.
 */

export class MissionPlanner {
  /**
   * @param {HTMLElement} container
   * @param {import('../../../core/GameState.js').GameState} gameState
   */
  constructor(container, gameState) {
    this.container = container;
    this.gameState = gameState;
  }

  /** Build DOM controls and bind mission/instrument selection handlers. */
  mount() {
    // TODO: Render mission cards, instrument checkboxes, and update gameState.setMission(...)
  }

  /** Re-render current selection summary. */
  render() {
    // TODO: Update DOM with selected mission constraints and instrument totals
  }

  /** Remove DOM nodes and event listeners when leaving the Mission phase. */
  destroy() {
    this.container.innerHTML = "";
  }
}
