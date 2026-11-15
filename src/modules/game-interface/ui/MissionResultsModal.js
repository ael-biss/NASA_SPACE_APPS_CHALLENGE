/**
 * @file src/modules/game-interface/ui/MissionResultsModal.js
 * @owner Member 4 (Interface & Integration)
 * @goal End-of-mission summary modal presenting the MissionEvaluator grade, phase-by-phase
 *       flight timeline, root-cause failure diagnosis & fix, subsystem health bars, and actions.
 */

const HEALTH_LABELS = {
  structure: "Structure",
  solarPanels: "Solar Panels",
  batteries: "Batteries",
  propulsion: "Propulsion",
  antenna: "Antenna",
  avionics: "Avionics",
  thermal: "Thermal",
  payload: "Payload",
};

export class MissionResultsModal {
  /** @param {HTMLElement} container */
  constructor(container) {
    this.container = container;
  }

  /**
   * Display final mission score, flight timeline, failure report, health bars, and actions.
   * @param {{ score: number, grade: string, summary: string, checks: Array<Object> }} evaluationResult
   * @param {import('../../../shared/interfaces/LaunchResult.js').LaunchResult | null} launchResult
   * @param {{ onModifyDesign: () => void, onReplayLaunch?: () => void, onNewMission: () => void }} actions
   */
  show(evaluationResult, launchResult, actions) {
    const allChecksPassed =
      !Array.isArray(evaluationResult.checks) ||
      evaluationResult.checks.length === 0 ||
      evaluationResult.checks.every((c) => c.passed);
    const passed = Boolean(launchResult?.success) && evaluationResult.score >= 70 && allChecksPassed;
    const failedPhase = launchResult?.phases?.find((p) => p.status === "failed");

    const failureReportHtml =
      launchResult && !launchResult.success
        ? `
        <section class="gi-failure-box">
          <div class="gi-failure-title">
            MISSION LOST AT: ${this._esc(failedPhase?.name ?? launchResult.failedPhaseId ?? "LAUNCH")}
          </div>
          <p><strong>Cause:</strong> ${this._esc(launchResult.failureCause || launchResult.failureReason)}</p>
          <p class="gi-fix"><strong>Fix:</strong> ${this._esc(launchResult.failureFix || "Review spacecraft engineering warnings and launch vehicle capacity.")}</p>
        </section>
      `
        : "";

    const timelineHtml = (launchResult?.phases ?? [])
      .map((p) => {
        const icon = p.status === "passed" ? "✓" : p.status === "failed" ? "✕" : "—";
        return `
          <div class="gi-tl-item gi-tl-${p.status}">
            <span class="gi-tl-icon">${icon}</span>
            <div class="gi-tl-body">
              <strong>${this._esc(p.name)}</strong>
              <span>${this._esc(p.summary || "")}</span>
            </div>
          </div>
        `;
      })
      .join("");

    const healthEntries = Object.entries(launchResult?.componentHealth ?? {});
    const healthHtml = healthEntries
      .map(([key, pct]) => {
        const cls = pct >= 70 ? "gi-bar-ok" : pct >= 35 ? "gi-bar-warn" : "gi-bar-bad";
        return `
          <div class="gi-health-row">
            <div class="gi-health-label">
              <span>${HEALTH_LABELS[key] ?? key}</span>
              <strong>${pct}%</strong>
            </div>
            <div class="gi-health-track">
              <div class="gi-health-fill ${cls}" style="width:${Math.max(0, Math.min(100, pct))}%"></div>
            </div>
          </div>
        `;
      })
      .join("");

    const checksHtml = (evaluationResult?.checks ?? [])
      .map(
        (c) => `
        <div class="gi-check ${c.passed ? "gi-check-pass" : "gi-check-fail"}">
          <strong>${c.passed ? "✓" : "✕"} ${this._esc(c.label)}</strong>
          <span>${this._esc(c.detail)}</span>
        </div>
      `
      )
      .join("");

    this.container.innerHTML = `
      <div class="gi-modal-backdrop">
        <article class="gi-modal" role="dialog" aria-modal="true">
          <header class="gi-modal-header">
            <div>
              <span class="gi-modal-badge">${launchResult?.success ? "FLIGHT COMPLETE" : "FLIGHT TERMINATED"}</span>
              <h2>${passed ? "Mission Accomplished" : launchResult?.success ? "Mission Completed (With Issues)" : "Mission Failure Report"}</h2>
              <p class="gi-modal-sub">${this._esc(evaluationResult.summary)}</p>
            </div>
            <div class="gi-grade-box ${passed ? "gi-grade-pass" : "gi-grade-fail"}">
              <span class="gi-grade">${this._esc(evaluationResult.grade)}</span>
              <small>${evaluationResult.score}/100</small>
            </div>
          </header>

          ${failureReportHtml}

          <div class="gi-modal-grid">
            <section class="gi-modal-col">
              <h3>Flight Timeline</h3>
              <div class="gi-tl-list">${timelineHtml}</div>
            </section>
            <section class="gi-modal-col">
              <h3>Subsystem Health</h3>
              <div class="gi-health-list">${healthHtml}</div>
              <h3 style="margin-top:12px;">Mission Requirements</h3>
              <div class="gi-check-list">${checksHtml}</div>
            </section>
          </div>

          <footer class="gi-modal-actions">
            <button type="button" class="gi-btn gi-btn-primary" data-modal-action="modify">Modify Spacecraft</button>
            <button type="button" class="gi-btn" data-modal-action="replay">Change Rocket / Replay</button>
            <button type="button" class="gi-btn" data-modal-action="new">New Mission</button>
          </footer>
        </article>
      </div>
    `;

    this.container.querySelector('[data-modal-action="modify"]')?.addEventListener("click", () => {
      actions?.onModifyDesign?.();
    });
    this.container.querySelector('[data-modal-action="replay"]')?.addEventListener("click", () => {
      actions?.onReplayLaunch?.();
    });
    this.container.querySelector('[data-modal-action="new"]')?.addEventListener("click", () => {
      actions?.onNewMission?.();
    });
  }

  /** Hide and clear the modal. */
  hide() {
    this.container.innerHTML = "";
  }

  _esc(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
}
