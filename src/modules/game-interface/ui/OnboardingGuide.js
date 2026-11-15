/**
 * @file src/modules/game-interface/ui/OnboardingGuide.js
 * @owner Member 4 (Interface & Integration)
 * @goal Provides a 3-step interactive onboarding tutorial tooltip tour, a context-aware
 *       Hint popover based on the player's current phase & telemetry state, and an SFX mute toggle.
 */

import { soundFX } from "../../../shared/utils/SoundEffects.js";

export const TUTORIAL_STORAGE_KEY = "orbitCraft.tutorialSeen.v1";

export const TUTORIAL_STEPS = [
  {
    step: 1,
    phase: "mission",
    title: "1. Choose Your Mission & Science Payload",
    body: "Select a planetary target (LEO, GEO, Moon, or Mars) and toggle instruments. Watch total payload mass, downlink data rate, and mission budget.",
  },
  {
    step: 2,
    phase: "spacecraft",
    title: "2. Engineer a Flight-Ready Spacecraft",
    body: "Balance solar power vs load, battery eclipse capacity, antenna range, thermal radiators, and radiation shielding. Need a quick fix? Use Auto-Fix.",
  },
  {
    step: 3,
    phase: "launch",
    title: "3. Pick a Launch Vehicle & Fly",
    body: "Pick a rocket with payload ceiling above spacecraft mass and positive Δv margin. During flight, watch G-load, stage separations, and warp 1x/10x/100x.",
  },
];

/**
 * Generate a tailored educational engineering hint from current GameState.
 * @param {import('../../../core/GameState.js').GameState} state
 * @returns {{ title: string, message: string }}
 */
export function buildContextualHint(state) {
  const phase = state?.phase ?? "mission";
  const mission = state?.mission ?? null;
  const sc = state?.spacecraft ?? null;
  const launch = state?.launch ?? null;

  if (phase === "mission") {
    if (!mission) {
      return {
        title: "Mission Selection Hint",
        message:
          "Start with Lunar Polar Exploration (LRO-Class) or Earth LEO for an approachable target. Check target distance and budget cap before advancing.",
      };
    }
    const minSci = mission.minSciencePoints ?? 60;
    const totalSci = (mission.instruments ?? []).reduce((s, i) => s + (i.sciencePoints ?? 0), 0);
    if (totalSci < minSci) {
      return {
        title: "Science Payload Too Small",
        message: `Your selected instruments earn ${totalSci} pts, below the ${minSci} pt mission target. Add another recommended instrument before assembling your craft.`,
      };
    }
    return {
      title: "Ready for Assembly",
      message: `Your payload hits ${totalSci} science points for ${mission.targetOrbit}. Keep an eye on your $${mission.budgetMillions}M cap when picking spacecraft parts and rockets.`,
    };
  }

  if (phase === "spacecraft") {
    if (sc && Array.isArray(sc.errors) && sc.errors.length > 0) {
      return {
        title: "Spacecraft Issue Detected",
        message: `${sc.errors[0]} Tip: click Auto-Fix in the Spacecraft panel to resolve critical issues at the lowest cost delta.`,
      };
    }
    if (sc && Array.isArray(sc.warnings) && sc.warnings.length > 0) {
      return {
        title: "Spacecraft Warning",
        message: `${sc.warnings[0]} Upgrading shielding, thermal control, or avionics now prevents mid-flight failure later.`,
      };
    }
    if (sc && mission && sc.maxRangeKm < mission.targetDistanceKm) {
      return {
        title: "Communication Range Short",
        message: `Target is ${mission.targetDistanceKm.toLocaleString()} km away, while your antenna reaches ${sc.maxRangeKm.toLocaleString()} km. Upgrade to Deep-Space Dish or Ka-Band.`,
      };
    }
    return {
      title: "Spacecraft Engineering Check",
      message:
        "Ensure carried mass fits your bus limit, net solar power stays positive after orbital distance loss, and your antenna meets required downlink kbps.",
    };
  }

  if (phase === "launch") {
    if (launch && !launch.success) {
      return {
        title: "Launch Anomaly Tip",
        message:
          launch.failureFix ||
          "Upgrade to a higher-payload liquid rocket (for lower burnout G-loads and greater Δv margin) or reduce spacecraft mass.",
      };
    }
    const massText = sc ? `${Math.round(sc.totalMassKg)} kg` : "your craft";
    return {
      title: "Launcher Selection Hint",
      message: `Choose a rocket whose payload capacity exceeds ${massText} and yields positive Δv margin. Avoid high-G solid cores if your bus rating is below 8g.`,
    };
  }

  return {
    title: "Post-Flight Review Hint",
    message:
      "Review What Went Wrong & Real Mission vs Your Design, then click Retry with Fixes to adjust subsystems without losing your previous build.",
  };
}

export class OnboardingGuide {
  /**
   * @param {HTMLElement} controlsContainer Host for Hint & Mute buttons in topbar
   * @param {HTMLElement} overlayContainer Host for floating tutorial & hint popovers
   * @param {import('../../../core/GameState.js').GameState} gameState
   */
  constructor(controlsContainer, overlayContainer, gameState, options = {}) {
    this.controlsContainer = controlsContainer;
    this.overlayContainer = overlayContainer;
    this.gameState = gameState;
    this.onOpenTutorial = options.onOpenTutorial ?? null;

    this._tutorialStepIdx = 0;
    this._tutorialOpen = options.autoTutorial ?? !this._hasSeenTutorial();
    this._hintOpen = false;
    this._unsubState = null;
    this._unsubAudio = null;
    this._boundControlsClick = null;
    this._boundOverlayClick = null;
  }

  _hasSeenTutorial() {
    try {
      if (typeof globalThis.localStorage === "undefined") return false;
      return globalThis.localStorage.getItem(TUTORIAL_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }

  _markTutorialSeen() {
    try {
      if (typeof globalThis.localStorage !== "undefined") {
        globalThis.localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
      }
    } catch {
      // Ignore storage errors
    }
  }

  mount() {
    this._boundControlsClick = (e) => {
      const btn = e.target.closest("[data-guide-action]");
      if (!btn) return;
      soundFX.unlock();
      const action = btn.dataset.guideAction;
      if (action === "toggle-mute") {
        soundFX.toggleMute();
        this.render();
      } else if (action === "toggle-hint") {
        this._hintOpen = !this._hintOpen;
        this.render();
      } else if (action === "open-tutorial") {
        this._hintOpen = false;
        this.render();
        this.onOpenTutorial?.();
      }
    };
    this.controlsContainer.addEventListener("click", this._boundControlsClick);

    this._boundOverlayClick = (e) => {
      const btn = e.target.closest("[data-guide-action]");
      if (!btn) return;
      soundFX.unlock();
      const action = btn.dataset.guideAction;
      if (action === "tut-prev") {
        this._tutorialStepIdx = Math.max(0, this._tutorialStepIdx - 1);
        this.render();
      } else if (action === "tut-next") {
        if (this._tutorialStepIdx >= TUTORIAL_STEPS.length - 1) {
          this._tutorialOpen = false;
          this._markTutorialSeen();
        } else {
          this._tutorialStepIdx += 1;
        }
        this.render();
      } else if (action === "tut-dismiss") {
        this._tutorialOpen = false;
        this._markTutorialSeen();
        this.render();
      } else if (action === "open-tutorial") {
        this._hintOpen = false;
        if (this.onOpenTutorial) {
          this.render();
          this.onOpenTutorial();
        } else {
          const phaseStep = TUTORIAL_STEPS.findIndex((s) => s.phase === this.gameState.phase);
          this._tutorialStepIdx = phaseStep >= 0 ? phaseStep : 0;
          this._tutorialOpen = true;
          this.render();
        }
      } else if (action === "close-hint") {
        this._hintOpen = false;
        this.render();
      }
    };
    this.overlayContainer.addEventListener("click", this._boundOverlayClick);

    this._unsubState = this.gameState.subscribe((state) => {
      if (this._tutorialOpen) {
        const matchingIdx = TUTORIAL_STEPS.findIndex((s) => s.phase === state.phase);
        if (matchingIdx >= 0) {
          this._tutorialStepIdx = matchingIdx;
        }
      }
      if (this._tutorialOpen || this._hintOpen) {
        this.render();
      }
    });

    this._unsubAudio = soundFX.subscribe(() => this.renderControls());
    this.render();
  }

  render() {
    this.renderControls();
    this.renderOverlay();
  }

  renderControls() {
    if (!this.controlsContainer) return;
    const muted = soundFX.isMuted();
    this.controlsContainer.innerHTML = `
      <div class="gi-guide-controls">
        ${
          this.onOpenTutorial
            ? `<button
                type="button"
                class="gi-tool-btn"
                data-guide-action="open-tutorial"
                title="Replay Guided Tutorial (?)"
              >?</button>`
            : ""
        }
        <button
          type="button"
          class="gi-tool-btn ${this._hintOpen ? "active" : ""}"
          data-guide-action="toggle-hint"
          aria-expanded="${this._hintOpen ? "true" : "false"}"
          title="Contextual Engineering Hint"
        >? Hint</button>
        <button
          type="button"
          class="gi-tool-btn ${muted ? "muted" : ""}"
          data-guide-action="toggle-mute"
          aria-pressed="${muted ? "true" : "false"}"
          title="${muted ? "Unmute Sound Effects" : "Mute Sound Effects"}"
        >${muted ? "🔇 Muted" : "🔊 SFX"}</button>
      </div>
    `;
  }

  renderOverlay() {
    if (!this.overlayContainer) return;
    const step = TUTORIAL_STEPS[this._tutorialStepIdx] ?? TUTORIAL_STEPS[0];
    const hint = buildContextualHint(this.gameState);

    const tutorialHtml = this._tutorialOpen
      ? `
        <aside class="gi-tutorial-card" role="dialog" aria-label="Mission Tutorial">
          <div class="gi-tut-head">
            <span class="gi-tut-pill">QUICK GUIDE · STEP ${step.step} OF ${TUTORIAL_STEPS.length}</span>
            <button type="button" class="gi-tut-close" data-guide-action="tut-dismiss" aria-label="Skip tutorial">✕</button>
          </div>
          <h4>${this._esc(step.title)}</h4>
          <p>${this._esc(step.body)}</p>
          <div class="gi-tut-actions">
            <button type="button" class="gi-tut-btn" data-guide-action="tut-prev" ${this._tutorialStepIdx === 0 ? "disabled" : ""}>Back</button>
            <button type="button" class="gi-tut-btn" data-guide-action="tut-dismiss">Skip</button>
            <button type="button" class="gi-tut-btn gi-tut-primary" data-guide-action="tut-next">
              ${this._tutorialStepIdx >= TUTORIAL_STEPS.length - 1 ? "Got It ✓" : "Next →"}
            </button>
          </div>
        </aside>
      `
      : "";

    const hintHtml = this._hintOpen
      ? `
        <aside class="gi-hint-popover" role="status" aria-label="Engineering Hint">
          <div class="gi-tut-head">
            <span class="gi-hint-pill">MISSION CONTROL HINT</span>
            <button type="button" class="gi-tut-close" data-guide-action="close-hint" aria-label="Close hint">✕</button>
          </div>
          <h4>${this._esc(hint.title)}</h4>
          <p>${this._esc(hint.message)}</p>
          <div class="gi-tut-actions">
            <button type="button" class="gi-tut-btn" data-guide-action="open-tutorial">3-Step Tutorial</button>
            <button type="button" class="gi-tut-btn gi-tut-primary" data-guide-action="close-hint">Close</button>
          </div>
        </aside>
      `
      : "";

    this.overlayContainer.innerHTML = `${tutorialHtml}${hintHtml}`;
  }

  _esc(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  destroy() {
    this._unsubState?.();
    this._unsubAudio?.();
    if (this._boundControlsClick) {
      this.controlsContainer?.removeEventListener("click", this._boundControlsClick);
    }
    if (this._boundOverlayClick) {
      this.overlayContainer?.removeEventListener("click", this._boundOverlayClick);
    }
    if (this.controlsContainer) this.controlsContainer.innerHTML = "";
    if (this.overlayContainer) this.overlayContainer.innerHTML = "";
  }
}
