/**
 * @file src/modules/mission-science/ui/MissionPlanner.js
 * @owner Member 1 (Mission & Science)
 * @goal Immersive planetary mission selection screen with progressive disclosure:
 *       clean level-like mission cards on the left, unobstructed 3D planetary diorama in center,
 *       and a compact mission briefing + expandable technical specs on the bottom right.
 */

import { getMissions } from "../data/missions.js";
import { getInstruments } from "../data/instruments.js";
import { getStrings } from "../../../shared/i18n/index.js";

const STYLE_ELEMENT_ID = "mission-planner-styles";

const MISSION_CATEGORIES = {
  MISSION_LUNAR_ORBIT: "Lunar Exploration",
  MISSION_MARS_ORBIT: "Deep Space",
  MISSION_EARTH_LEO: "Earth Observation",
  MISSION_WEATHER_GEO: "Climate & Weather",
  MISSION_EARTH_SPACE_WEATHER: "Space Weather",
};

const OBJECTIVE_LABELS = {
  OBJ_GEOLOGICAL_MAPPING: "Geological Mapping",
  OBJ_ICE_DETECTION: "Water Ice Detection",
  OBJ_MINERAL_ANALYSIS: "Mineral Analysis",
  OBJ_SUBSURFACE_MAPPING: "Subsurface Radar Mapping",
  OBJ_SURFACE_TOPOGRAPHY: "Surface Topography",
  OBJ_THERMAL_MAPPING: "Thermal Mapping",
  OBJ_MAGNETIC_FIELD: "Magnetic Field Survey",
  OBJ_SOLAR_WIND_INTERACTION: "Solar Wind Interaction",
  OBJ_RADIATION_ENVIRONMENT: "Radiation Belt Mapping",
  OBJ_ATMOSPHERIC_STUDY: "Atmospheric Study",
  OBJ_CHEMICAL_COMPOSITION: "Chemical Composition",
  OBJ_SURFACE_IMAGING: "High-Res Surface Imaging",
  OBJ_SURFACE_COMPOSITION: "Surface Composition",
  OBJ_CLOUD_OBSERVATION: "Global Cloud Tracking",
  OBJ_SPACE_ENVIRONMENT: "Space Environment Monitoring",
};

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
      budgetMillions: this._getEffectiveBudget(mission),
      minSciencePoints: mission.minScienceScore,
      requiredDataRateKbps: mission.requiredDownlinkDataRate,
      targetDistanceKm: mission.missionDistance,
      instruments: selectedInstruments,
    };
  }

  _getEffectiveBudget(mission) {
    if (!mission) return 0;
    if (this.gameState?.tutorialMode && typeof mission.tutorialBudgetCap === "number") {
      return mission.tutorialBudgetCap;
    }
    return mission.budgetCap;
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

  _difficultyMeta(difficultyStr) {
    const lower = String(difficultyStr ?? "").toLowerCase();
    if (lower.includes("hard")) return { label: "Hard", cls: "oc-diff-hard" };
    if (lower.includes("easy")) return { label: "Easy", cls: "oc-diff-easy" };
    return { label: "Medium", cls: "oc-diff-med" };
  }

  _shortObjective(mission) {
    const desc = String(mission.description ?? "").trim();
    const firstSentence = desc.split(/\.(?=\s|$)/)[0];
    return firstSentence ? `${firstSentence}.` : "";
  }

  /** Re-render the adventure-style mission selection screen. */
  render() {
    const mission = this.getSelectedMission();
    if (!mission) {
      this.container.innerHTML = `<section class="mp-shell"><p>No missions available.</p></section>`;
      return;
    }

    const tutorialBadgeLabel = getStrings().welcome?.tutorialBadge ?? "Tutorial Mission";

    const missionCards = this.missions
      .map((item) => {
        const selected = item.id === this.selectedMissionId;
        const title = item.name ?? item.title ?? item.id;
        const destination = item.destination ?? item.target ?? "Space";
        const diff = this._difficultyMeta(item.difficulty);
        const category = MISSION_CATEGORIES[item.id] ?? "Space Exploration";
        const shortObj = this._shortObjective(item);
        const isTutorialCard = Boolean(item.isTutorialRecommended);

        return `
          <button
            type="button"
            class="mp-mission-card ${selected ? "mp-card-selected" : ""}"
            data-mission-id="${this.escapeHTML(item.id)}"
            aria-pressed="${selected}"
          >
            <div class="mp-card-top">
              <strong>${this.escapeHTML(title)}</strong>
              <span class="mp-pill ${diff.cls}">${diff.label}</span>
            </div>
            <div class="mp-meta-line">
              <span class="mp-dest">${this.escapeHTML(destination)}</span>
              <span class="mp-cat">${this.escapeHTML(category)}</span>
              ${isTutorialCard ? `<span class="mp-pill mp-pill-tutorial">${this.escapeHTML(tutorialBadgeLabel)}</span>` : ""}
            </div>
            <p class="mp-desc">${this.escapeHTML(shortObj)}</p>
            <div class="mp-card-footer">
              <span class="mp-reward">★ ${item.minScienceScore}+ Science Pts</span>
              <span class="mp-select-tag">${selected ? "Selected" : "Select Mission"}</span>
            </div>
          </button>
        `;
      })
      .join("");

    const selectedDiff = this._difficultyMeta(mission.difficulty);
    const effectiveBudget = this._getEffectiveBudget(mission);
    const objectivesHtml = (mission.objectives ?? [])
      .map((id) => `<li>${this.escapeHTML(OBJECTIVE_LABELS[id] ?? id)}</li>`)
      .join("");

    this.container.innerHTML = `
      <div class="mp-shell">
        <aside class="mp-panel mp-panel-left">
          <header class="mp-header">
            <span class="mp-badge">Phase 1 · Mission Selection</span>
            <h2>Choose Your Destination</h2>
          </header>
          <div class="mp-scroll" data-tour="mission-list">${missionCards}</div>
        </aside>

        <aside class="mp-brief-card" aria-label="Mission briefing">
          <header class="mp-brief-head">
            <div>
              <span class="mp-badge">${this.escapeHTML(mission.destination)} · ${this.escapeHTML(this.getTargetOrbitId(mission))}${mission.isTutorialRecommended ? ` · ${this.escapeHTML(tutorialBadgeLabel)}` : ""}</span>
              <h3>${this.escapeHTML(mission.name)}</h3>
            </div>
            <span class="mp-pill ${selectedDiff.cls}">${selectedDiff.label}</span>
          </header>

          <p class="mp-brief-obj">${this.escapeHTML(mission.description ?? this._shortObjective(mission))}</p>

          <div class="mp-brief-stats">
            <div>
              <span>Science Target</span>
              <strong class="mp-gold">${mission.minScienceScore}+ pts</strong>
            </div>
            <div>
              <span>Mission Budget</span>
              <strong>$${effectiveBudget}M</strong>
            </div>
          </div>

          <details class="oc-details">
            <summary>Mission Specs &amp; Objectives</summary>
            <div class="oc-details-body">
              <div class="mp-spec-grid">
                <div><span>Target Orbit</span><strong>${this.escapeHTML(mission.targetOrbit)}</strong></div>
                <div><span>Distance</span><strong>${mission.missionDistance.toLocaleString()} km</strong></div>
                <div><span>Downlink Req</span><strong>${mission.requiredDownlinkDataRate} kbps</strong></div>
                <div><span>Ref. Mass</span><strong>${mission.realReferenceMassKg?.toLocaleString() ?? "—"} kg</strong></div>
              </div>
              ${mission.nasaReference ? `<p class="mp-ref">${this.escapeHTML(mission.nasaReference)}</p>` : ""}
              ${objectivesHtml ? `<ul class="mp-obj-list">${objectivesHtml}</ul>` : ""}
            </div>
          </details>

          ${
            this.onProceed
              ? `<button type="button" class="mp-cta" data-action="proceed-spacecraft" data-tour="select-mission-btn">
                  Select Mission &amp; Build Spacecraft →
                </button>`
              : ""
          }
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
        width: min(360px, calc(46vw - 24px));
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 14px;
        background: rgba(16, 29, 51, 0.88);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(25, 191, 255, 0.34);
        border-radius: 12px;
        color: var(--oc-starlight, #EAF4FF);
        font-family: var(--font-body, "Inter", system-ui, sans-serif);
        z-index: 20;
        box-shadow: 0 20px 45px rgba(5, 11, 27, 0.55);
      }
      .mp-panel-left { left: 16px; }
      .mp-brief-card {
        pointer-events: auto;
        position: fixed;
        right: 16px;
        bottom: 16px;
        width: min(370px, calc(46vw - 24px));
        max-height: calc(100vh - 96px);
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 15px;
        background: rgba(16, 29, 51, 0.90);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(25, 191, 255, 0.38);
        border-radius: 12px;
        color: var(--oc-starlight, #EAF4FF);
        font-family: var(--font-body, "Inter", system-ui, sans-serif);
        z-index: 20;
        box-shadow: 0 20px 45px rgba(5, 11, 27, 0.6);
      }
      @media (max-width: 900px) {
        .mp-panel {
          width: calc(100vw - 32px);
          height: 36vh;
          bottom: auto;
        }
        .mp-brief-card {
          left: 16px;
          right: 16px;
          width: auto;
          max-height: 44vh;
        }
      }
      .mp-badge {
        display: inline-block;
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-size: 11px;
        letter-spacing: 0.08em;
        color: var(--oc-cosmic-cyan, #19BFFF);
        font-weight: 700;
        text-transform: uppercase;
      }
      .mp-header h2,
      .mp-brief-head h3 {
        font-family: var(--font-display, "Orbitron", sans-serif);
        font-size: 15.5px;
        font-weight: 700;
        margin-top: 2px;
        color: var(--oc-starlight, #EAF4FF);
      }
      .mp-brief-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
      }
      .mp-scroll {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-right: 4px;
      }
      .mp-mission-card {
        text-align: left;
        background: rgba(5, 11, 27, 0.72);
        border: 1px solid rgba(140, 163, 191, 0.24);
        border-radius: 9px;
        padding: 11px;
        color: var(--oc-starlight, #EAF4FF);
        cursor: pointer;
        transition: border-color 0.16s ease, background 0.16s ease, transform 0.16s ease;
      }
      .mp-mission-card:hover {
        border-color: rgba(25, 191, 255, 0.68);
        transform: translateY(-1px);
      }
      .mp-card-selected {
        border-color: var(--oc-cosmic-cyan, #19BFFF);
        background: rgba(22, 119, 255, 0.22);
        box-shadow: inset 0 0 18px rgba(25, 191, 255, 0.12);
      }
      .mp-card-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
        font-family: var(--font-body, "Inter", system-ui, sans-serif);
        font-size: 14px;
        font-weight: 700;
        line-height: 1.35;
        margin-bottom: 5px;
      }
      .mp-card-top strong {
        min-width: 0;
        overflow-wrap: break-word;
      }
      .mp-pill {
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 999px;
        white-space: nowrap;
      }
      .mp-pill-tutorial {
        background: rgba(25, 191, 255, 0.16);
        border: 1px solid rgba(25, 191, 255, 0.55);
        color: #7ee2ff;
      }
      .mp-meta-line {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 5px;
        font-size: 12px;
        font-weight: 600;
      }
      .mp-dest {
        color: var(--oc-cosmic-cyan, #19BFFF);
      }
      .mp-cat {
        color: var(--oc-nebula-gray, #8CA3BF);
      }
      .mp-cat::before {
        content: "• ";
      }
      .mp-desc,
      .mp-brief-obj {
        font-size: 13px;
        color: var(--oc-nebula-gray, #8CA3BF);
        line-height: 1.48;
      }
      .mp-card-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 8px;
        padding-top: 6px;
        border-top: 1px solid rgba(140, 163, 191, 0.16);
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-size: 13px;
        font-weight: 700;
      }
      .mp-reward {
        color: var(--oc-stellar-gold, #FF9D24);
      }
      .mp-select-tag {
        color: var(--oc-cosmic-cyan, #19BFFF);
      }
      .mp-brief-stats {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }
      .mp-brief-stats > div,
      .mp-spec-grid > div {
        background: rgba(5, 11, 27, 0.62);
        padding: 7px 9px;
        border-radius: 7px;
      }
      .mp-brief-stats span,
      .mp-spec-grid span {
        display: block;
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--oc-nebula-gray, #8CA3BF);
      }
      .mp-brief-stats strong,
      .mp-spec-grid strong {
        font-family: var(--font-body, "Inter", system-ui, sans-serif);
        font-variant-numeric: tabular-nums;
        font-size: 13px;
        font-weight: 700;
        color: var(--oc-starlight, #EAF4FF);
      }
      .mp-gold {
        color: var(--oc-stellar-gold, #FF9D24) !important;
      }
      .mp-spec-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 6px;
      }
      .mp-ref {
        font-size: 12.5px;
        line-height: 1.45;
        color: var(--oc-cosmic-cyan, #19BFFF);
      }
      .mp-obj-list {
        padding-left: 16px;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 4px 10px;
        font-size: 12.5px;
        line-height: 1.45;
        color: var(--oc-starlight, #EAF4FF);
      }
      .mp-cta {
        width: 100%;
        padding: 10px 14px;
        border-radius: 8px;
        border: 1px solid var(--oc-stellar-gold, #FF9D24);
        background: linear-gradient(135deg, #d97706, var(--oc-stellar-gold, #FF9D24));
        color: var(--oc-deep-space, #050B1B);
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-weight: 700;
        font-size: 15px;
        letter-spacing: 0.04em;
        cursor: pointer;
        box-shadow: 0 6px 20px rgba(255, 157, 36, 0.28);
        transition: transform 0.15s ease, filter 0.15s ease;
      }
      .mp-cta:hover {
        transform: translateY(-1px);
        filter: brightness(1.08);
      }
    `;
    document.head.appendChild(style);
  }
}
