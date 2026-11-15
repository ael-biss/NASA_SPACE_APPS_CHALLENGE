/**
 * @file src/modules/game-interface/ui/MissionResultsModal.js
 * @owner Member 4 (Interface & Integration)
 * @goal Rewarding end-of-mission debrief modal presenting Mission Success / Anomaly status,
 *       Science Points & unlocked achievements, educational physics insights, and collapsible
 *       Level-3 subsystem health & flight timeline details.
 */

import { getMissionById } from "../../mission-science/data/missions.js";
import { downloadResultCardPng, saveBestDesign } from "../logic/DesignRecordsStore.js";

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
   * Display mission outcome, top summary, real-vs-design comparison, best record,
   * download PNG action, and collapsed detailed engineering breakdown.
   * @param {{ score: number, grade: string, summary: string, checks: Array<Object>, budget?: Object }} evaluationResult
   * @param {import('../../../shared/interfaces/LaunchResult.js').LaunchResult | null} launchResult
   * @param {{ onModifyDesign: () => void, onReplayLaunch?: () => void, onNewMission: () => void }} actions
   * @param {{ mission?: Object, spacecraft?: Object }} [context]
   */
  show(evaluationResult, launchResult, actions, context = {}) {
    const mission = context?.mission ?? null;
    const spacecraft = context?.spacecraft ?? null;
    const catalogMission = mission?.id ? getMissionById(mission.id) : null;
    const realRef = catalogMission?.realReference ?? mission?.realReference ?? null;

    const checks = Array.isArray(evaluationResult.checks) ? evaluationResult.checks : [];
    const passedChecksCount = checks.filter((c) => c.passed).length;
    const failedChecks = checks.filter((c) => !c.passed);
    const allChecksPassed = checks.length === 0 || passedChecksCount === checks.length;
    const passed = Boolean(launchResult?.success) && evaluationResult.score >= 70 && allChecksPassed;
    const failedPhase = launchResult?.phases?.find((p) => p.status === "failed");

    const achievements = this._computeAchievements(evaluationResult, launchResult, passed);
    const insightText = this._buildEducationalInsight(evaluationResult, launchResult, passed);
    const { record: bestRecord, isNewBest } = saveBestDesign({
      mission: catalogMission ? { ...catalogMission, ...mission } : mission,
      spacecraft,
      launchResult,
      evaluationResult,
      passed,
    });

    const failureReportHtml =
      launchResult && !launchResult.success
        ? `
        <section class="gi-failure-box">
          <div class="gi-failure-title">
            WHAT WENT WRONG · LOST AT ${this._esc(failedPhase?.name ?? launchResult.failedPhaseId ?? "LAUNCH")}
          </div>
          <p><strong>Cause:</strong> ${this._esc(launchResult.failureCause || launchResult.failureReason)}</p>
          <p class="gi-fix"><strong>How to Fix:</strong> ${this._esc(launchResult.failureFix || "Review spacecraft engineering warnings and launch vehicle capacity.")}</p>
        </section>
      `
        : !passed && failedChecks.length > 0
          ? `
        <section class="gi-warn-box">
          <div class="gi-warn-title">WHAT NEEDS FIXING · ${failedChecks.length} OBJECTIVE${failedChecks.length > 1 ? "S" : ""} MISSED</div>
          <p><strong>Primary Issue (${this._esc(failedChecks[0].label)}):</strong> ${this._esc(failedChecks[0].detail)}</p>
          <p class="gi-fix"><strong>How to Fix:</strong> Click <em>Retry with Fixes</em> to adjust your spacecraft design while keeping all current parts selected.</p>
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

    const checksHtml = checks
      .map(
        (c) => `
        <div class="gi-check ${c.passed ? "gi-check-pass" : "gi-check-fail"}">
          <strong>${c.passed ? "✓" : "✕"} ${this._esc(c.label)}</strong>
          <span>${this._esc(c.detail)}</span>
        </div>
      `
      )
      .join("");

    let dvDisplay = "—";
    if (launchResult) {
      if (launchResult.success) {
        const remainingDv = launchResult.remainingDeltaVMs;
        dvDisplay =
          typeof remainingDv === "number"
            ? `${remainingDv >= 0 ? "+" : ""}${Math.round(remainingDv).toLocaleString()} m/s`
            : "—";
      } else {
        const fp = launchResult.failedPhaseId;
        if (!fp || fp === "liftoff" || fp === "max-q" || fp === "ascent") {
          const stageLabel = fp === "liftoff" ? "liftoff" : fp === "max-q" ? "max-q" : "ascent";
          dvDisplay = `N/A (lost at ${stageLabel})`;
        } else if (typeof launchResult.deltaVMarginMs === "number") {
          const m = Math.round(launchResult.deltaVMarginMs);
          dvDisplay = `${m >= 0 ? "+" : ""}${m.toLocaleString()} m/s`;
        } else if (
          typeof launchResult.deltaVAvailableMs === "number" &&
          typeof launchResult.deltaVRequiredMs === "number"
        ) {
          const m = Math.round(launchResult.deltaVAvailableMs - launchResult.deltaVRequiredMs);
          dvDisplay = `${m >= 0 ? "+" : ""}${m.toLocaleString()} m/s`;
        } else {
          dvDisplay = "N/A (lost at ascent)";
        }
      }
    }

    const budgetInfo = evaluationResult?.budget;
    const budgetCardLabel = budgetInfo ? "Total Cost / Budget" : "Flight Cost";
    const budgetCardValue = budgetInfo
      ? `$${budgetInfo.totalCost.toFixed(1)}M / $${budgetInfo.startingBudget}M`
      : launchResult?.launchCostMillions
        ? `$${launchResult.launchCostMillions.toFixed(1)}M`
        : "—";
    const budgetCardSub = budgetInfo
      ? budgetInfo.budgetRemaining >= 0
        ? `$${budgetInfo.budgetRemaining.toFixed(1)}M left`
        : `-$${Math.abs(budgetInfo.budgetRemaining).toFixed(1)}M over`
      : "";
    const budgetCardCls = budgetInfo
      ? budgetInfo.budgetRemaining < 0
        ? "gi-bad"
        : "gi-ok"
      : "";

    const badgeText = passed
      ? "MISSION ACCOMPLISHED"
      : launchResult?.success
        ? "ORBIT REACHED · PARTIAL GOALS"
        : "MISSION ANOMALY";

    const headline = passed
      ? "Mission Success!"
      : launchResult?.success
        ? "Orbit Achieved (With Issues)"
        : "Mission Failure Report";

    const playerMassKg = spacecraft?.totalMassKg ? Math.round(spacecraft.totalMassKg) : null;
    const playerOrbitLabel = mission?.targetOrbit || launchResult?.targetOrbitId || "—";
    const playerCostDisplay = budgetInfo
      ? `$${budgetInfo.totalCost.toFixed(1)}M`
      : launchResult?.launchCostMillions
        ? `$${launchResult.launchCostMillions.toFixed(1)}M`
        : "—";
    const playerRocket = launchResult?.rocketName || "Launch Vehicle";

    const compareCardHtml = realRef
      ? `
        <section class="gi-compare-card" aria-label="Real mission versus your design">
          <div class="gi-compare-head">
            <span>Benchmark · Real NASA Mission vs Your Design</span>
            ${
              bestRecord
                ? `<span class="gi-best-pill">${isNewBest ? "★ New Personal Best!" : `Best Saved: ${bestRecord.score}/100 (${this._esc(bestRecord.grade)})`}</span>`
                : ""
            }
          </div>
          <div class="gi-compare-grid">
            <div class="gi-compare-col gi-compare-real">
              <strong>${this._esc(realRef.name)}</strong>
              <div><span>Mass</span><b>${realRef.massKg.toLocaleString()} kg</b></div>
              <div><span>Orbit</span><b>${this._esc(realRef.orbitLabel)}</b></div>
              <div><span>Cost</span><b>$${realRef.costMillions}M</b></div>
              <div><span>Launcher</span><b>${this._esc(realRef.launcher)}</b></div>
            </div>
            <div class="gi-compare-col gi-compare-yours">
              <strong>Your Design${spacecraft?.selection?.structureId ? "" : ""}</strong>
              <div><span>Mass</span><b>${playerMassKg !== null ? `${playerMassKg.toLocaleString()} kg` : "—"}</b></div>
              <div><span>Orbit</span><b>${this._esc(playerOrbitLabel)}</b></div>
              <div><span>Cost</span><b>${this._esc(playerCostDisplay)}</b></div>
              <div><span>Launcher</span><b>${this._esc(playerRocket)}</b></div>
            </div>
          </div>
        </section>
      `
      : bestRecord
        ? `<div class="gi-best-bar"><span class="gi-best-pill">${isNewBest ? "★ New Personal Best!" : `Best Saved: ${bestRecord.score}/100 (${this._esc(bestRecord.grade)})`}</span></div>`
        : "";

    const cardExportSummary = {
      missionId: mission?.id ?? launchResult?.targetOrbitId ?? "mission",
      missionName: mission?.name ?? launchResult?.targetOrbitId ?? "Space Mission",
      badgeText,
      headlineSub: evaluationResult.summary,
      passed,
      orbitReached: Boolean(launchResult?.success),
      grade: evaluationResult.grade,
      score: evaluationResult.score,
      orbitLabel: playerOrbitLabel,
      dvDisplay,
      playerMassKg: playerMassKg ?? 0,
      costDisplay: playerCostDisplay,
      rocketName: playerRocket,
      realName: realRef?.name ?? "Reference Mission",
      realMassKg: realRef?.massKg ?? "—",
      realOrbit: realRef?.orbitLabel ?? playerOrbitLabel,
      realCostM: realRef?.costMillions ?? "—",
      realLauncher: realRef?.launcher ?? "—",
      bestScore: bestRecord?.score ?? null,
      bestGrade: bestRecord?.grade ?? "",
    };

    this.container.innerHTML = `
      <div class="gi-modal-backdrop">
        <article class="gi-modal" role="dialog" aria-modal="true" aria-label="Mission Results">
          <header class="gi-modal-header">
            <div>
              <span class="gi-modal-badge ${passed ? "gi-ok" : launchResult?.success ? "gi-warn" : "gi-bad"}">${badgeText}</span>
              <h2>${headline}</h2>
              <p class="gi-modal-sub">${this._esc(evaluationResult.summary)}</p>
            </div>
            <div class="gi-grade-box ${passed ? "gi-grade-pass" : "gi-grade-fail"}">
              <span class="gi-grade">${this._esc(evaluationResult.grade)}</span>
              <small>${evaluationResult.score}/100</small>
            </div>
          </header>

          ${failureReportHtml}

          <section class="gi-reward-strip">
            <div class="gi-reward-card">
              <span>Objectives Passed</span>
              <strong class="${allChecksPassed ? "gi-ok" : "gi-warn"}">${passedChecksCount} / ${checks.length}</strong>
            </div>
            <div class="gi-reward-card">
              <span>Target Orbit</span>
              <strong class="gi-cyan">${this._esc(launchResult?.targetOrbitId ?? "—")}</strong>
            </div>
            <div class="gi-reward-card">
              <span>Δv Margin</span>
              <strong>${this._esc(dvDisplay)}</strong>
            </div>
            <div class="gi-reward-card" title="${budgetInfo ? `Instruments $${budgetInfo.instrumentsCost.toFixed(1)}M + Craft $${budgetInfo.spacecraftCost.toFixed(1)}M + Launch $${budgetInfo.launchCost.toFixed(1)}M` : ""}">
              <span>${budgetCardLabel}</span>
              <strong class="${budgetCardCls}">${budgetCardValue}${budgetCardSub ? ` (${budgetCardSub})` : ""}</strong>
            </div>
          </section>

          ${compareCardHtml}

          ${
            achievements.length > 0
              ? `
            <section class="gi-achievements" aria-label="Achievements earned">
              ${achievements.map((a) => `<span class="gi-ach-badge">★ ${this._esc(a)}</span>`).join("")}
            </section>
          `
              : ""
          }

          <section class="gi-insight-box">
            <strong>Educational Insight</strong>
            <p>${this._esc(insightText)}</p>
          </section>

          <details class="oc-details gi-breakdown">
            <summary>Detailed Breakdown (${checks.length} Checks, Flight Timeline &amp; Subsystem Health)</summary>
            <div class="oc-details-body">
              <section class="gi-check-list">${checksHtml}</section>
              <div class="gi-modal-grid" style="margin-top:10px">
                <section class="gi-modal-col">
                  <h3>Flight Timeline</h3>
                  <div class="gi-tl-list">${timelineHtml}</div>
                </section>
                <section class="gi-modal-col">
                  <h3>Subsystem Health</h3>
                  <div class="gi-health-list">${healthHtml}</div>
                </section>
              </div>
            </div>
          </details>

          <footer class="gi-modal-actions">
            <button type="button" class="gi-btn gi-btn-download" data-modal-action="download-card">Download Result Card (PNG)</button>
            <button type="button" class="gi-btn gi-btn-primary" data-modal-action="modify">Retry with Fixes</button>
            <button type="button" class="gi-btn" data-modal-action="replay">Change Rocket / Replay</button>
            <button type="button" class="gi-btn" data-modal-action="new">New Mission</button>
          </footer>
        </article>
      </div>
    `;

    this.container.querySelector('[data-modal-action="download-card"]')?.addEventListener("click", () => {
      downloadResultCardPng(cardExportSummary);
    });
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

  _computeAchievements(evaluationResult, launchResult, passed) {
    const badges = [];
    const checks = evaluationResult?.checks ?? [];
    const budgetOk = checks.find((c) => c.label === "Mission budget")?.passed;
    const scienceOk = checks.find((c) => c.label === "Scientific objectives")?.passed;
    const reachedOrbit = Boolean(launchResult?.success);

    if (passed && reachedOrbit) badges.push("Mission Accomplished");
    if (reachedOrbit) badges.push("Orbit Capture");
    if (reachedOrbit && passed && budgetOk) badges.push("Budget Discipline");
    if (reachedOrbit && scienceOk) badges.push("Science Return Met");
    if (
      passed &&
      reachedOrbit &&
      (launchResult?.targetOrbitId === "LUNAR" || launchResult?.targetOrbitId === "MARS")
    ) {
      badges.push("Deep Space Explorer");
    }
    if (!passed && launchResult) badges.push("Flight Telemetry Recovered");
    return badges;
  }

  _buildEducationalInsight(evaluationResult, launchResult, passed) {
    if (passed) {
      return "Orbital insertion requires balancing spacecraft dry mass, solar/battery sizing, high-gain pointing accuracy, and propellant Δv so gravity captures your craft cleanly.";
    }

    if (launchResult && !launchResult.success) {
      const mode = launchResult.failureMode || "";
      const causeLower = String(launchResult.failureCause || launchResult.failureReason || "").toLowerCase();

      if (mode === "explosion") {
        if (causeLower.includes("twr") || causeLower.includes("thrust-to-weight")) {
          return "Physics Principle (Thrust-to-Weight Ratio): At ignition, F_thrust must exceed stack weight (TWR = F / (m·g₀) > 1.0). A TWR near or below 1.0 wastes propellant hovering in gravity losses and cannot clear the pad.";
        }
        return "Physics Principle (Launch Vehicle Capacity): A rocket's payload ceiling reflects the structural adapter load and upper-stage energy needed to reach orbit. Exceeding max payload mass prevents reaching safe liftoff acceleration.";
      }

      if (mode === "structural-breakup") {
        if (causeLower.includes("max-q") || causeLower.includes("fairing") || causeLower.includes("dynamic pressure")) {
          return "Physics Principle (Max-Q Aerodynamic Pressure): Dynamic pressure q = ½ρv² peaks around transonic climb where dense lower air meets supersonic speed, shearing unshielded arrays or undersized fairings.";
        }
        if (causeLower.includes("vibration") || causeLower.includes("acoustic")) {
          return "Physics Principle (Vibro-Acoustic Fatigue): Rocket engine exhaust and supersonic boundary-layer noise transmit broadband RMS acceleration through the payload adapter, fracturing delicate optical mounts unless damped.";
        }
        if (causeLower.includes("carried mass") || causeLower.includes("buckled")) {
          return "Physics Principle (Axial Structural Buckling): Under peak launch acceleration, every kilogram carried by the spacecraft bus exerts a compressive force equal to m × g_peak across the primary load-bearing cylinder.";
        }
        return "Physics Principle (Ascent G-Load Surge): Per F = m·a, as propellant mass drains away during burn, vehicle acceleration spikes near stage burnout. Unthrottled solid motors generate severe terminal g-loads compared to throttled liquid cores.";
      }

      if (mode === "suborbital-fall") {
        return "Physics Principle (Orbital Velocity): Reaching space altitude alone is not orbit—the spacecraft must accelerate horizontally to circular speed v = √(μ/r) (~7.6 km/s in LEO) plus ~1.8 km/s of gravity and drag ascent losses.";
      }

      if (mode === "power-loss") {
        if (causeLower.includes("au") || causeLower.includes("sunlight")) {
          return "Physics Principle (Inverse-Square Solar Flux): Solar irradiance drops with the square of distance from the Sun (1 / r²). At Mars (1.52 AU), solar panels only receive ~43% of Earth-orbit power.";
        }
        return "Physics Principle (Orbital Eclipse Energy): Every orbit passes behind its host body into shadow; batteries must store E = P_load × t_eclipse watt-hours to keep flight computers and heaters alive until sunrise.";
      }

      if (mode === "thermal-failure") {
        if (causeLower.includes("cooled") || causeLower.includes("freezing")) {
          return "Physics Principle (Deep-Space Radiative Cooling): Vacuum prevents convective warming, so in deep shadow a spacecraft radiates heat away via Stefan-Boltzmann law (Q ∝ T⁴) and freezes propellant valves without heaters or MLI.";
        }
        return "Physics Principle (Vacuum Heat Rejection): Without air convection, excess electrical waste heat from avionics and transmitters builds up internally unless rejected to deep space by radiators.";
      }

      if (mode === "radiation-fried") {
        return "Physics Principle (Ionizing Radiation Dose): Van Allen trapped belts and solar particle events deposit ionizing dose (krad) in silicon electronics, causing single-event latch-ups unless mitigated by rad-hard parts and high-Z shielding.";
      }

      if (mode === "signal-lost") {
        if (causeLower.includes("beam") || causeLower.includes("pointing")) {
          return "Physics Principle (High-Gain Beamwidth): Focusing radio energy across millions of kilometers shrinks antenna beamwidth to under a degree, demanding precision reaction wheels and star trackers to keep Earth locked.";
        }
        return "Physics Principle (Free-Space Path Loss): Radio signal strength falls off by 1/R², so lunar and interplanetary missions require high-gain parabolic or Ka-band dishes to close the link budget.";
      }

      if (mode === "missed-capture") {
        if (causeLower.includes("stability") || causeLower.includes("light-delay")) {
          return "Physics Principle (Autonomous Capture Burn): Signal light-time delay prevents real-time Earth control at Mars, so precision reaction wheels must hold the thruster vector steady throughout orbital insertion.";
        }
        if (causeLower.includes("cold gas")) {
          return "Physics Principle (Specific Impulse Efficiency): Per Tsiolkovsky's rocket equation Δv = Isp · g₀ · ln(m₀/mf), low-Isp cold gas thrusters cannot supply the km/s impulse needed for planetary capture.";
        }
        return "Physics Principle (Hyperbolic Overshoot): Arriving at a target planet with excess velocity requires a retrograde Δv capture burn at periapsis; without sufficient Δv, gravity bends the path into an uncaptured flyby.";
      }
    }

    const failedCheck = (evaluationResult?.checks ?? []).find((c) => !c.passed);
    if (failedCheck) {
      if (failedCheck.label === "Mission budget") {
        return "Systems Engineering Insight: Spacecraft mass drives launch vehicle class, which dominates mission cost—right-sizing subsystems frees budget for launch and science instruments.";
      }
      if (failedCheck.label === "Downlink data rate" || failedCheck.label === "Communication range") {
        return "Systems Engineering Insight: High-resolution instruments generate megabits per second; the antenna and power subsystem must scale together to downlink collected science back to Earth.";
      }
      return `Systems Engineering Insight: Reaching orbit completed the flight trajectory, but "${failedCheck.label}" fell short—${failedCheck.detail}`;
    }
    return "Review propulsion Δv, thermal/radiation survival limits, power margin, and payload budget before launching again.";
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
