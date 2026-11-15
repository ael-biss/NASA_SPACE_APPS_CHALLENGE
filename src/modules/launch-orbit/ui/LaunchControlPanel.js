/**
 * @file src/modules/launch-orbit/ui/LaunchControlPanel.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Launch control UI panel for selecting a launch vehicle & fairing, reviewing mass/delta-v
 *       margins, triggering the 3D phase-by-phase launch, and watching the live flight timeline.
 */

import { PHYSICS } from "../../../shared/data/constants.js";
import { computeBudgetSummary, formatBudget } from "../../../shared/utils/formatters.js";
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
    this._lastTelemetry = null;
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
      if (e.target.closest("summary")) return;
      const btn = e.target.closest("[data-action], [data-rocket-id], [data-fairing-id]");
      if (!btn) return;

      if (btn.dataset.rocketId && !this._flightActive) {
        this._selectedRocketId = btn.dataset.rocketId;
        this._flightComplete = false;
        this._lastResult = null;
        this._lastTelemetry = null;
        this._syncPendingLaunchCost();
        this.handlers.onSelectRocket?.(this._selectedRocketId);
        this.render();
        return;
      }

      if (btn.dataset.fairingId && !this._flightActive) {
        this._selectedFairingId = btn.dataset.fairingId;
        this._flightComplete = false;
        this._lastResult = null;
        this._lastTelemetry = null;
        this._syncPendingLaunchCost();
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
      } else if (action === "set-speed") {
        const nextSpeed = Number(btn.dataset.speed);
        if ([1, 10, 100].includes(nextSpeed)) {
          this._speed = nextSpeed;
          this.handlers.onSpeedChange?.(this._speed);
          this.render();
        }
      } else if (action === "toggle-speed") {
        this._speed = this._speed === 1 ? 10 : this._speed === 10 ? 100 : 1;
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

    this._syncPendingLaunchCost();
    this.render();
  }

  _syncPendingLaunchCost() {
    const rocket = this._rockets.find((r) => r.id === this._selectedRocketId) ?? this._rockets[0];
    const fairing = this._fairings.find((f) => f.id === this._selectedFairingId) ?? this._fairings[0];
    const cost = (rocket?.costMillions ?? 0) + (fairing?.costMillions ?? 0);
    this.gameState.setPendingLaunchCost?.(cost);
  }

  setFlightState(launchResult) {
    this._lastResult = launchResult;
    this._lastTelemetry = {
      phaseIndex: 0,
      phase: launchResult?.phases?.[0],
      altitudeKm: 0,
      velocityKms: 0,
      propellantPct: 100,
      gLoad: 1.0,
      maxAllowableG: Number((launchResult?.missionStats?.maxAllowableG ?? 8.0).toFixed(1)),
      countdownSec: 3,
      activeStage: launchResult?.missionStats?.stages?.[0]?.name ?? "Stage 1 (Booster)",
      failed: false,
    };
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
   * @param {{ phaseIndex?: number, phase?: Object, altitudeKm?: number, velocityKms?: number, propellantPct?: number, gLoad?: number, failed?: boolean }} telemetry
   */
  updateTelemetry(telemetry) {
    if (!this._root) return;
    if (typeof telemetry.phaseIndex === "number") {
      this._activePhaseIndex = telemetry.phaseIndex;
    }
    const prev = this._lastTelemetry ?? {};
    this._lastTelemetry = {
      ...prev,
      ...telemetry,
      altitudeKm:
        typeof telemetry.altitudeKm === "number" ? telemetry.altitudeKm : (prev.altitudeKm ?? 0),
      velocityKms:
        typeof telemetry.velocityKms === "number" ? telemetry.velocityKms : (prev.velocityKms ?? 0),
      gLoad:
        typeof telemetry.gLoad === "number" ? telemetry.gLoad : (prev.gLoad ?? 1.0),
      maxAllowableG:
        typeof telemetry.maxAllowableG === "number"
          ? telemetry.maxAllowableG
          : (prev.maxAllowableG ?? 8.0),
      countdownSec:
        typeof telemetry.countdownSec === "number" ? telemetry.countdownSec : 0,
      propellantPct:
        typeof telemetry.propellantPct === "number" ? telemetry.propellantPct : (prev.propellantPct ?? 100),
      activeStage: telemetry.activeStage ?? prev.activeStage ?? "Stage 1 (Booster)",
    };

    const countdownEl = this._root.querySelector('[data-role="countdown"]');
    if (countdownEl) {
      const cd = this._lastTelemetry.countdownSec;
      if (this._flightActive && !this._flightComplete && cd > 0) {
        countdownEl.hidden = false;
        countdownEl.innerHTML = `<span class="lo-cd-label">TERMINAL COUNT</span><strong>T-${cd}</strong>`;
      } else {
        countdownEl.hidden = true;
      }
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
      telemEl.innerHTML = this._renderTelemetryInnerHtml(this._lastTelemetry);
    }
  }

  _renderTelemetryInnerHtml(telemetry) {
    const t = telemetry ?? {};
    const alt = t.altitudeKm ?? 0;
    const vel = t.velocityKms ?? 0;
    const gLoad = Number(t.gLoad ?? 0);
    const maxG = Math.max(1, Number(t.maxAllowableG ?? 8.0));
    const gPct = Math.min(100, Math.round((gLoad / maxG) * 100));
    const gStateClass =
      t.failed || gLoad > maxG ? "lo-g-err" : gPct >= 80 ? "lo-g-warn" : "";
    const stageName = t.activeStage ?? t.phase?.name ?? "Stage 1 (Booster)";
    const fuelRemainingPct =
      typeof t.propellantPct === "number"
        ? Math.max(0, Math.min(100, Math.round(t.propellantPct)))
        : Math.max(
            4,
            Math.min(100, Math.round(100 - ((this._activePhaseIndex + 0.5) / 7) * 88))
          );
    const statusBadge = t.failed
      ? `<span class="lo-status-err">ANOMALY / FAILURE</span>`
      : t.countdownSec > 0
        ? `<span class="lo-status-run">T-${t.countdownSec} COUNTDOWN</span>`
        : this._flightComplete && this._lastResult?.success
          ? `<span class="lo-status-ok">ORBIT CAPTURED</span>`
          : `<span class="lo-status-run">FLIGHT IN PROGRESS</span>`;

    const physicsTip = this._getPhysicsInsight(t.phase, t.failed);

    return `
      <div class="lo-telem-head">${statusBadge}<span>${this._escape(stageName)}</span></div>
      <div class="lo-telem-grid">
        <div class="lo-gauge">
          <span>G-Load</span>
          <strong class="${gStateClass}">${gLoad.toFixed(2)} g <small>/ ${maxG}g</small></strong>
          <div class="lo-g-track"><div class="lo-g-fill ${gStateClass}" style="width:${gPct}%"></div></div>
        </div>
        <div class="lo-gauge">
          <span>Altitude</span>
          <strong>${alt.toLocaleString()} km</strong>
        </div>
        <div class="lo-gauge">
          <span>Velocity</span>
          <strong>${vel} km/s</strong>
        </div>
        <div class="lo-gauge">
          <span>Stage</span>
          <strong>${this._escape(stageName)}</strong>
        </div>
      </div>
      <div class="lo-fuel-wrap">
        <div class="lo-fuel-label">
          <span>Propellant Reserve</span>
          <strong>${t.failed ? "0%" : `${fuelRemainingPct}%`}</strong>
        </div>
        <div class="lo-fuel-track">
          <div class="lo-fuel-fill ${t.failed ? "lo-fuel-err" : ""}" style="width:${t.failed ? 0 : fuelRemainingPct}%"></div>
        </div>
      </div>
      ${physicsTip ? `<div class="lo-physics-tip"><strong>Physics Insight:</strong> ${this._escape(physicsTip)}</div>` : ""}
    `;
  }

  _getPhysicsInsight(phase, failed) {
    if (failed) {
      return "When structural, thermal, radiation, or delta-v limits are exceeded, mission physics prevent safe orbital capture.";
    }
    const id = String(phase?.id ?? "").toLowerCase();
    const name = String(phase?.name ?? "").toLowerCase();
    if (id.includes("liftoff") || name.includes("liftoff")) {
      return "Thrust-to-Weight Ratio (TWR > 1.0) must overcome Earth's gravity for vertical liftoff.";
    }
    if (id.includes("maxq") || name.includes("max-q") || name.includes("ascent")) {
      return "At Max-Q, aerodynamic pressure peaks; the payload fairing shields delicate instruments and solar arrays.";
    }
    if (id.includes("stage") || name.includes("staging")) {
      return "Dropping empty booster mass increases mass ratio, boosting Δv per the Tsiolkovsky rocket equation.";
    }
    if (id.includes("parking") || name.includes("orbit")) {
      return "Circular orbital velocity (~7.8 km/s in LEO) balances forward motion against Earth's gravitational pull.";
    }
    if (id.includes("transfer") || name.includes("tli") || name.includes("injection")) {
      return "A Hohmann/escape transfer burn raises apogee toward the target planet or Moon.";
    }
    if (id.includes("capture") || name.includes("insertion")) {
      return "Orbital insertion fires thrusters to slow down at periapsis so target gravity captures the spacecraft.";
    }
    return "Real-time trajectory balances velocity, gravity losses, and spacecraft propellant mass.";
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
          : "0 m/s (due east)";

    const launchCost = (selectedRocket?.costMillions ?? 0) + (selectedFairing?.costMillions ?? 0);
    const budget = computeBudgetSummary(mission, spacecraft, null, launchCost);
    const totalMissionCost = budget.totalCost;
    const budgetCap = budget.startingBudget || Infinity;

    const rocketCards = this._rockets
      .map((r) => {
        const selected = r.id === selectedRocket.id;
        const stackMass = r.liftoffMassKg + scMass + (selectedFairing?.massKg ?? 0);
        const twr = (r.liftoffThrustKN * 1000) / (stackMass * PHYSICS.STANDARD_GRAVITY_MS2);
        const massOk = scMass + (selectedFairing?.massKg ?? 0) <= r.maxPayloadLeoKg;

        return `
          <div
            role="button"
            tabindex="${this._flightActive ? "-1" : "0"}"
            class="lo-card ${selected ? "lo-card-selected" : ""}"
            data-rocket-id="${r.id}"
            aria-pressed="${selected}"
          >
            <div class="lo-card-top">
              <strong>${this._escape(r.name)}${selected ? ` <span class="lo-selected-badge">✓ SELECTED</span>` : ""}</strong>
              <span class="lo-cost">$${r.costMillions.toFixed(1)}M</span>
            </div>
            <p class="lo-desc">${this._escape(r.description)}</p>
            <div class="lo-chips">
              <span class="${massOk ? "lo-chip-ok" : "lo-chip-warn"}">Cap: ${r.maxPayloadLeoKg} kg</span>
              <span>Δv: ${(r.launcherDeltaVMs / 1000).toFixed(1)} km/s</span>
              <span>TWR: ${twr.toFixed(2)}</span>
            </div>
            <details class="oc-details lo-card-details">
              <summary>Stage &amp; Vehicle Specs</summary>
              <div class="oc-details-body">
                <div><strong>Fairing:</strong> ${r.fairingDiameterM} m · <strong>Max Load:</strong> ${r.peakLaunchG}g</div>
                ${(r.stages ?? [])
                  .map(
                    (s, i) =>
                      `<div><strong>S${i + 1}:</strong> ${this._escape(s.name)} · ${s.propellantType} · Isp ${s.ispVacuumS}s</div>`
                  )
                  .join("")}
              </div>
            </details>
          </div>
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
            <strong>Warning · Spacecraft Issue${prelaunchErrors.length > 1 ? "s" : ""} (Test Flight):</strong>
            <span>${this._escape(prelaunchErrors[0])}</span>
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
          <strong>Notice · Science Target (${sciencePoints}/${minSciencePoints} pts):</strong>
          <span>Craft can launch, but mission science goal will fall short.</span>
        </div>
      `
      : "";

    this._root.innerHTML = `
      <aside class="lo-panel lo-panel-left">
        <header class="lo-header">
          <span class="lo-badge">Phase 3 · Launch &amp; Orbit</span>
          <h2>Select Launch Vehicle</h2>
          <div class="lo-site-pill">
            <strong>${this._escape(launchSite.name)}</strong>
            <span>Target: ${this._escape(orbit.id)} · Launch Inclination: ${dvBreakdown.targetInclDeg}°</span>
          </div>
        </header>
        <div class="lo-scroll">
          ${rocketCards}
          <div class="lo-subhead">Payload Fairing</div>
          <div class="lo-fairing-list">${fairingChips}</div>
        </div>
        <footer class="lo-footer">
          <div class="lo-metrics">
            <div><span>Stack Δv</span><strong class="${totalDeltaV >= requiredDeltaV ? "lo-ok" : "lo-warn"}">${Math.round(totalDeltaV).toLocaleString()} / ${requiredDeltaV.toLocaleString()} m/s</strong></div>
            <div><span>Payload Mass</span><strong class="${scMass <= selectedRocket.maxPayloadLeoKg ? "lo-ok" : "lo-warn"}">${Math.round(scMass)} / ${selectedRocket.maxPayloadLeoKg} kg</strong></div>
            <div title="Start Budget: $${budget.startingBudget}M · Instruments: $${budget.instrumentsCost.toFixed(1)}M · Spacecraft: $${budget.spacecraftCost.toFixed(1)}M · Launch: $${budget.launchCost.toFixed(1)}M"><span>Cost / Budget</span><strong class="${totalMissionCost <= budgetCap ? "lo-ok" : "lo-warn"}">$${totalMissionCost.toFixed(1)}M / $${budgetCap}M (${budget.startingBudget > 0 ? (budget.budgetRemaining >= 0 ? `${formatBudget(budget.budgetRemaining)} left` : `-$${Math.abs(budget.budgetRemaining).toFixed(1)}M over`) : "—"})</strong></div>
            <div><span>Sim Speed</span><strong>${this._speed}x</strong></div>
          </div>
          <details class="oc-details">
            <summary>Orbital &amp; Site Physics</summary>
            <div class="oc-details-body">
              <div><strong>Launch Inclination:</strong> ${dvBreakdown.targetInclDeg}°</div>
              <div><strong>Earth Spin Assist:</strong> −${dvBreakdown.rotationBonusMs} m/s</div>
              <div><strong>Inclination Penalty:</strong> ${penaltyLabel}</div>
              <div><strong>Launch Azimuth:</strong> ${dvBreakdown.azimuthDeg}°</div>
            </div>
          </details>
          ${prelaunchWarnHtml}
          ${scienceWarnHtml}
          <div class="lo-btn-row">
            <button type="button" class="lo-cta" data-action="launch" ${this._flightActive || !spacecraft ? "disabled" : ""}>
              ${this._flightActive ? "Flight in Progress..." : this._flightComplete ? "Re-Launch Mission" : "Launch Mission"}
            </button>
            <div class="lo-warp-group" role="group" aria-label="Time warp speed">
              ${[1, 10, 100]
                .map(
                  (spd) =>
                    `<button type="button" class="lo-warp-btn ${this._speed === spd ? "active" : ""}" data-action="set-speed" data-speed="${spd}">${spd}x</button>`
                )
                .join("")}
            </div>
          </div>
        </footer>
      </aside>

      <div class="lo-countdown" data-role="countdown" ${
        this._flightActive && !this._flightComplete && (this._lastTelemetry?.countdownSec ?? 0) > 0
          ? ""
          : "hidden"
      }>
        <span class="lo-cd-label">TERMINAL COUNT</span>
        <strong>T-${this._lastTelemetry?.countdownSec ?? 3}</strong>
      </div>
      <div class="lo-scale-note">Orbit &amp; body sizes not to scale</div>

      ${
        showTimeline
          ? `
        <aside class="lo-panel lo-panel-right">
          <header class="lo-header">
            <span class="lo-badge">Live Flight Telemetry</span>
            <h2>${this._escape(orbit.name)}</h2>
          </header>
          <div class="lo-telem" data-role="live-telem">
            ${this._renderTelemetryInnerHtml(this._lastTelemetry)}
          </div>
          <details class="oc-details lo-tl-drawer" ${this._flightActive ? "open" : ""}>
            <summary>Flight Phase Timeline</summary>
            <div class="oc-details-body lo-scroll lo-timeline" data-role="timeline">
              ${this._renderTimelineItems(
                this._lastResult?.phases ?? [],
                this._activePhaseIndex,
                this._flightComplete
              )}
            </div>
          </details>
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
                      ? "ORBIT ACHIEVED · LOW SCIENCE SCORE"
                      : "MISSION ORBIT ACHIEVED"
                    : `ANOMALY AT ${this._escape(this._lastResult.failedPhaseId?.toUpperCase() || "LAUNCH")}`
                }</strong>
                <p>${this._escape(
                  this._lastResult.success
                    ? hasScienceDeficit
                      ? `Reached orbit safely, but only ${sciencePoints}/${minSciencePoints} science points collected.`
                      : "All 7 flight phases completed nominally."
                    : this._lastResult.failureCause
                )}</p>
              </div>
              <div class="lo-btn-row">
                <button type="button" class="lo-cta" data-action="view-results">View Mission Results →</button>
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
    this.gameState.setPendingLaunchCost?.(0);
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
        background: rgba(16, 29, 51, 0.90);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(25, 191, 255, 0.34);
        border-radius: 12px;
        color: var(--oc-starlight, #EAF4FF);
        font-family: var(--font-body, "Inter", system-ui, sans-serif);
        z-index: 20;
        box-shadow: 0 20px 45px rgba(5, 11, 27, 0.55);
      }
      .lo-panel-left { left: 16px; }
      .lo-panel-right { right: 16px; }
      .lo-badge {
        display: inline-block;
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-size: 11px;
        letter-spacing: 0.1em;
        color: var(--oc-cosmic-cyan, #19BFFF);
        font-weight: 700;
        text-transform: uppercase;
      }
      .lo-header h2 {
        font-family: var(--font-display, "Orbitron", sans-serif);
        font-size: 16px;
        font-weight: 700;
        margin-top: 2px;
        color: var(--oc-starlight, #EAF4FF);
      }
      .lo-site-pill {
        margin-top: 6px;
        padding: 6px 8px;
        border-radius: 6px;
        background: rgba(22, 119, 255, 0.18);
        border: 1px solid rgba(25, 191, 255, 0.38);
        display: flex;
        flex-direction: column;
        gap: 1px;
        font-size: 12px;
      }
      .lo-site-pill strong { color: var(--oc-starlight, #EAF4FF); font-size: 12.5px; }
      .lo-site-pill span { color: var(--oc-nebula-gray, #8CA3BF); font-size: 11px; }
      .lo-subhead {
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-size: 11px;
        letter-spacing: 0.1em;
        color: var(--oc-nebula-gray, #8CA3BF);
        font-weight: 700;
        text-transform: uppercase;
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
        background: rgba(5, 11, 27, 0.72);
        border: 1px solid rgba(140, 163, 191, 0.24);
        border-radius: 8px;
        padding: 9px 10px;
        color: var(--oc-starlight, #EAF4FF);
        cursor: pointer;
      }
      .lo-card:hover:not(:disabled), .lo-fairing-btn:hover:not(:disabled) {
        border-color: rgba(25, 191, 255, 0.6);
      }
      .lo-card-selected, .lo-fairing-active {
        border: 1.5px solid var(--oc-cosmic-cyan, #19BFFF);
        border-left: 4px solid var(--oc-cosmic-cyan, #19BFFF);
        background: rgba(22, 119, 255, 0.24);
        box-shadow: 0 0 0 1px rgba(25, 191, 255, 0.35), inset 0 0 18px rgba(25, 191, 255, 0.12);
      }
      .lo-selected-badge {
        display: inline-block;
        margin-left: 6px;
        padding: 1px 6px;
        border-radius: 999px;
        background: var(--oc-cosmic-cyan, #19BFFF);
        color: var(--oc-deep-space, #050B1B);
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.05em;
        vertical-align: middle;
      }
      .lo-fairing-list { display: flex; flex-direction: column; gap: 6px; }
      .lo-fairing-btn { display: flex; justify-content: space-between; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; }
      .lo-fairing-btn span { color: var(--oc-nebula-gray, #8CA3BF); font-size: 12px; }
      .lo-card-top { display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; margin-bottom: 4px; }
      .lo-cost { color: var(--oc-stellar-gold, #FF9D24); font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums; }
      .lo-desc { font-size: 13px; color: var(--oc-nebula-gray, #8CA3BF); line-height: 1.45; margin-bottom: 6px; }
      .lo-chips { display: flex; flex-wrap: wrap; gap: 4px; }
      .lo-chips span {
        font-size: 11px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(16, 29, 51, 0.9);
        border: 1px solid rgba(140, 163, 191, 0.2);
        color: var(--oc-starlight, #EAF4FF);
      }
      .lo-chip-warn { background: rgba(255, 83, 100, 0.24) !important; color: var(--oc-warning-red, #FF5364) !important; border-color: rgba(255, 83, 100, 0.45) !important; }
      .lo-footer {
        border-top: 1px solid rgba(140, 163, 191, 0.24);
        padding-top: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .lo-metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
      .lo-metrics > div {
        background: rgba(5, 11, 27, 0.6);
        padding: 6px 8px;
        border-radius: 6px;
      }
      .lo-metrics span { display: block; font-family: var(--font-ui, "Rajdhani", sans-serif); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--oc-nebula-gray, #8CA3BF); }
      .lo-metrics strong { font-family: var(--font-body, "Inter", system-ui, sans-serif); font-variant-numeric: tabular-nums; font-size: 13px; font-weight: 700; color: var(--oc-starlight, #EAF4FF); }
      .lo-ok { color: var(--oc-success-green, #35D58A) !important; }
      .lo-warn { color: var(--oc-stellar-gold, #FF9D24) !important; }
      .lo-btn-row { display: flex; gap: 8px; }
      .lo-cta {
        flex: 1;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid var(--oc-stellar-gold, #FF9D24);
        background: linear-gradient(135deg, #d97706, var(--oc-stellar-gold, #FF9D24));
        color: var(--oc-deep-space, #050B1B);
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-weight: 700;
        font-size: 14.5px;
        letter-spacing: 0.04em;
        cursor: pointer;
      }
      .lo-cta:disabled { opacity: 0.45; cursor: not-allowed; }
      .lo-chip-ok {
        border-color: rgba(53, 213, 138, 0.45) !important;
        color: var(--oc-success-green, #35D58A) !important;
      }
      .lo-card-details { margin-top: 7px; }
      .lo-fuel-wrap { margin-top: 8px; }
      .lo-fuel-label {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: var(--oc-nebula-gray, #8CA3BF);
        margin-bottom: 3px;
      }
      .lo-fuel-track {
        height: 6px;
        border-radius: 999px;
        background: rgba(140, 163, 191, 0.2);
        overflow: hidden;
      }
      .lo-fuel-fill {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, var(--oc-electric-blue, #1677FF), var(--oc-cosmic-cyan, #19BFFF));
        transition: width 0.25s ease;
      }
      .lo-fuel-err { background: var(--oc-warning-red, #FF5364); }
      .lo-physics-tip {
        margin-top: 8px;
        padding: 7px 9px;
        border-radius: 6px;
        background: rgba(22, 119, 255, 0.14);
        border-left: 3px solid var(--oc-cosmic-cyan, #19BFFF);
        font-size: 12.5px;
        color: var(--oc-starlight, #EAF4FF);
        line-height: 1.45;
      }
      .lo-physics-tip strong { color: var(--oc-cosmic-cyan, #19BFFF); }
      .lo-tl-drawer { flex: 1; min-height: 0; display: flex; flex-direction: column; }
      .lo-tl-drawer[open] .oc-details-body { flex: 1; max-height: 280px; overflow-y: auto; }
      .lo-ok { color: var(--oc-success-green, #35D58A) !important; }
      .lo-status-ok { color: var(--oc-success-green, #35D58A); font-weight: 700; }
      .lo-phase-passed { border-color: rgba(53, 213, 138, 0.5); background: rgba(53, 213, 138, 0.12); }
      .lo-banner-ok { background: rgba(53, 213, 138, 0.14); border: 1px solid rgba(53, 213, 138, 0.48); color: var(--oc-success-green, #35D58A); }
      .lo-btn {
        background: rgba(5, 11, 27, 0.78);
        color: var(--oc-starlight, #EAF4FF);
        border: 1px solid rgba(140, 163, 191, 0.36);
        border-radius: 8px;
        padding: 8px 12px;
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .lo-telem {
        background: rgba(5, 11, 27, 0.72);
        border: 1px solid rgba(25, 191, 255, 0.3);
        border-radius: 8px;
        padding: 8px 10px;
      }
      .lo-telem-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 6px;
        color: var(--oc-starlight, #EAF4FF);
      }
      .lo-status-run { color: var(--oc-cosmic-cyan, #19BFFF); font-weight: 700; }
      .lo-status-ok { color: var(--oc-success-green, #35D58A); font-weight: 700; }
      .lo-status-err { color: var(--oc-warning-red, #FF5364); font-weight: 700; }
      .lo-telem-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
      .lo-gauge {
        background: rgba(16, 29, 51, 0.55);
        border: 1px solid rgba(140, 163, 191, 0.16);
        border-radius: 6px;
        padding: 5px 8px;
      }
      .lo-telem-grid span { display: block; font-family: var(--font-ui, "Rajdhani", sans-serif); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--oc-nebula-gray, #8CA3BF); }
      .lo-telem-grid strong { font-family: var(--font-body, "Inter", system-ui, sans-serif); font-variant-numeric: tabular-nums; font-size: 13px; font-weight: 700; color: var(--oc-starlight, #EAF4FF); }
      .lo-telem-grid strong small { font-size: 10.5px; font-weight: 500; color: var(--oc-nebula-gray, #8CA3BF); }
      .lo-telem-grid strong.lo-g-warn { color: var(--oc-stellar-gold, #FF9D24); }
      .lo-telem-grid strong.lo-g-err { color: var(--oc-warning-red, #FF5364); }
      .lo-g-track { height: 4px; margin-top: 4px; border-radius: 999px; background: rgba(140, 163, 191, 0.18); overflow: hidden; }
      .lo-g-fill { height: 100%; background: var(--oc-cosmic-cyan, #19BFFF); transition: width 120ms linear; }
      .lo-g-fill.lo-g-warn { background: var(--oc-stellar-gold, #FF9D24); }
      .lo-g-fill.lo-g-err { background: var(--oc-warning-red, #FF5364); }
      .lo-warp-group {
        display: inline-flex;
        border: 1px solid rgba(25, 191, 255, 0.36);
        border-radius: 8px;
        overflow: hidden;
        background: rgba(5, 11, 27, 0.85);
      }
      .lo-warp-btn {
        background: transparent;
        color: var(--oc-nebula-gray, #8CA3BF);
        border: none;
        border-right: 1px solid rgba(140, 163, 191, 0.18);
        padding: 7px 9px;
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-size: 12.5px;
        font-weight: 700;
        cursor: pointer;
      }
      .lo-warp-btn:last-child { border-right: none; }
      .lo-warp-btn.active {
        background: rgba(25, 191, 255, 0.22);
        color: var(--oc-cosmic-cyan, #19BFFF);
      }
      .lo-countdown {
        position: fixed;
        top: 68px;
        left: 50%;
        transform: translateX(-50%);
        pointer-events: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px 22px;
        border-radius: 10px;
        background: rgba(5, 11, 27, 0.82);
        border: 1px solid rgba(255, 157, 36, 0.65);
        box-shadow: 0 0 24px rgba(255, 157, 36, 0.22);
        z-index: 30;
      }
      .lo-countdown[hidden] { display: none; }
      .lo-cd-label {
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.14em;
        color: var(--oc-stellar-gold, #FF9D24);
      }
      .lo-countdown strong {
        font-family: var(--font-display, "Orbitron", sans-serif);
        font-size: 28px;
        font-weight: 800;
        letter-spacing: 0.08em;
        color: var(--oc-starlight, #EAF4FF);
      }
      .lo-scale-note {
        position: fixed;
        bottom: 14px;
        left: 50%;
        transform: translateX(-50%);
        pointer-events: none;
        padding: 4px 12px;
        border-radius: 999px;
        background: rgba(5, 11, 27, 0.72);
        border: 1px solid rgba(140, 163, 191, 0.26);
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-size: 11.5px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--oc-nebula-gray, #8CA3BF);
        z-index: 15;
      }
      .lo-phase {
        padding: 8px 10px;
        border-radius: 8px;
        background: rgba(5, 11, 27, 0.65);
        border: 1px solid rgba(140, 163, 191, 0.22);
      }
      .lo-phase-passed { border-color: rgba(53, 213, 138, 0.48); background: rgba(53, 213, 138, 0.12); }
      .lo-phase-active { border-color: var(--oc-cosmic-cyan, #19BFFF); background: rgba(25, 191, 255, 0.18); }
      .lo-phase-failed { border-color: var(--oc-warning-red, #FF5364); background: rgba(255, 83, 100, 0.16); }
      .lo-phase-skipped { opacity: 0.45; }
      .lo-phase-top { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--oc-starlight, #EAF4FF); }
      .lo-phase-summary { font-size: 12.5px; line-height: 1.45; color: var(--oc-nebula-gray, #8CA3BF); margin-top: 3px; }
      .lo-phase-fix { font-size: 12.5px; line-height: 1.45; color: var(--oc-stellar-gold, #FF9D24); margin-top: 4px; }
      .lo-result-banner { padding: 8px 10px; border-radius: 8px; font-size: 12.5px; }
      .lo-banner-ok { background: rgba(53, 213, 138, 0.14); border: 1px solid rgba(53, 213, 138, 0.48); color: var(--oc-success-green, #35D58A); }
      .lo-banner-warn { background: rgba(255, 157, 36, 0.16); border: 1px solid rgba(255, 157, 36, 0.5); color: var(--oc-stellar-gold, #FF9D24); }
      .lo-banner-err { background: rgba(255, 83, 100, 0.16); border: 1px solid rgba(255, 83, 100, 0.48); color: var(--oc-warning-red, #FF5364); }
      .lo-result-banner p { margin-top: 3px; color: var(--oc-starlight, #EAF4FF); line-height: 1.45; }
      .lo-science-warn {
        padding: 7px 9px;
        border-radius: 6px;
        background: rgba(255, 157, 36, 0.16);
        border: 1px solid rgba(255, 157, 36, 0.48);
        color: var(--oc-stellar-gold, #FF9D24);
        font-size: 12.5px;
        line-height: 1.45;
      }
      .lo-science-warn span { display: block; margin-top: 2px; color: var(--oc-starlight, #EAF4FF); }
      .lo-prelaunch-warn {
        max-height: 68px;
        overflow-y: auto;
        padding: 7px 9px;
        border-radius: 6px;
        background: rgba(255, 83, 100, 0.16);
        border: 1px solid rgba(255, 83, 100, 0.48);
        color: var(--oc-warning-red, #FF5364);
        font-size: 12.5px;
        line-height: 1.45;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .lo-prelaunch-warn strong { color: var(--oc-starlight, #EAF4FF); }
    `;
    document.head.appendChild(style);
  }
}
