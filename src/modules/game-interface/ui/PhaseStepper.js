/**
 * @file src/modules/game-interface/ui/PhaseStepper.js
 * @owner Member 4 (Interface & Integration)
 * @goal Navigation bar allowing players to step between Mission, Spacecraft, Launch,
 *       and Results phases while showing locked/completed states.
 */

export class PhaseStepper {
  /**
   * @param {HTMLElement} container
   * @param {(phase: string) => void} onSelectPhase
   */
  constructor(container, onSelectPhase) {
    this.container = container;
    this.onSelectPhase = onSelectPhase;
  }

  /** Render phase step buttons and bind click handlers. */
  mount() {
    // TODO: Render Mission -> Spacecraft -> Launch -> Results steps
  }

  /**
   * Highlight the active phase button and update step completion styles.
   * @param {string} activePhase
   */
  setActivePhase(activePhase) {
    // TODO: Toggle active/completed CSS classes
  }

  /** Remove stepper DOM and event listeners. */
  destroy() {
    this.container.innerHTML = "";
  }
}
