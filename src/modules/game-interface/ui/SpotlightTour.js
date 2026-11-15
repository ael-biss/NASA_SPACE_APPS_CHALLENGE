/**
 * @file src/modules/game-interface/ui/SpotlightTour.js
 * @owner Member 4 (Interface & Integration)
 * @goal Vanilla JS/DOM Spotlight Tour Engine + First-Run Welcome Card.
 *       Cuts a highlighted cutout around [data-tour="id"] targets, safely skips missing targets,
 *       supports keyboard navigation + focus trapping + aria-live announcements, repositions on
 *       resize, supports action-gated steps, and never touches the Three.js render loop.
 */

import { getStrings, t } from "../../../shared/i18n/index.js";

const PAD_PX = 8;

export class SpotlightTour {
  /**
   * @param {HTMLElement} hostElement
   * @param {import('../logic/GuidanceStore.js').GuidanceStore} guidanceStore
   * @param {{ onStartTutorial?: () => void, onStepChange?: (step: Object, idx: number) => void, onFinish?: () => void, onSkip?: () => void }} [callbacks]
   */
  constructor(hostElement, guidanceStore, callbacks = {}) {
    this.host = hostElement;
    this.store = guidanceStore;
    this.callbacks = callbacks;

    this._welcomeOpen = false;
    this._active = false;
    this._waitingForPhase = false;
    this._stepIndex = 0;
    this._customSteps = null;
    this._steps = getStrings().tour?.steps ?? [];
    this._completedActions = new Set();

    this._root = null;
    this._liveRegion = null;
    this._cardEl = null;
    this._previouslyFocused = null;
    this._resizeScheduled = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onResize = this._onResize.bind(this);
    this._onCardClick = this._onCardClick.bind(this);
  }

  isActive() {
    return this._active;
  }

  isWelcomeOpen() {
    return this._welcomeOpen;
  }

  /** Set custom step list (defaults to active locale tour steps). */
  setSteps(steps) {
    if (Array.isArray(steps) && steps.length > 0) {
      this._customSteps = steps;
      this._steps = steps;
    }
  }

  /** Show the first-run welcome card ("New to space engineering? Take the 2-minute guided tour"). */
  showWelcome() {
    this.stop({ silent: true });
    this.store?.markWelcomeSeen();
    this._welcomeOpen = true;
    this._ensureRoot();
    this._attachGlobalListeners();
    this._renderWelcome();
  }

  replay() {
    this.store?.resetForReplay();
    return this.start(0);
  }

  /** Start or resume the spotlight tour at `startIndex`. */
  start(startIndex = 0) {
    this._welcomeOpen = false;
    this._waitingForPhase = false;
    this._steps = this._customSteps ?? getStrings().tour?.steps ?? this._steps;
    this._completedActions.clear();
    this._previouslyFocused =
      typeof document !== "undefined" ? document.activeElement : null;

    this._active = true;
    this._ensureRoot();
    this._attachGlobalListeners();

    const startStep = this._steps[startIndex];
    if (startStep) {
      this.callbacks.onPrepareStep?.(startStep);
    }

    const resolvedIdx = this._findNextReachableIndex(
      startIndex,
      1,
      startStep?.phase ?? null,
      true
    );
    if (resolvedIdx < 0) {
      this.stop({ silent: true, reason: "no-targets" });
      return false;
    }

    this._stepIndex = resolvedIdx;
    this.store?.setStepIndex(resolvedIdx);
    this._renderStep();
    return true;
  }

  /** Advance or resume when entering a new phase whose targets just mounted. */
  syncPhase(phase) {
    if (!this._active) return false;
    const currentStep = this._steps[this._stepIndex];
    if (!this._waitingForPhase && currentStep?.phase === phase) {
      return false;
    }
    const targetIdx = this._steps.findIndex((s) => s.phase === phase);
    if (targetIdx < 0) return false;
    this.callbacks.onPrepareStep?.(this._steps[targetIdx]);
    const reachable = this._findNextReachableIndex(targetIdx, 1, phase, true);
    if (reachable < 0) return false;
    this._waitingForPhase = false;
    this._stepIndex = reachable;
    this.store?.setStepIndex(reachable);
    this._renderStep();
    return true;
  }

  /** Mark a user action (e.g. "select-bus", "select-rocket") completed so gated step unlocks. */
  markActionCompleted(actionId) {
    if (!actionId) return;
    this._completedActions.add(actionId);
    if (this._active && !this._waitingForPhase) {
      const step = this._steps[this._stepIndex];
      if (step?.actionRequired === actionId) {
        this._renderStep();
      }
    }
  }

  nextStep() {
    if (!this._active || this._waitingForPhase) return false;
    const cur = this._steps[this._stepIndex];
    if (cur?.actionRequired && !this._completedActions.has(cur.actionRequired)) {
      return false;
    }

    const nextIdx = this._findNextReachableIndex(
      this._stepIndex + 1,
      1,
      cur?.phase ?? null,
      true
    );
    if (nextIdx >= 0) {
      this._stepIndex = nextIdx;
      this.store?.setStepIndex(nextIdx);
      this._renderStep();
      return true;
    }

    // If there are still upcoming phases in the tour, wait without blocking the UI
    if (this._hasLaterPhaseSteps(this._stepIndex)) {
      this._waitingForPhase = true;
      if (this._root) this._root.innerHTML = "";
      return true;
    }

    this.finish();
    return true;
  }

  prevStep() {
    if (!this._active || this._waitingForPhase) return false;
    const cur = this._steps[this._stepIndex];
    const prevIdx = this._findNextReachableIndex(
      this._stepIndex - 1,
      -1,
      cur?.phase ?? null,
      true
    );
    if (prevIdx < 0) return false;
    this._stepIndex = prevIdx;
    this.store?.setStepIndex(prevIdx);
    this._renderStep();
    return true;
  }

  finish() {
    this.store?.markCompleted();
    this.stop({ silent: true });
    this.callbacks.onFinish?.();
  }

  skip() {
    this.store?.markDismissed();
    this.stop({ silent: true });
    this.callbacks.onSkip?.();
  }

  stop({ silent = false } = {}) {
    this._active = false;
    this._waitingForPhase = false;
    this._welcomeOpen = false;
    this._detachGlobalListeners();
    if (this._root) {
      this._root.innerHTML = "";
    }
    if (this._previouslyFocused && typeof this._previouslyFocused.focus === "function") {
      try {
        this._previouslyFocused.focus();
      } catch {
        // Element may have unmounted
      }
    }
    this._previouslyFocused = null;
    if (!silent) {
      this.callbacks.onSkip?.();
    }
  }

  destroy() {
    this.stop({ silent: true });
    if (this._root && this._root.parentNode) {
      this._root.parentNode.removeChild(this._root);
    }
    this._root = null;
    this._liveRegion = null;
    this._cardEl = null;
  }

  _ensureRoot() {
    if (!this._root) {
      this._root = document.createElement("div");
      this._root.className = "oc-tour-root";
      this._root.addEventListener("click", this._onCardClick);

      this._liveRegion = document.createElement("div");
      this._liveRegion.className = "oc-sr-only";
      this._liveRegion.setAttribute("aria-live", "polite");
      this._liveRegion.setAttribute("aria-atomic", "true");
      this.host.appendChild(this._root);
      this.host.appendChild(this._liveRegion);
    }
  }

  _findTargetElement(step) {
    if (!step?.id || typeof document === "undefined") return null;
    const el = document.querySelector?.(`[data-tour="${step.id}"]`) ?? null;
    if (!el) return null;
    if (typeof el.getBoundingClientRect === "function") {
      const rect = el.getBoundingClientRect();
      if (rect && rect.width === 0 && rect.height === 0) return null;
    }
    return el;
  }

  _hasLaterPhaseSteps(index) {
    const curPhase = this._steps[index]?.phase;
    for (let i = index + 1; i < this._steps.length; i++) {
      if (this._steps[i].phase && this._steps[i].phase !== curPhase) {
        return true;
      }
    }
    return false;
  }

  _findNextReachableIndex(
    startIndex,
    dir = 1,
    restrictPhase = null,
    allowPrepare = false
  ) {
    let i = startIndex;
    while (i >= 0 && i < this._steps.length) {
      const step = this._steps[i];
      if (restrictPhase && step.phase !== restrictPhase) return -1;
      if (allowPrepare) {
        this.callbacks.onPrepareStep?.(step);
      }
      if (this._findTargetElement(step)) {
        return i;
      }
      i += dir;
    }
    return -1;
  }

  _renderWelcome() {
    const s = getStrings().welcome;
    this._root.innerHTML = `
      <div class="oc-tour-welcome-backdrop">
        <section class="oc-tour-welcome" role="dialog" aria-modal="true" aria-label="${this._esc(s.title)}">
          <span class="oc-tour-badge">${this._esc(s.badge)}</span>
          <h3>${this._esc(s.title)}</h3>
          <p>${this._esc(s.body)}</p>
          <div class="oc-tour-welcome-actions">
            <button type="button" class="oc-tour-btn oc-tour-btn-primary" data-tour-action="start-tour">${this._esc(s.startBtn)}</button>
            <button type="button" class="oc-tour-btn" data-tour-action="skip-welcome">${this._esc(s.skipBtn)}</button>
            <button type="button" class="oc-tour-btn oc-tour-btn-ghost" data-tour-action="dismiss-welcome">${this._esc(s.dismissBtn)}</button>
          </div>
        </section>
      </div>
    `;
    const primary = this._root.querySelector('[data-tour-action="start-tour"]');
    primary?.focus?.();
  }

  _renderStep() {
    if (!this._active) return;
    const step = this._steps[this._stepIndex];
    const targetEl = this._findTargetElement(step);
    if (!targetEl) {
      const fallback = this._findNextReachableIndex(
        this._stepIndex + 1,
        1,
        step?.phase ?? null,
        true
      );
      if (fallback >= 0) {
        this._stepIndex = fallback;
        this._renderStep();
      } else if (this._hasLaterPhaseSteps(this._stepIndex)) {
        this._waitingForPhase = true;
        if (this._root) this._root.innerHTML = "";
      } else {
        this.stop({ silent: true });
      }
      return;
    }

    const sTour = getStrings().tour;
    const total = this._steps.length;
    const current = this._stepIndex + 1;
    const hasPrev =
      this._findNextReachableIndex(this._stepIndex - 1, -1, step.phase ?? null, false) >= 0;
    const hasNextInPhase =
      this._findNextReachableIndex(this._stepIndex + 1, 1, step.phase ?? null, false) >= 0;
    const hasLaterPhases = this._hasLaterPhaseSteps(this._stepIndex);
    const actionBlocked =
      Boolean(step.actionRequired) && !this._completedActions.has(step.actionRequired);

    const rect = this._getSafeRect(targetEl);
    const vpW = globalThis.innerWidth || 1280;
    const vpH = globalThis.innerHeight || 800;

    const topH = Math.max(0, rect.top - PAD_PX);
    const leftW = Math.max(0, rect.left - PAD_PX);
    const holeW = Math.max(0, rect.width + PAD_PX * 2);
    const holeH = Math.max(0, rect.height + PAD_PX * 2);
    const rightL = leftW + holeW;
    const rightW = Math.max(0, vpW - rightL);
    const bottomT = topH + holeH;
    const bottomH = Math.max(0, vpH - bottomT);

    const counterLabel = t("tour.stepCounter", { current, total });
    const isLast = !hasNextInPhase && !hasLaterPhases;

    this._root.innerHTML = `
      <div class="oc-tour-dim" style="top:0;left:0;width:100%;height:${topH}px"></div>
      <div class="oc-tour-dim" style="top:${bottomT}px;left:0;width:100%;height:${bottomH}px"></div>
      <div class="oc-tour-dim" style="top:${topH}px;left:0;width:${leftW}px;height:${holeH}px"></div>
      <div class="oc-tour-dim" style="top:${topH}px;left:${rightL}px;width:${rightW}px;height:${holeH}px"></div>
      <div class="oc-tour-ring" style="top:${topH}px;left:${leftW}px;width:${holeW}px;height:${holeH}px"></div>

      <section
        class="oc-tour-card"
        role="dialog"
        aria-modal="true"
        aria-label="${this._esc(sTour.ariaRegionLabel)}"
      >
        <div class="oc-tour-card-head">
          <span class="oc-tour-counter">${this._esc(counterLabel)}</span>
          <button type="button" class="oc-tour-btn oc-tour-btn-ghost" data-tour-action="skip-tour">${this._esc(sTour.skipBtn)}</button>
        </div>
        <h4 class="oc-tour-title">${this._esc(step.title)}</h4>
        <p class="oc-tour-body">${this._esc(step.body)}</p>
        ${
          actionBlocked
            ? `<div class="oc-tour-action-req">${this._esc(sTour.actionRequiredNotice)}</div>`
            : ""
        }
        <div class="oc-tour-actions">
          <button type="button" class="oc-tour-btn" data-tour-action="prev-step" ${hasPrev ? "" : "disabled"}>${this._esc(sTour.backBtn)}</button>
          <button type="button" class="oc-tour-btn oc-tour-btn-primary" data-tour-action="next-step" ${actionBlocked ? "disabled" : ""}>
            ${this._esc(isLast ? sTour.finishBtn : sTour.nextBtn)}
          </button>
        </div>
      </section>
    `;

    this._cardEl = this._root.querySelector(".oc-tour-card");
    this._positionCard(rect, vpW, vpH);

    if (this._liveRegion) {
      this._liveRegion.textContent = t("tour.announcement", {
        current,
        total,
        title: step.title,
        body: step.body,
      });
    }

    const focusTarget =
      this._root.querySelector('[data-tour-action="next-step"]:not([disabled])') ||
      this._root.querySelector('[data-tour-action="prev-step"]:not([disabled])') ||
      this._root.querySelector('[data-tour-action="skip-tour"]');
    focusTarget?.focus?.();

    this.callbacks.onStepChange?.(step, this._stepIndex);
  }

  _getSafeRect(el) {
    const r = el.getBoundingClientRect?.() ?? {
      top: 80,
      left: 80,
      right: 320,
      bottom: 200,
      width: 240,
      height: 120,
    };
    return {
      top: r.top ?? 0,
      left: r.left ?? 0,
      width: r.width ?? Math.max(0, (r.right ?? 240) - (r.left ?? 0)),
      height: r.height ?? Math.max(0, (r.bottom ?? 120) - (r.top ?? 0)),
    };
  }

  _positionCard(rect, vpW, vpH) {
    if (!this._cardEl) return;
    if (vpW <= 760) {
      this._cardEl.classList.add("oc-tour-card-mobile");
      this._cardEl.style.top = "";
      this._cardEl.style.left = "";
      return;
    }
    this._cardEl.classList.remove("oc-tour-card-mobile");
    const cardW = 340;
    const cardH = 220;
    const isRtl =
      typeof document !== "undefined" && document.documentElement?.dir === "rtl";

    let left;
    if (isRtl) {
      const tryLeft = rect.left - cardW - 18;
      left = tryLeft >= 14 ? tryLeft : Math.min(vpW - cardW - 14, rect.left + rect.width + 18);
    } else {
      const tryRight = rect.left + rect.width + 18;
      left =
        tryRight + cardW <= vpW - 14
          ? tryRight
          : Math.max(14, rect.left - cardW - 18);
    }

    if (left < 14 || left + cardW > vpW - 14) {
      left = Math.max(14, Math.min(vpW - cardW - 14, rect.left));
    }

    let top = rect.top;
    if (top + cardH > vpH - 14) {
      top = Math.max(14, vpH - cardH - 14);
    }
    if (top < 64) {
      top = Math.min(vpH - cardH - 14, Math.max(64, rect.top + rect.height + 14));
    }

    this._cardEl.style.left = `${Math.round(left)}px`;
    this._cardEl.style.top = `${Math.round(top)}px`;
  }

  _onCardClick(e) {
    const btn = e.target.closest("[data-tour-action]");
    if (!btn || btn.disabled) return;
    const action = btn.dataset.tourAction;
    if (action === "start-tour") {
      this._welcomeOpen = false;
      this.store?.markWelcomeSeen();
      this.callbacks.onStartTutorial?.();
    } else if (action === "skip-welcome") {
      this.store?.markWelcomeSeen();
      this.stop({ silent: true });
      this.callbacks.onSkip?.();
    } else if (action === "dismiss-welcome") {
      this.skip();
    } else if (action === "next-step") {
      this.nextStep();
    } else if (action === "prev-step") {
      this.prevStep();
    } else if (action === "skip-tour") {
      this.skip();
    }
  }

  _onKeyDown(e) {
    if (!this._active && !this._welcomeOpen) return;

    if (e.key === "Escape") {
      e.preventDefault();
      if (this._welcomeOpen) {
        this.store?.markWelcomeSeen();
        this.stop({ silent: true });
        this.callbacks.onSkip?.();
      } else {
        this.skip();
      }
      return;
    }

    if (this._active && !this._waitingForPhase) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        this.nextStep();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        this.prevStep();
        return;
      }
      if (e.key === "Enter" && !e.target?.closest?.("[data-tour-action]")) {
        e.preventDefault();
        this.nextStep();
        return;
      }
    }

    // Focus trap inside active dialog
    if (e.key === "Tab" && this._root) {
      const dialog = this._root.querySelector('[role="dialog"]');
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll('button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  _onResize() {
    if (!this._active || this._resizeScheduled) return;
    this._resizeScheduled = true;
    const raf = globalThis.requestAnimationFrame ?? ((fn) => setTimeout(fn, 16));
    raf(() => {
      this._resizeScheduled = false;
      if (this._active) this._renderStep();
    });
  }

  _attachGlobalListeners() {
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this._onKeyDown);
      window.addEventListener("resize", this._onResize, { passive: true });
    }
  }

  _detachGlobalListeners() {
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", this._onKeyDown);
      window.removeEventListener("resize", this._onResize);
    }
  }

  _esc(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
}
