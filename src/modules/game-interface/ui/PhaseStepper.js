/**
 * @file src/modules/game-interface/ui/PhaseStepper.js
 * @owner Member 4 (Interface & Integration)
 * @goal Navigation bar allowing players to step between Mission, Spacecraft, Launch,
 *       and Results phases while showing locked/completed/active states.
 */

const STEPS = [
  { id: "mission", num: "1", label: "Mission" },
  { id: "spacecraft", num: "2", label: "Spacecraft" },
  { id: "launch", num: "3", label: "Launch & Orbit" },
  { id: "results", num: "4", label: "Results" },
];

export class PhaseStepper {
  /**
   * @param {HTMLElement} container
   * @param {(phase: string) => void} onSelectPhase
   * @param {(phase: string) => boolean} [canEnterPhase]
   */
  constructor(container, onSelectPhase, canEnterPhase = () => true) {
    this.container = container;
    this.onSelectPhase = onSelectPhase;
    this.canEnterPhase = canEnterPhase;
    this._activePhase = "mission";
  }

  /** Render phase step buttons and bind click handlers. */
  mount() {
    this.container.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-phase]");
      if (!btn || btn.disabled) return;
      this.onSelectPhase?.(btn.dataset.phase);
    });
    this.setActivePhase(this._activePhase);
  }

  /**
   * Highlight the active phase button and update step completion/lock styles.
   * @param {string} activePhase
   */
  setActivePhase(activePhase) {
    this._activePhase = activePhase;
    const activeIdx = STEPS.findIndex((s) => s.id === activePhase);

    this.container.innerHTML = `
      <nav class="gi-stepper" aria-label="Mission phases">
        ${STEPS.map((step, idx) => {
          const isActive = step.id === activePhase;
          const allowed = this.canEnterPhase(step.id);
          const isCompleted = idx < activeIdx && allowed;
          return `
            <button
              type="button"
              class="gi-step ${isActive ? "gi-step-active" : ""} ${isCompleted ? "gi-step-done" : ""}"
              data-phase="${step.id}"
              ${allowed || isActive ? "" : "disabled"}
            >
              <span class="gi-step-num">${isCompleted ? "✓" : step.num}</span>
              <span class="gi-step-label">${step.label}</span>
            </button>
          `;
        }).join("")}
      </nav>
    `;
  }

  /** Remove stepper DOM and event listeners. */
  destroy() {
    this.container.innerHTML = "";
  }
}
