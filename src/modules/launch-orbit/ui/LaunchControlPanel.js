/**
 * @file src/modules/launch-orbit/ui/LaunchControlPanel.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Launch control UI panel for selecting a launch vehicle & fairing, reviewing mass/delta-v
 *       margins, triggering the 3D phase-by-phase launch, and watching the live flight timeline.
 */

import { PHYSICS } from "../../../shared/data/constants.js";
import { getFairings, getRockets } from "../data/rockets.js";
import { getOrbitById } from "../data/orbits.js";
import { OrbitMechanics } from "../logic/OrbitMechanics.js";

const STYLE_ELEMENT_ID = "launch-control-panel-styles";
 /* @goal Launch control panel — rocket selector, per-orbit payload
 *       validation, liftoff TWR check, and live telemetry.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * SCOPE (end of Module 1)
 * ═══════════════════════════════════════════════════════════════════════
 *   Implemented (Module 1):
 *     - mount / destroy
 *     - setMissionSpec / setSpacecraftSpec
 *     - Rocket list rendered with per-orbit capacity and cost
 *     - Payload check (spacecraft mass vs. vehicle capacity for the
 *       target orbit — Module 1 §3.5–3.6)
 *     - Liftoff TWR check via RocketPhysics.liftoffTWR (Module 1 §3.2)
 *     - Launch button enabled only when both checks pass
 *     - Player-facing explanation strings for every failure mode
 *
 *   Deferred:
 *     - updateTelemetry()      → Module 5 (animation loop)
 *     - Δv margin display       → Module 3
 *     - 3D orbit visualization  → Module 5
 * ═══════════════════════════════════════════════════════════════════════
 */

import { getRockets } from '../data/rockets.js';
import { getOrbits } from '../data/orbits.js';
import { liftoffTWR } from '../logic/RocketPhysics.js';

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
    const totalDeltaV = (selectedRocket?.launcherDeltaVMs ?? 0) + scDeltaV;
    const requiredDeltaV = orbit?.requiredDeltaVMs ?? 9400;

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

    this._root.innerHTML = `
      <aside class="lo-panel lo-panel-left">
        <header class="lo-header">
          <span class="lo-badge">PHASE 3 · LAUNCH PAD</span>
          <h2>Launch Vehicle &amp; Fairing</h2>
        </header>
        <div class="lo-scroll">
          ${rocketCards}
          <div class="lo-subhead">PAYLOAD FAIRING</div>
          <div class="lo-fairing-list">${fairingChips}</div>
        </div>
        <footer class="lo-footer">
          <div class="lo-metrics">
            <div><span>Target Orbit</span><strong>${this._escape(orbit.id)}</strong></div>
            <div><span>Stack Δv</span><strong class="${totalDeltaV >= requiredDeltaV ? "lo-ok" : "lo-warn"}">${Math.round(totalDeltaV).toLocaleString()} / ${requiredDeltaV.toLocaleString()} m/s</strong></div>
            <div><span>Spacecraft Mass</span><strong>${Math.round(scMass)} / ${selectedRocket.maxPayloadLeoKg} kg</strong></div>
            <div><span>Total Cost</span><strong class="${totalMissionCost <= budgetCap ? "lo-ok" : "lo-warn"}">$${totalMissionCost.toFixed(1)}M / $${budgetCap}M</strong></div>
          </div>
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
              <div class="lo-result-banner ${this._lastResult.success ? "lo-banner-ok" : "lo-banner-err"}">
                <strong>${this._lastResult.success ? "MISSION ORBIT ACHIEVED" : `FAILED AT ${this._escape(this._lastResult.failedPhaseId?.toUpperCase() || "LAUNCH")}`}</strong>
                <p>${this._escape(this._lastResult.success ? "All 7 flight phases nominal." : this._lastResult.failureCause)}</p>
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
    this.onLaunch = onLaunch;

    this._missionSpec = null;
    this._spacecraftSpec = null;
    this._selectedRocketId = null;

    this._onSelectorChange = this._onSelectorChange.bind(this);
    this._onLaunchClick = this._onLaunchClick.bind(this);
  }

  // ─── Public setters (called by Member 4's flow controller) ─────────

  setMissionSpec(missionSpec) {
    this._missionSpec = missionSpec;
    this._rerender();
  }

  setSpacecraftSpec(spacecraftSpec) {
    this._spacecraftSpec = spacecraftSpec;
    this._rerender();
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────

  mount() {
    this._renderShell();
    this._bindEvents();
    this._rerender();
  }

  /**
   * Update live telemetry readouts during flight.
   * @param {{ altitudeKm: number, velocityKms: number, stage: string }} telemetry
   *
   * STUB (Module 5): no-op until LaunchAnimation exists.
   */
  updateTelemetry(_telemetry) {
    // TODO (Module 5): write values into the telemetry DOM nodes.
  }

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
      .lo-banner-err { background: rgba(239, 68, 68, 0.16); border: 1px solid rgba(239, 68, 68, 0.45); color: #fca5a5; }
      .lo-result-banner p { margin-top: 3px; color: #e2e8f0; line-height: 1.35; }
    `;
    document.head.appendChild(style);
    this._unbindEvents();
    this.container.innerHTML = '';
  }

  // ─── Internals: shell ──────────────────────────────────────────────

  _renderShell() {
    this.container.innerHTML = `
      <div class="launch-panel">
        <h2 class="launch-panel__title">Launch &amp; Orbit</h2>

        <section class="launch-panel__section">
          <h3>Target Orbit</h3>
          <p id="lo-target-orbit" class="launch-panel__target">
            Waiting for mission phase…
          </p>
          <p id="lo-orbit-explainer" class="launch-panel__hint"></p>
        </section>

        <section class="launch-panel__section">
          <h3>Launch Vehicle</h3>
          <div id="lo-rocket-list" class="launch-panel__rockets"></div>
        </section>

        <section class="launch-panel__section">
          <h3>Mission Checks</h3>
          <p id="lo-spacecraft-mass" class="launch-panel__hint">
            Waiting for spacecraft phase…
          </p>
          <p id="lo-payload-check" class="launch-panel__validation"></p>
          <p id="lo-payload-explain" class="launch-panel__hint"></p>
          <p id="lo-twr-check" class="launch-panel__validation"></p>
          <p id="lo-twr-explain" class="launch-panel__hint"></p>
        </section>

        <section class="launch-panel__section">
          <button id="lo-launch-btn" class="launch-panel__button" disabled>
            Launch
          </button>
        </section>

        <section class="launch-panel__section launch-panel__telemetry">
          <h3>Telemetry</h3>
          <dl>
            <dt>Altitude</dt><dd id="lo-telemetry-alt">—</dd>
            <dt>Velocity</dt><dd id="lo-telemetry-vel">—</dd>
            <dt>Stage</dt>   <dd id="lo-telemetry-stage">—</dd>
          </dl>
        </section>
      </div>
    `;

    this._refs = {
      targetOrbit:       this.container.querySelector('#lo-target-orbit'),
      orbitExplainer:    this.container.querySelector('#lo-orbit-explainer'),
      rocketList:        this.container.querySelector('#lo-rocket-list'),
      spacecraftMass:    this.container.querySelector('#lo-spacecraft-mass'),
      payloadCheck:      this.container.querySelector('#lo-payload-check'),
      payloadExplain:    this.container.querySelector('#lo-payload-explain'),
      twrCheck:          this.container.querySelector('#lo-twr-check'),
      twrExplain:        this.container.querySelector('#lo-twr-explain'),
      launchBtn:         this.container.querySelector('#lo-launch-btn'),
      telemetryAlt:      this.container.querySelector('#lo-telemetry-alt'),
      telemetryVel:      this.container.querySelector('#lo-telemetry-vel'),
      telemetryStage:    this.container.querySelector('#lo-telemetry-stage')
    };
  }

  _bindEvents() {
    this._refs.launchBtn.addEventListener('click', this._onLaunchClick);
    this._refs.rocketList.addEventListener('change', this._onSelectorChange);
  }

  _unbindEvents() {
    this._refs?.launchBtn.removeEventListener('click', this._onLaunchClick);
    this._refs?.rocketList.removeEventListener('change', this._onSelectorChange);
  }

  // ─── Internals: state → DOM ────────────────────────────────────────

  _rerender() {
    if (!this._refs) return;

    const rockets = getRockets();
    const orbits = getOrbits();
    const targetOrbitId = this._missionSpec?.targetOrbit ?? null;
    const targetOrbit = orbits.find((o) => o.id === targetOrbitId);

    // ── Target orbit block ──
    if (targetOrbit) {
      this._refs.targetOrbit.textContent =
        `${targetOrbit.name} (${targetOrbit.id})`;
      this._refs.orbitExplainer.textContent =
        targetOrbit.payloadImpact ?? '';
    } else {
      this._refs.targetOrbit.textContent = 'Waiting for mission phase…';
      this._refs.orbitExplainer.textContent = '';
    }

    // ── Rocket list ──
    this._refs.rocketList.innerHTML = rockets
      .map((r) => this._renderRocketOption(r, targetOrbitId))
      .join('');

    // ── Spacecraft mass summary ──
    const spacecraftMassKg = this._spacecraftSpec?.totalMassKg ?? null;
    this._refs.spacecraftMass.textContent =
      spacecraftMassKg != null
        ? `Spacecraft mass: ${spacecraftMassKg.toFixed(0)} kg`
        : 'Waiting for spacecraft phase…';

    // ── Checks for the currently selected rocket ──
    const selected = rockets.find((r) => r.id === this._selectedRocketId);
    if (!selected) {
      this._clearChecks('Select a launch vehicle to check compatibility.');
      return;
    }
    if (!targetOrbit || spacecraftMassKg == null) {
      this._clearChecks('Waiting for mission and spacecraft data.');
      return;
    }

    const payloadResult = this._validatePayload(selected, targetOrbit, spacecraftMassKg);
    const twrResult     = this._validateTWR(selected, spacecraftMassKg);

    this._refs.payloadCheck.textContent   = payloadResult.headline;
    this._refs.payloadExplain.textContent = payloadResult.explain;
    this._refs.twrCheck.textContent       = twrResult.headline;
    this._refs.twrExplain.textContent     = twrResult.explain;

    this._refs.launchBtn.disabled = !(payloadResult.valid && twrResult.valid);
  }

  _clearChecks(hint) {
    this._refs.payloadCheck.textContent   = hint;
    this._refs.payloadExplain.textContent = '';
    this._refs.twrCheck.textContent       = '';
    this._refs.twrExplain.textContent     = '';
    this._refs.launchBtn.disabled = true;
  }

  _renderRocketOption(rocket, orbitId) {
    const capacity = orbitId ? rocket.payloadCapacityKg?.[orbitId] : null;
    const capacityText = capacity
      ? capacity.max > 0
        ? `Lifts ${capacity.min.toLocaleString()}–${capacity.max.toLocaleString()} kg to ${orbitId}`
        : `Cannot reach ${orbitId}`
      : 'No capacity data for this orbit';
    const fictionBadge = rocket.fictional
      ? '<span class="launch-panel__badge">illustrative</span>'
      : '';
    const checked = rocket.id === this._selectedRocketId ? 'checked' : '';

    return `
      <label class="launch-panel__rocket">
        <input type="radio" name="lo-rocket" value="${rocket.id}" ${checked} />
        <span class="launch-panel__rocket-name">${rocket.name}</span>
        ${fictionBadge}
        <span class="launch-panel__rocket-meta">${capacityText}</span>
        <span class="launch-panel__rocket-meta">
          Fairing Ø${rocket.fairingDiameterM} m · cost $${(rocket.costUsd / 1e6).toFixed(1)}M
        </span>
      </label>
    `;
  }

  // ─── Checks ────────────────────────────────────────────────────────

  /**
   * Payload mass check (Module 1 §3.5–3.6).
   * Capacity depends on the target orbit; using LEO capacity for a GEO
   * mission would be wrong by up to 3× on some vehicles.
   */
  _validatePayload(rocket, targetOrbit, spacecraftMassKg) {
    const cap = rocket.payloadCapacityKg?.[targetOrbit.id];

    if (!cap || cap.max === 0) {
      return {
        valid: false,
        headline: `✗ ${rocket.name} cannot reach ${targetOrbit.name}.`,
        explain:
          'This vehicle does not have the performance to deliver any ' +
          'payload to this orbit. Pick a larger vehicle or a lower-energy ' +
          'destination orbit.'
      };
    }

    const marginKg = cap.max - spacecraftMassKg;
    if (marginKg >= 0) {
      return {
        valid: true,
        headline: `✓ Payload fits on ${rocket.name} for ${targetOrbit.id}.`,
        explain:
          `Spacecraft ${spacecraftMassKg.toFixed(0)} kg; vehicle limit ` +
          `${cap.max.toFixed(0)} kg; margin ${marginKg.toFixed(0)} kg. ` +
          `Payload mass is validated against the target orbit because ` +
          `higher orbits cost more delta-v and therefore carry less payload.`
      };
    }

    return {
      valid: false,
      headline:
        `✗ Payload too heavy by ${Math.abs(marginKg).toFixed(0)} kg for ${targetOrbit.id}.`,
      explain:
        `The vehicle lifts at most ${cap.max.toFixed(0)} kg to ${targetOrbit.id}, ` +
        `but your spacecraft is ${spacecraftMassKg.toFixed(0)} kg. Reduce mass ` +
        `in the spacecraft phase, or choose a larger vehicle.`
    };
  }

  /**
   * Liftoff thrust-to-weight check (Module 1 §3.2).
   * TWR < 1 means the engines cannot overcome the rocket's weight —
   * no launch is possible, no matter what the payload capacity says.
   */
  _validateTWR(rocket, spacecraftMassKg) {
    const twr = liftoffTWR(rocket, spacecraftMassKg);
    if (twr < 1) {
      return {
        valid: false,
        headline: `✗ Liftoff thrust-to-weight ratio is ${twr.toFixed(2)}.`,
        explain:
          'A ratio below 1 means the engines cannot overcome the rocket\'s ' +
          'own weight — the vehicle cannot leave the pad. This is a hard ' +
          'physical limit independent of payload capacity.'
      };
    }
    return {
      valid: true,
      headline: `✓ Liftoff thrust-to-weight ratio is ${twr.toFixed(2)}.`,
      explain:
        'Above 1 means the engines can lift the fully loaded vehicle off ' +
        'the pad. Real orbital launchers typically launch at 1.2–1.5.'
    };
  }

  // ─── Events ────────────────────────────────────────────────────────

  _onSelectorChange(evt) {
    if (evt.target?.name !== 'lo-rocket') return;
    this._selectedRocketId = evt.target.value;
    this._rerender();
  }

  _onLaunchClick() {
    if (!this._selectedRocketId) return;
    const orbitId = this._missionSpec?.targetOrbit;
    if (!orbitId) return;

    try {
      this.onLaunch(this._selectedRocketId, orbitId);
    } catch (err) {
      // Launch simulation lives in Module 3 — until then it throws, and
      // we surface that message to the player instead of an empty console.
      console.warn('[launch-orbit] Launch attempt failed:', err.message);
      this._refs.payloadExplain.textContent = err.message;
    }
  }
}