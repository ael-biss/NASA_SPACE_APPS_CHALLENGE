/**
 * @file src/modules/launch-orbit/ui/LaunchControlPanel.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Launch control UI panel for selecting a launch vehicle & fairing, reviewing mass/delta-v
 *       margins, triggering the 3D phase-by-phase launch, and watching the live flight timeline.
 */

import { PHYSICS } from "../../../shared/data/constants.js";
import { DEFAULT_LAUNCH_SITE_ID, getLaunchSiteById } from "../data/launchSites.js";
import { getFairings, getRockets } from "../data/rockets.js";
import { getOrbitById } from "../data/orbits.js";
import { OrbitMechanics } from "../logic/OrbitMechanics.js";

const STYLE_ELEMENT_ID = "launch-control-panel-styles";

export class LaunchControlPanel {
  /**
   * @param {HTMLElement} container
   * @param {import('../../../core/GameState.js').GameState} gameState
   * @param {{
   *   onSelectRocket?: (rocketId: string) => void,
   *   onLaunch: (rocketId: string, orbitId: string, fairingId: string) => void,
   *   onSpeedChange?: (speed: number) => void,
   *   onViewResults?: () => void,
   *   onReplay?: () => void,
   * }} handlersOrCallback
   */
  constructor(container, gameState, handlersOrCallback) {
    this.container = container;
    this.gameState = gameState;
    this.handlers =
      typeof handlersOrCallback === "function"
        ? { onLaunch: handlersOrCallback }
        : handlersOrCallback ?? {};

    this._mechanics = new OrbitMechanics();
    this._rockets = getRockets();
    this._fairings = getFairings();
    this._selectedRocketId = gameState.launch?.rocketId || "heavy-lift";
    this._selectedFairingId = gameState.launch?.fairingId || "standard-fairing";
    this._speed = 1;
    this._flightActive = false;
    this._flightComplete = false;
    this._lastResult = null;
    this._activePhaseIndex = -1;
    this._root = null;
  }

  /** Render rocket selector, fairing selector, target orbit summary, and Launch button. */
  mount() {
    this._ensureStyles();
    this._autoPickSensibleRocket();

    this._root = document.createElement("div");
    this._root.className = "lo-shell";
    this.container.appendChild(this._root);

    this._root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action], [data-rocket-id], [data-fairing-id]");
      if (!btn) return;

      if (btn.dataset.rocketId && !this._flightActive) {
        this._selectedRocketId = btn.dataset.rocketId;
        this._flightComplete = false;
        this._lastResult = null;
        this.handlers.onSelectRocket?.(this._selectedRocketId);
        this.render();
        return;
      }

      if (btn.dataset.fairingId && !this._flightActive) {
        this._selectedFairingId = btn.dataset.fairingId;
        this._flightComplete = false;
        this._lastResult = null;
        this.render();
        return;
      }

      const action = btn.dataset.action;
      if (action === "launch") {
        const orbitId = this.gameState.mission?.targetOrbitId || "LUNAR";
        this._flightActive = true;
        this._flightComplete = false;
        this._activePhaseIndex = 0;
        this.handlers.onLaunch?.(this._selectedRocketId, orbitId, this._selectedFairingId);
      } else if (action === "toggle-speed") {
        this._speed = this._speed === 1 ? 2 : this._speed === 2 ? 4 : 1;
        this.handlers.onSpeedChange?.(this._speed);
        this.render();
      } else if (action === "view-results") {
        this.handlers.onViewResults?.();
      } else if (action === "replay") {
        this._flightActive = true;
        this._flightComplete = false;
        this._activePhaseIndex = 0;
        this.handlers.onReplay?.();
      }
    });

    this.render();
  }

  setFlightState(launchResult) {
    this._lastResult = launchResult;
    this._flightActive = true;
    this._flightComplete = false;
    this._activePhaseIndex = 0;
    this.render();
  }

  markFlightComplete(launchResult) {
    this._lastResult = launchResult;
    this._flightActive = false;
    this._flightComplete = true;
    this.render();
  }

  /**
   * Update live telemetry & phase timeline during flight animation.
   * @param {{ phaseIndex?: number, phase?: Object, altitudeKm?: number, velocityKms?: number, failed?: boolean }} telemetry
   */
  updateTelemetry(telemetry) {
    if (!this._root) return;
    if (typeof telemetry.phaseIndex === "number") {
      this._activePhaseIndex = telemetry.phaseIndex;
    }

    const timelineEl = this._root.querySelector('[data-role="timeline"]');
    if (timelineEl && this._lastResult?.phases) {
      timelineEl.innerHTML = this._renderTimelineItems(
        this._lastResult.phases,
        this._activePhaseIndex,
        this._flightComplete
      );
    }

    const telemEl = this._root.querySelector('[data-role="live-telem"]');
    if (telemEl) {
      const alt = telemetry.altitudeKm ?? 0;
      const vel = telemetry.velocityKms ?? 0;
      const stageName = telemetry.phase?.name ?? "Ascending";
      const statusBadge = telemetry.failed
        ? `<span class="lo-status-err">ANOMALY / FAILURE</span>`
        : this._flightComplete && this._lastResult?.success
          ? `<span class="lo-status-ok">ORBIT CAPTURED</span>`
          : `<span class="lo-status-run">FLIGHT IN PROGRESS</span>`;

      telemEl.innerHTML = `
        <div class="lo-telem-head">${statusBadge}<span>${this._escape(stageName)}</span></div>
        <div class="lo-telem-grid">
          <div><span>Altitude</span><strong>${alt.toLocaleString()} km</strong></div>
          <div><span>Velocity</span><strong>${vel} km/s</strong></div>
          <div><span>Sim Speed</span><strong>${this._speed}x</strong></div>
        </div>
      `;
    }
  }

  render() {
    if (!this._root) return;

    const mission = this.gameState.mission;
    const spacecraft = this.gameState.spacecraft;
    const orbitId = mission?.targetOrbitId || "LUNAR";
    const orbit = getOrbitById(orbitId) ?? getOrbitById("LEO");

    const selectedRocket =
      this._rockets.find((r) => r.id === this._selectedRocketId) ?? this._rockets[0];
    const selectedFairing =
      this._fairings.find((f) => f.id === this._selectedFairingId) ?? this._fairings[0];

    const scMass = spacecraft?.totalMassKg ?? 0;
    const scDeltaV = spacecraft?.deltaVMs ?? 0;
    const launchSite = getLaunchSiteById(DEFAULT_LAUNCH_SITE_ID);
    const dvBreakdown = this._mechanics.calculateSiteDeltaVBreakdown(orbit, launchSite);
    const totalDeltaV = (selectedRocket?.launcherDeltaVMs ?? 0) + scDeltaV;
    const requiredDeltaV = dvBreakdown.effectiveDeltaVMs || orbit?.requiredDeltaVMs || 8992;

    const penaltyLabel =
      dvBreakdown.penaltyKind === "plane-change"
        ? `+${dvBreakdown.planeChangeDeltaVMs} m/s (0° plane)`
        : dvBreakdown.penaltyKind === "azimuth"
          ? `+${dvBreakdown.azimuthPenaltyMs} m/s (${dvBreakdown.azimuthDeg}° az)`
          : "0 m/s (28.6° due east)";

    const instrumentCost = (mission?.instruments ?? []).reduce(
      (s, i) => s + (i.costMillions ?? 0),
      0
    );
    const totalMissionCost =
      instrumentCost +
      (spacecraft?.costMillions ?? 0) +
      (selectedRocket?.costMillions ?? 0) +
      (selectedFairing?.costMillions ?? 0);
    const budgetCap = mission?.budgetMillions ?? Infinity;

    const rocketCards = this._rockets
      .map((r) => {
        const selected = r.id === selectedRocket.id;
        const stackMass = r.liftoffMassKg + scMass + (selectedFairing?.massKg ?? 0);
        const twr = (r.liftoffThrustKN * 1000) / (stackMass * PHYSICS.STANDARD_GRAVITY_MS2);
        const massOk = scMass + (selectedFairing?.massKg ?? 0) <= r.maxPayloadLeoKg;

        return `
          <button
            type="button"
            class="lo-card ${selected ? "lo-card-selected" : ""}"
            data-rocket-id="${r.id}"
            ${this._flightActive ? "disabled" : ""}
          >
            <div class="lo-card-top">
              <strong>${this._escape(r.name)}</strong>
              <span class="lo-cost">$${r.costMillions.toFixed(1)}M</span>
            </div>
            <p class="lo-desc">${this._escape(r.description)}</p>
            <div class="lo-chips">
              <span class="${massOk ? "" : "lo-chip-warn"}">Cap: ${r.maxPayloadLeoKg} kg</span>
              <span>Δv: ${(r.launcherDeltaVMs / 1000).toFixed(1)} km/s</span>
              <span>Fairing: ${r.fairingDiameterM} m</span>
              <span>Max ${r.peakLaunchG}g</span>
              <span>TWR: ${twr.toFixed(2)}</span>
            </div>
          </button>
        `;
      })
      .join("");

    const fairingChips = this._fairings
      .map(
        (f) => `
          <button
            type="button"
            class="lo-fairing-btn ${f.id === selectedFairing.id ? "lo-fairing-active" : ""}"
            data-fairing-id="${f.id}"
            ${this._flightActive ? "disabled" : ""}
          >
            <strong>${this._escape(f.name)}</strong>
            <span>${f.costMillions > 0 ? `+$${f.costMillions}M` : "Included"} · ${f.protectsAero ? `Vib x${f.vibrationDamping}` : "Unshielded"}</span>
          </button>
        `
      )
      .join("");

    const showTimeline = this._flightActive || this._flightComplete;
    const prelaunchErrors =
      spacecraft && spacecraft.isValid === false && Array.isArray(spacecraft.errors)
        ? spacecraft.errors.filter((e) => typeof e === "string" && e.trim())
        : [];
    const prelaunchWarnHtml =
      prelaunchErrors.length > 0
        ? `
          <div class="lo-prelaunch-warn">
            <strong>Spacecraft Engineering Error${prelaunchErrors.length > 1 ? "s" : ""} (Test Flight):</strong>
            ${prelaunchErrors.map((err) => `<span>• ${this._escape(err)}</span>`).join("")}
          </div>
        `
        : "";

    const sciencePoints = (mission?.instruments ?? []).reduce(
      (sum, inst) => sum + (inst.sciencePoints || 0),
      0
    );
    const minSciencePoints = mission?.minSciencePoints ?? 0;
    const hasScienceDeficit = minSciencePoints > 0 && sciencePoints < minSciencePoints;
    const scienceWarnHtml = hasScienceDeficit
      ? `
        <div class="lo-science-warn">
          <strong>⚠ Science Warning (${sciencePoints} / ${minSciencePoints} pts):</strong>
          <span>Insufficient scientific points — spacecraft will not explode, but mission science objectives will fail.</span>
        </div>
      `
      : "";

    this._root.innerHTML = `
      <aside class="lo-panel lo-panel-left">
        <header class="lo-header">
          <span class="lo-badge">PHASE 3 · LAUNCH PAD</span>
          <h2>Launch Vehicle &amp; Fairing</h2>
          <div class="lo-site-pill">
            <strong>${this._escape(launchSite.name)}</strong>
            <span>${launchSite.latitudeDeg}°N, ${Math.abs(launchSite.longitudeDeg)}°W · Az ${dvBreakdown.azimuthDeg}°</span>
          </div>
        </header>
        <div class="lo-scroll">
          ${rocketCards}
          <div class="lo-subhead">PAYLOAD FAIRING</div>
          <div class="lo-fairing-list">${fairingChips}</div>
        </div>
        <footer class="lo-footer">
          <div class="lo-metrics">
            <div><span>Target Orbit</span><strong>${this._escape(orbit.id)} (${orbit.inclinationDeg ?? 28.6}°)</strong></div>
            <div><span>Stack Δv</span><strong class="${totalDeltaV >= requiredDeltaV ? "lo-ok" : "lo-warn"}">${Math.round(totalDeltaV).toLocaleString()} / ${requiredDeltaV.toLocaleString()} m/s</strong></div>
            <div><span>Earth Spin Assist</span><strong class="lo-ok">−${dvBreakdown.rotationBonusMs} m/s</strong></div>
            <div><span>Inclination Cost</span><strong class="${dvBreakdown.inclinationPenaltyMs > 0 ? "lo-warn" : "lo-ok"}">${penaltyLabel}</strong></div>
            <div><span>Spacecraft Mass</span><strong>${Math.round(scMass)} / ${selectedRocket.maxPayloadLeoKg} kg</strong></div>
            <div><span>Total Cost</span><strong class="${totalMissionCost <= budgetCap ? "lo-ok" : "lo-warn"}">$${totalMissionCost.toFixed(1)}M / $${budgetCap}M</strong></div>
          </div>
          ${prelaunchWarnHtml}
          ${scienceWarnHtml}
          <div class="lo-btn-row">
            <button type="button" class="lo-cta" data-action="launch" ${this._flightActive || !spacecraft ? "disabled" : ""}>
              ${this._flightActive ? "Launching..." : this._flightComplete ? "Re-Launch Vehicle" : "Launch Mission 🚀"}
            </button>
            <button type="button" class="lo-btn" data-action="toggle-speed">${this._speed}x</button>
          </div>
        </footer>
      </aside>

      ${
        showTimeline
          ? `
        <aside class="lo-panel lo-panel-right">
          <header class="lo-header">
            <span class="lo-badge">FLIGHT TIMELINE · LIVE PHYSICS</span>
            <h2>${this._escape(orbit.name)}</h2>
          </header>
          <div class="lo-telem" data-role="live-telem">
            <div class="lo-telem-head"><span class="lo-status-run">INITIALIZING TELEMETRY</span></div>
          </div>
          <div class="lo-scroll lo-timeline" data-role="timeline">
            ${this._renderTimelineItems(
              this._lastResult?.phases ?? [],
              this._activePhaseIndex,
              this._flightComplete
            )}
          </div>
          ${
            this._flightComplete && this._lastResult
              ? `
            <footer class="lo-footer">
              <div class="lo-result-banner ${
                this._lastResult.success
                  ? hasScienceDeficit
                    ? "lo-banner-warn"
                    : "lo-banner-ok"
                  : "lo-banner-err"
              }">
                <strong>${
                  this._lastResult.success
                    ? hasScienceDeficit
                      ? "⚠ ORBIT ACHIEVED · INSUFFICIENT SCIENCE POINTS"
                      : "MISSION ORBIT ACHIEVED"
                    : `FAILED AT ${this._escape(this._lastResult.failedPhaseId?.toUpperCase() || "LAUNCH")}`
                }</strong>
                <p>${this._escape(
                  this._lastResult.success
                    ? hasScienceDeficit
                      ? `Spacecraft reached orbit safely without exploding, but only ${sciencePoints}/${minSciencePoints} science points were collected.`
                      : "All 7 flight phases nominal."
                    : this._lastResult.failureCause
                )}</p>
              </div>
              <div class="lo-btn-row">
                <button type="button" class="lo-cta" data-action="view-results">View Full Report →</button>
                <button type="button" class="lo-btn" data-action="replay">Replay</button>
              </div>
            </footer>
          `
              : ""
          }
        </aside>
      `
          : ""
      }
    `;
  }

  _renderTimelineItems(phases, activeIdx, complete) {
    return phases
      .map((phase, idx) => {
        let state = "pending";
        if (phase.status === "skipped") {
          state = complete || idx > activeIdx ? "skipped" : "pending";
        } else if (idx < activeIdx || (complete && phase.status === "passed")) {
          state = "passed";
        } else if (idx === activeIdx) {
          state = phase.status === "failed" && (complete || this._lastResult?.failedPhaseId === phase.id)
            ? complete ? "failed" : "active"
            : "active";
          if (complete && phase.status === "failed") state = "failed";
        }

        const icon =
          state === "passed"
            ? "✓"
            : state === "failed"
              ? "✕"
              : state === "active"
                ? "●"
                : state === "skipped"
                  ? "—"
                  : "○";

        return `
          <div class="lo-phase lo-phase-${state}">
            <div class="lo-phase-top">
              <span class="lo-phase-icon">${icon}</span>
              <strong>${this._escape(phase.name)}</strong>
            </div>
            <p class="lo-phase-summary">${this._escape(
              state === "pending" ? "Awaiting phase..." : phase.summary || ""
            )}</p>
            ${
              state === "failed" && phase.fix
                ? `<p class="lo-phase-fix">Fix: ${this._escape(phase.fix)}</p>`
                : ""
            }
          </div>
        `;
      })
      .join("");
  }

  /** Remove launch panel DOM and event listeners. */
  destroy() {
    this.container.innerHTML = "";
    this._root = null;
  }

  _autoPickSensibleRocket() {
    const scMass = this.gameState.spacecraft?.totalMassKg ?? 300;
    const orbitId = this.gameState.mission?.targetOrbitId ?? "LEO";
    if (orbitId === "MARS") this._selectedRocketId = "super-heavy";
    else if (orbitId === "LUNAR") this._selectedRocketId = "heavy-lift";
    else if (scMass > 320) this._selectedRocketId = "medium-orbital";
    else this._selectedRocketId = "medium-orbital";
  }

  _escape(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  _ensureStyles() {
    if (document.getElementById(STYLE_ELEMENT_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    style.textContent = `
      .lo-shell { pointer-events: none; }
      .lo-panel {
        pointer-events: auto;
        position: fixed;
        top: 72px;
        bottom: 16px;
        width: min(365px, calc(50vw - 24px));
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 14px;
        background: rgba(11, 17, 32, 0.88);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(56, 189, 248, 0.28);
        border-radius: 12px;
        color: #f8fafc;
        z-index: 20;
        box-shadow: 0 20px 45px rgba(0, 0, 0, 0.45);
      }
      .lo-panel-left { left: 16px; }
      .lo-panel-right { right: 16px; }
      .lo-badge {
        display: inline-block;
        font-size: 10px;
        letter-spacing: 0.08em;
        color: #38bdf8;
        font-weight: 700;
      }
      .lo-header h2 { font-size: 16px; font-weight: 700; margin-top: 2px; }
      .lo-site-pill {
        margin-top: 6px;
        padding: 6px 8px;
        border-radius: 6px;
        background: rgba(14, 116, 144, 0.22);
        border: 1px solid rgba(56, 189, 248, 0.35);
        display: flex;
        flex-direction: column;
        gap: 1px;
        font-size: 11px;
      }
      .lo-site-pill strong { color: #e0f2fe; font-size: 11.5px; }
      .lo-site-pill span { color: #94a3b8; font-size: 10px; }
      .lo-subhead {
        font-size: 10px;
        letter-spacing: 0.08em;
        color: #94a3b8;
        font-weight: 700;
        margin-top: 6px;
      }
      .lo-scroll {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-right: 4px;
      }
      .lo-card, .lo-fairing-btn {
        text-align: left;
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 8px;
        padding: 9px 10px;
        color: #f8fafc;
        cursor: pointer;
      }
      .lo-card:hover:not(:disabled), .lo-fairing-btn:hover:not(:disabled) {
        border-color: rgba(56, 189, 248, 0.6);
      }
      .lo-card-selected, .lo-fairing-active {
        border-color: #38bdf8;
        background: rgba(14, 116, 144, 0.22);
      }
      .lo-fairing-list { display: flex; flex-direction: column; gap: 6px; }
      .lo-fairing-btn { display: flex; justify-content: space-between; align-items: center; gap: 6px; font-size: 11px; }
      .lo-fairing-btn span { color: #94a3b8; font-size: 10px; }
      .lo-card-top { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px; }
      .lo-cost { color: #38bdf8; font-weight: 700; font-size: 12px; }
      .lo-desc { font-size: 11px; color: #94a3b8; line-height: 1.35; margin-bottom: 6px; }
      .lo-chips { display: flex; flex-wrap: wrap; gap: 4px; }
      .lo-chips span {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(51, 65, 85, 0.72);
        color: #e2e8f0;
      }
      .lo-chip-warn { background: rgba(239, 68, 68, 0.28) !important; color: #fca5a5 !important; }
      .lo-footer {
        border-top: 1px solid rgba(148, 163, 184, 0.22);
        padding-top: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .lo-metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
      .lo-metrics > div {
        background: rgba(30, 41, 59, 0.65);
        padding: 6px 8px;
        border-radius: 6px;
      }
      .lo-metrics span { display: block; font-size: 10px; color: #94a3b8; }
      .lo-metrics strong { font-size: 11.5px; color: #f8fafc; }
      .lo-ok { color: #4ade80 !important; }
      .lo-warn { color: #fbbf24 !important; }
      .lo-btn-row { display: flex; gap: 8px; }
      .lo-cta {
        flex: 1;
        padding: 9px 12px;
        border-radius: 8px;
        border: 1px solid #38bdf8;
        background: linear-gradient(135deg, #0284c7, #0ea5e9);
        color: #fff;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
      }
      .lo-cta:disabled { opacity: 0.45; cursor: not-allowed; }
      .lo-btn {
        background: rgba(30, 41, 59, 0.9);
        color: #e2e8f0;
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .lo-telem {
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(56, 189, 248, 0.24);
        border-radius: 8px;
        padding: 8px 10px;
      }
      .lo-telem-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        margin-bottom: 6px;
        color: #cbd5e1;
      }
      .lo-status-run { color: #38bdf8; font-weight: 700; }
      .lo-status-ok { color: #4ade80; font-weight: 700; }
      .lo-status-err { color: #f87171; font-weight: 700; }
      .lo-telem-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
      .lo-telem-grid span { display: block; font-size: 10px; color: #94a3b8; }
      .lo-telem-grid strong { font-size: 12px; color: #f8fafc; }
      .lo-phase {
        padding: 8px 10px;
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(148, 163, 184, 0.18);
      }
      .lo-phase-passed { border-color: rgba(34, 197, 94, 0.45); background: rgba(20, 83, 45, 0.2); }
      .lo-phase-active { border-color: #38bdf8; background: rgba(14, 116, 144, 0.25); }
      .lo-phase-failed { border-color: #ef4444; background: rgba(127, 29, 29, 0.3); }
      .lo-phase-skipped { opacity: 0.45; }
      .lo-phase-top { display: flex; align-items: center; gap: 6px; font-size: 12px; }
      .lo-phase-summary { font-size: 11px; color: #cbd5e1; margin-top: 3px; }
      .lo-phase-fix { font-size: 11px; color: #fde68a; margin-top: 4px; }
      .lo-result-banner { padding: 8px 10px; border-radius: 8px; font-size: 11px; }
      .lo-banner-ok { background: rgba(34, 197, 94, 0.16); border: 1px solid rgba(34, 197, 94, 0.45); color: #86efac; }
      .lo-banner-warn { background: rgba(245, 158, 11, 0.16); border: 1px solid rgba(245, 158, 11, 0.5); color: #fde68a; }
      .lo-banner-err { background: rgba(239, 68, 68, 0.16); border: 1px solid rgba(239, 68, 68, 0.45); color: #fca5a5; }
      .lo-result-banner p { margin-top: 3px; color: #e2e8f0; line-height: 1.35; }
      .lo-science-warn {
        padding: 6px 8px;
        border-radius: 6px;
        background: rgba(245, 158, 11, 0.16);
        border: 1px solid rgba(245, 158, 11, 0.45);
        color: #fde68a;
        font-size: 10.5px;
      }
      .lo-science-warn span { display: block; margin-top: 2px; color: #fef3c7; }
      .lo-prelaunch-warn {
        max-height: 68px;
        overflow-y: auto;
        padding: 6px 8px;
        border-radius: 6px;
        background: rgba(239, 68, 68, 0.16);
        border: 1px solid rgba(239, 68, 68, 0.45);
        color: #fca5a5;
        font-size: 10.5px;
        line-height: 1.35;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .lo-prelaunch-warn strong { color: #fecaca; }
    `;
    document.head.appendChild(style);
  }
}
