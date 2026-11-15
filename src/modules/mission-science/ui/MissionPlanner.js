/**
 * @file src/modules/mission-science/ui/MissionPlanner.js
 * @owner Member 1 (Mission & Science)
 * @goal Interactive UI panel allowing players to choose a realistic NASA mission scenario
 *       and select scientific payload instruments while seeing budget, mass, and science trade-offs.
 */

import { getMissions } from "../data/missions.js";
import { getInstruments } from "../data/instruments.js";
import { validateMissionSpec } from "../../../shared/interfaces/MissionSpec.js";

const STYLE_ELEMENT_ID = "mission-planner-styles";

export class MissionPlanner {
  /**
   * @param {HTMLElement} container
   * @param {import('../../../core/GameState.js').GameState} gameState
   * @param {{ onProceed?: () => void }} [options]
   */
  constructor(container, gameState, options = {}) {
    this.container = container;
    this.gameState = gameState;
    this.onProceed = options.onProceed ?? null;

    this.missions = getMissions();
    this.instruments = getInstruments();

    this.selectedMissionId = null;
    this.selectedInstrumentIds = new Set();

    this.unsubscribe = null;
    this._root = null;

    this.handleClick = this.handleClick.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }

  /** Initialize the planner and bind event handlers. */
  mount() {
    if (!this.container || !this.gameState) {
      throw new Error("MissionPlanner requires a container and GameState.");
    }

    this._ensureStyles();

    if (this.gameState.mission) {
      this.selectedMissionId = this.gameState.mission.missionId;
      this.selectedInstrumentIds = new Set(
        this.gameState.mission.instruments.map((instrument) => instrument.id)
      );
    } else if (this.missions.length > 0) {
      this.selectMission(this.missions[0].id, false);
    }

    this.container.addEventListener("click", this.handleClick);
    this.container.addEventListener("change", this.handleChange);

    this.unsubscribe = this.gameState.subscribe(() => {
      if (this.gameState.mission) {
        this.selectedMissionId = this.gameState.mission.missionId;
        this.selectedInstrumentIds = new Set(
          this.gameState.mission.instruments.map((instrument) => instrument.id)
        );
      }
      this.render();
    });

    this.render();

    if (!this.gameState.mission && this.selectedMissionId) {
      this.updateGameState();
    }
  }

  /** Return the currently selected mission template. */
  getSelectedMission() {
    return this.missions.find((mission) => mission.id === this.selectedMissionId);
  }

  /**
   * Select a mission and initialize its recommended instruments.
   * @param {string} missionId
   * @param {boolean} [updateState=true]
   */
  selectMission(missionId, updateState = true) {
    const mission = this.missions.find((item) => item.id === missionId);
    if (!mission) return;

    this.selectedMissionId = missionId;
    this.selectedInstrumentIds = new Set(mission.recommendedInstrumentIds ?? []);

    if (updateState) {
      this.updateGameState();
    }

    this.render();
  }

  /** @param {MouseEvent} event */
  handleClick(event) {
    const proceedBtn = event.target.closest('[data-action="proceed-spacecraft"]');
    if (proceedBtn && this.container.contains(proceedBtn)) {
      this.onProceed?.();
      return;
    }

    const missionCard = event.target.closest("[data-mission-id]");
    if (!missionCard || !this.container.contains(missionCard)) return;
    this.selectMission(missionCard.dataset.missionId);
  }

  /** @param {Event} event */
  handleChange(event) {
    const checkbox = event.target.closest("[data-instrument-id]");
    if (!checkbox || !this.container.contains(checkbox)) return;

    const instrumentId = checkbox.dataset.instrumentId;
    if (checkbox.checked) {
      this.selectedInstrumentIds.add(instrumentId);
    } else {
      this.selectedInstrumentIds.delete(instrumentId);
    }

    this.updateGameState();
    this.render();
  }

  /** @returns {import('../../../shared/interfaces/MissionSpec.js').MissionSpec | null} */
  buildMissionSpec() {
    const mission = this.getSelectedMission();
    if (!mission) return null;

    const selectedInstruments = this.instruments
      .filter((instrument) => this.selectedInstrumentIds.has(instrument.id))
      .map((instrument) => ({
        id: instrument.id,
        name: instrument.name,
        massKg: instrument.massKg,
        powerWatts: instrument.powerWatts,
        dataRateKbps: instrument.dataRateKbps,
        costMillions: instrument.costMillions,
        sciencePoints: instrument.sciencePoints,
        model: instrument.model,
      }));

    return {
      missionId: mission.id,
      title: mission.name ?? mission.title ?? mission.id,
      targetOrbitId: this.getTargetOrbitId(mission),
      budgetMillions: mission.budgetCap,
      minSciencePoints: mission.minScienceScore,
      requiredDataRateKbps: mission.requiredDownlinkDataRate,
      targetDistanceKm: mission.missionDistance,
      instruments: selectedInstruments,
    };
  }

  /** @param {Object} mission */
  getTargetOrbitId(mission) {
    if (mission.targetOrbitId) {
      return mission.targetOrbitId;
    }

    const orbit = (mission.targetOrbit ?? "").toLowerCase();
    if (orbit.includes("geo")) return "GEO";
    if (orbit.includes("meo")) return "MEO";
    if (orbit.includes("lunar") || orbit.includes("moon")) return "LUNAR";
    if (orbit.includes("mars")) return "MARS";
    if (orbit.includes("leo")) return "LEO";
    return mission.targetOrbit || "LEO";
  }

  /** Publish the current selection to the shared GameState. */
  updateGameState() {
    const missionSpec = this.buildMissionSpec();
    if (missionSpec) {
      this.gameState.setMission(missionSpec);
    }
  }

  /** Calculate totals for the currently selected instruments. */
  getInstrumentTotals() {
    const selected = this.instruments.filter((instrument) =>
      this.selectedInstrumentIds.has(instrument.id)
    );

    return selected.reduce(
      (totals, instrument) => {
        totals.mass += instrument.massKg;
        totals.power += instrument.powerWatts;
        totals.dataRate += instrument.dataRateKbps;
        totals.cost += instrument.costMillions;
        totals.science += instrument.sciencePoints;
        return totals;
      },
      {
        count: selected.length,
        mass: 0,
        power: 0,
        dataRate: 0,
        cost: 0,
        science: 0,
      }
    );
  }

  /** @param {Object} instrument @param {Object} mission */
  isCompatible(instrument, mission) {
    if (!mission.objectives || !instrument.compatibleObjectives) {
      return true;
    }
    return instrument.compatibleObjectives.some((objective) =>
      mission.objectives.includes(objective)
    );
  }

  escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[character];
    });
  }

  /** Re-render the current mission and instrument selection. */
  render() {
    const mission = this.getSelectedMission();
    if (!mission) {
      this.container.innerHTML = `<section class="mp-shell"><p>No missions available.</p></section>`;
      return;
    }

    const totals = this.getInstrumentTotals();
    const scienceSatisfied = totals.science >= mission.minScienceScore;
    const hasInstruments = totals.count > 0;
    const budgetRemaining = mission.budgetCap - totals.cost;
    const recommendedSet = new Set(mission.recommendedInstrumentIds ?? []);

    const missionCards = this.missions
      .map((item) => {
        const selected = item.id === this.selectedMissionId;
        const title = item.name ?? item.title ?? item.id;
        const destination = item.destination ?? item.target ?? "Space";

        return `
          <button
            type="button"
            class="mp-mission-card ${selected ? "mp-card-selected" : ""}"
            data-mission-id="${this.escapeHTML(item.id)}"
            aria-pressed="${selected}"
          >
            <div class="mp-card-top">
              <strong>${this.escapeHTML(title)}</strong>
              <span class="mp-pill">${this.escapeHTML(item.difficulty ?? this.getTargetOrbitId(item))}</span>
            </div>
            <p class="mp-ref">${this.escapeHTML(item.nasaReference ?? "")}</p>
            <p class="mp-desc">${this.escapeHTML(item.description)}</p>
            <div class="mp-chips">
              <span>Target: ${this.escapeHTML(destination)}</span>
              <span>Orbit: ${this.escapeHTML(item.targetOrbit)}</span>
              <span>Dist: ${item.missionDistance.toLocaleString()} km</span>
              <span>Budget: $${item.budgetCap}M</span>
              <span>Science: ${item.minScienceScore}+ pts</span>
            </div>
          </button>
        `;
      })
      .join("");

    const orderedInstruments = [...this.instruments].sort((a, b) => {
      const aComp = this.isCompatible(a, mission) ? 0 : 1;
      const bComp = this.isCompatible(b, mission) ? 0 : 1;
      if (aComp !== bComp) return aComp - bComp;
      const aRec = recommendedSet.has(a.id) ? 0 : 1;
      const bRec = recommendedSet.has(b.id) ? 0 : 1;
      return aRec - bRec;
    });

    const instrumentCards = orderedInstruments
      .map((instrument) => {
        const selected = this.selectedInstrumentIds.has(instrument.id);
        const compatible = this.isCompatible(instrument, mission);
        const isRec = recommendedSet.has(instrument.id);

        return `
          <label class="mp-inst-card ${selected ? "mp-card-selected" : ""} ${
          compatible ? "" : "mp-inst-disabled"
        }">
            <input
              type="checkbox"
              data-instrument-id="${this.escapeHTML(instrument.id)}"
              ${selected ? "checked" : ""}
              ${compatible ? "" : "disabled"}
            />
            <div class="mp-inst-body">
              <div class="mp-card-top">
                <strong>${this.escapeHTML(instrument.name)}</strong>
                <span class="mp-pill ${isRec ? "mp-pill-rec" : ""}">
                  ${isRec ? "Recommended" : this.escapeHTML(instrument.category)}
                </span>
              </div>
              <div class="mp-chips">
                <span>${instrument.massKg} kg</span>
                <span>${instrument.powerWatts} W</span>
                <span>$${instrument.costMillions}M</span>
                <span>${instrument.sciencePoints} pts</span>
              </div>
              ${
                compatible
                  ? ""
                  : `<small class="mp-warn-text">Incompatible with ${this.escapeHTML(mission.destination ?? "target")} objectives.</small>`
              }
            </div>
          </label>
        `;
      })
      .join("");

    const canProceed = hasInstruments;

    this.container.innerHTML = `
      <div class="mp-shell">
        <aside class="mp-panel mp-panel-left">
          <header class="mp-header">
            <span class="mp-badge">PHASE 1 · MISSION BRIEF</span>
            <h2>Select NASA Mission</h2>
          </header>
          <div class="mp-scroll">${missionCards}</div>
        </aside>

        <aside class="mp-panel mp-panel-right">
          <header class="mp-header">
            <span class="mp-badge">SCIENTIFIC PAYLOAD</span>
            <h2>Instruments &amp; Trade-Offs</h2>
          </header>
          <div class="mp-scroll">${instrumentCards}</div>
          <footer class="mp-summary">
            <div class="mp-summary-grid">
              <div><span>Payload Mass</span><strong>${totals.mass.toFixed(1)} kg</strong></div>
              <div><span>Power Draw</span><strong>${totals.power.toFixed(0)} W</strong></div>
              <div><span>Payload Cost</span><strong>$${totals.cost.toFixed(1)}M</strong></div>
              <div><span>Remaining Cap</span><strong class="${budgetRemaining < 40 ? "mp-warn" : "mp-ok"}">$${budgetRemaining.toFixed(1)}M</strong></div>
            </div>
            <div class="mp-science-row">
              <span>Science Target: ${totals.science} / ${mission.minScienceScore} pts</span>
              <span class="${scienceSatisfied ? "mp-ok" : "mp-warn"}">
                ${scienceSatisfied ? "Target met" : `Need ${mission.minScienceScore - totals.science} more`}
              </span>
            </div>
            <progress class="mp-progress" value="${Math.min(totals.science, mission.minScienceScore)}" max="${Math.max(mission.minScienceScore, 1)}"></progress>
            ${
              this.onProceed
                ? `<button type="button" class="mp-cta" data-action="proceed-spacecraft" ${canProceed ? "" : "disabled"}>
                    Design Spacecraft →
                  </button>`
                : ""
            }
          </footer>
        </aside>
      </div>
    `;
  }

  /** Remove DOM nodes and event listeners when leaving the Mission phase. */
  destroy() {
    this.container.removeEventListener("click", this.handleClick);
    this.container.removeEventListener("change", this.handleChange);

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.container.innerHTML = "";
  }

  _ensureStyles() {
    if (typeof document === "undefined" || document.getElementById(STYLE_ELEMENT_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    style.textContent = `
      .mp-shell {
        pointer-events: none;
      }
      .mp-panel {
        pointer-events: auto;
        position: fixed;
        top: 72px;
        bottom: 16px;
        width: min(370px, calc(50vw - 24px));
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
      .mp-panel-left { left: 16px; }
      .mp-panel-right { right: 16px; }
      @media (max-width: 900px) {
        .mp-panel {
          width: calc(100vw - 32px);
          height: 40vh;
        }
        .mp-panel-left { bottom: auto; }
        .mp-panel-right { top: auto; bottom: 16px; }
      }
      .mp-badge {
        display: inline-block;
        font-size: 10px;
        letter-spacing: 0.08em;
        color: #38bdf8;
        font-weight: 700;
      }
      .mp-header h2 {
        font-size: 16px;
        font-weight: 700;
        margin-top: 2px;
      }
      .mp-scroll {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-right: 4px;
      }
      .mp-mission-card,
      .mp-inst-card {
        text-align: left;
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 8px;
        padding: 10px;
        color: #f8fafc;
        cursor: pointer;
        transition: border-color 0.15s ease, background 0.15s ease;
      }
      .mp-inst-card {
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }
      .mp-inst-card input {
        margin-top: 3px;
        accent-color: #38bdf8;
      }
      .mp-inst-body { flex: 1; min-width: 0; }
      .mp-inst-disabled { opacity: 0.48; cursor: not-allowed; }
      .mp-mission-card:hover,
      .mp-inst-card:not(.mp-inst-disabled):hover {
        border-color: rgba(56, 189, 248, 0.6);
      }
      .mp-card-selected {
        border-color: #38bdf8;
        background: rgba(14, 116, 144, 0.22);
      }
      .mp-card-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 6px;
        font-size: 13px;
        margin-bottom: 4px;
      }
      .mp-pill {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 999px;
        background: rgba(56, 189, 248, 0.16);
        color: #7dd3fc;
        white-space: nowrap;
      }
      .mp-pill-rec {
        background: rgba(34, 197, 94, 0.18);
        color: #86efac;
      }
      .mp-ref {
        font-size: 10.5px;
        color: #7dd3fc;
        margin-bottom: 4px;
      }
      .mp-desc {
        font-size: 11px;
        color: #94a3b8;
        line-height: 1.38;
        margin-bottom: 6px;
      }
      .mp-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .mp-chips span {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(51, 65, 85, 0.72);
        color: #e2e8f0;
      }
      .mp-warn-text {
        display: block;
        margin-top: 4px;
        font-size: 10px;
        color: #fbbf24;
      }
      .mp-summary {
        border-top: 1px solid rgba(148, 163, 184, 0.22);
        padding-top: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .mp-summary-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 6px;
      }
      .mp-summary-grid > div {
        background: rgba(30, 41, 59, 0.65);
        padding: 6px 8px;
        border-radius: 6px;
      }
      .mp-summary-grid span {
        display: block;
        font-size: 10px;
        color: #94a3b8;
      }
      .mp-summary-grid strong {
        font-size: 12px;
        color: #f8fafc;
      }
      .mp-science-row {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: #cbd5e1;
      }
      .mp-ok { color: #4ade80 !important; }
      .mp-warn { color: #fbbf24 !important; }
      .mp-progress {
        width: 100%;
        height: 6px;
        accent-color: #38bdf8;
      }
      .mp-cta {
        width: 100%;
        padding: 9px 12px;
        border-radius: 8px;
        border: 1px solid #38bdf8;
        background: linear-gradient(135deg, #0284c7, #0ea5e9);
        color: #fff;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
      }
      .mp-cta:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(style);
  }
}
