
/**
 * @file src/modules/mission-science/ui/MissionPlanner.js
 * @owner Member 1 (Mission & Science)
 * @goal Interactive UI panel allowing players to choose a mission objective and select
 *       scientific payload instruments while seeing budget, mass, and science trade-offs.
 */

import { getMissions } from "../data/missions.js";
import { getInstruments } from "../data/instruments.js";
import { validateMissionSpec } from "../../../shared/interfaces/MissionSpec.js";

export class MissionPlanner {
  /**
   * @param {HTMLElement} container
   * @param {import('../../../core/GameState.js').GameState} gameState
   */
  constructor(container, gameState) {
    this.container = container;
    this.gameState = gameState;

    this.missions = getMissions();
    this.instruments = getInstruments();

    this.selectedMissionId = null;
    this.selectedInstrumentIds = new Set();

    this.unsubscribe = null;

    this.handleClick = this.handleClick.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }

  /**
   * Initialize the planner and bind event handlers.
   */
  mount() {
    if (!this.container || !this.gameState) {
      throw new Error("MissionPlanner requires a container and GameState.");
    }

    // Restore an existing selection if one is already stored.
    if (this.gameState.mission) {
      this.selectedMissionId = this.gameState.mission.missionId;

      this.selectedInstrumentIds = new Set(
        this.gameState.mission.instruments.map((instrument) => instrument.id)
      );
    } else if (this.missions.length > 0) {
      // Otherwise, start with the first available mission.
      this.selectMission(this.missions[0].id, false);
    }

    // Use event delegation so re-rendering does not duplicate listeners.
    this.container.addEventListener("click", this.handleClick);
    this.container.addEventListener("change", this.handleChange);

    // Keep the planner synchronized with shared GameState.
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

    // Publish the initial selection.
    if (!this.gameState.mission && this.selectedMissionId) {
      this.updateGameState();
    }
  }

  /**
   * Return the currently selected mission template.
   */
  getSelectedMission() {
    return this.missions.find(
      (mission) => mission.id === this.selectedMissionId
    );
  }

  /**
   * Select a mission and initialize its recommended instruments.
   *
   * @param {string} missionId
   * @param {boolean} updateState
   */
  selectMission(missionId, updateState = true) {
    const mission = this.missions.find((item) => item.id === missionId);

    if (!mission) return;

    this.selectedMissionId = missionId;

    // Start with the instruments recommended for this mission.
    this.selectedInstrumentIds = new Set(
      mission.recommendedInstrumentIds ?? []
    );

    if (updateState) {
      this.updateGameState();
    }

    this.render();
  }

  /**
   * Handle mission-card selection.
   * @param {MouseEvent} event
   */
  handleClick(event) {
    const missionCard = event.target.closest("[data-mission-id]");

    if (!missionCard || !this.container.contains(missionCard)) return;

    this.selectMission(missionCard.dataset.missionId);
  }

  /**
   * Handle instrument checkbox changes.
   * @param {Event} event
   */
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

  /**
   * Convert the selected mission and instruments into the shared MissionSpec.
   *
   * @returns {import('../../../shared/interfaces/MissionSpec.js').MissionSpec | null}
   */
  buildMissionSpec() {
    const mission = this.getSelectedMission();

    if (!mission) return null;

    const selectedInstruments = this.instruments
      .filter((instrument) =>
        this.selectedInstrumentIds.has(instrument.id)
      )
      .map((instrument) => ({
        id: instrument.id,
        name: instrument.name,
        massKg: instrument.massKg,
        powerWatts: instrument.powerWatts,
        dataRateKbps: instrument.dataRateKbps,
        costMillions: instrument.costMillions,
        sciencePoints: instrument.sciencePoints,
      }));

    return {
      missionId: mission.id,
      title: mission.title ?? mission.name,

      // Translate the mission template's orbit into the shared orbit key.
      targetOrbitId: this.getTargetOrbitId(mission),

      budgetMillions: mission.budgetCap,
      minSciencePoints: mission.minScienceScore,
      requiredDataRateKbps: mission.requiredDownlinkDataRate,
      targetDistanceKm: mission.missionDistance,

      instruments: selectedInstruments,
    };
  }

  /**
   * Convert mission template orbit names into the shared MissionSpec orbit key.
   *
   * Surface missions currently use the closest available destination key.
   * The shared interface should eventually distinguish orbit from destination.
   *
   * @param {Object} mission
   * @returns {string}
   */
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

    // Fallback for mission templates that already use an orbit key.
    return mission.targetOrbit || "LEO";
  }

  /**
   * Publish the current selection to the shared GameState.
   */
  updateGameState() {
    const missionSpec = this.buildMissionSpec();

    if (missionSpec) {
      this.gameState.setMission(missionSpec);
    }
  }

  /**
   * Calculate totals for the currently selected instruments.
   */
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

  /**
   * Check whether an instrument supports at least one mission objective.
   *
   * @param {Object} instrument
   * @param {Object} mission
   * @returns {boolean}
   */
  isCompatible(instrument, mission) {
    if (!mission.objectives || !instrument.compatibleObjectives) {
      return true;
    }

    return instrument.compatibleObjectives.some((objective) =>
      mission.objectives.includes(objective)
    );
  }

  /**
   * Escape dynamic text before inserting it into HTML.
   * @param {*} value
   * @returns {string}
   */
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

  /**
   * Re-render the current mission and instrument selection.
   */
  render() {
    const mission = this.getSelectedMission();

    if (!mission) {
      this.container.innerHTML = `
        <section class="mission-planner">
          <p>No missions available.</p>
        </section>
      `;
      return;
    }

    const totals = this.getInstrumentTotals();

    const scienceSatisfied =
      totals.science >= mission.minScienceScore;

    const budgetRemaining =
      mission.budgetCap - totals.cost;

    const missionCards = this.missions.map((item) => {
      const selected = item.id === this.selectedMissionId;

      return `
        <button
          type="button"
          class="mission-card ${selected ? "selected" : ""}"
          data-mission-id="${this.escapeHTML(item.id)}"
          aria-pressed="${selected}"
        >
          <h3>${this.escapeHTML(item.title ?? item.name)}</h3>
          <p>Destination: ${this.escapeHTML(item.target ?? item.destination)}</p>
          <p>Orbit: ${this.escapeHTML(item.targetOrbit)}</p>
          <p>Budget: $${item.budgetCap}M</p>
          <p>Required science: ${item.minScienceScore} points</p>
        </button>
      `;
    }).join("");

    const instrumentCards = this.instruments.map((instrument) => {
      const selected = this.selectedInstrumentIds.has(instrument.id);
      const compatible = this.isCompatible(instrument, mission);

      return `
        <label class="instrument-card ${selected ? "selected" : ""} ${
          compatible ? "" : "incompatible"
        }">
          <input
            type="checkbox"
            data-instrument-id="${this.escapeHTML(instrument.id)}"
            ${selected ? "checked" : ""}
            ${compatible ? "" : "disabled"}
          />

          <div class="instrument-info">
            <strong>${this.escapeHTML(instrument.name)}</strong>
            <span>${this.escapeHTML(instrument.category)}</span>

            <div class="instrument-stats">
              <span>Mass: ${instrument.massKg} kg</span>
              <span>Power: ${instrument.powerWatts} W</span>
              <span>Cost: $${instrument.costMillions}M</span>
              <span>Science: ${instrument.sciencePoints} pts</span>
            </div>

            ${
              compatible
                ? ""
                : '<small>Not compatible with this mission objectives.</small>'
            }
          </div>
        </label>
      `;
    }).join("");

    this.container.innerHTML = `
      <section class="mission-planner">

        <header class="mission-planner-header">
          <h2>Mission & Science Planner</h2>
          <p>Choose a scientific mission and configure its payload.</p>
        </header>

        <section class="mission-selection">
          <h3>1. Select a mission</h3>
          <div class="mission-grid">
            ${missionCards}
          </div>
        </section>

        <section class="instrument-selection">
          <h3>2. Select scientific instruments</h3>
          <p>
            Choose instruments compatible with your mission objectives.
          </p>

          <div class="instrument-grid">
            ${instrumentCards}
          </div>
        </section>

        <section class="mission-summary">
          <h3>3. Payload summary</h3>

          <div class="summary-grid">
            <div class="summary-item">
              <span>Selected instruments</span>
              <strong>${totals.count}</strong>
            </div>

            <div class="summary-item">
              <span>Total mass</span>
              <strong>${totals.mass.toFixed(1)} kg</strong>
            </div>

            <div class="summary-item">
              <span>Power consumption</span>
              <strong>${totals.power.toFixed(1)} W</strong>
            </div>

            <div class="summary-item">
              <span>Generated data rate</span>
              <strong>${totals.dataRate.toFixed(0)} kbps</strong>
            </div>

            <div class="summary-item">
              <span>Payload cost</span>
              <strong>$${totals.cost.toFixed(1)}M</strong>
            </div>

            <div class="summary-item">
              <span>Science points</span>
              <strong>${totals.science}</strong>
            </div>
          </div>

          <div class="science-progress">
            <p>
              Science requirement:
              ${totals.science} / ${mission.minScienceScore} points
            </p>

            <progress
              value="${Math.min(totals.science, mission.minScienceScore)}"
              max="${Math.max(mission.minScienceScore, 1)}"
            ></progress>

            <p class="${scienceSatisfied ? "success" : "warning"}">
              ${
                scienceSatisfied
                  ? "Scientific requirement satisfied."
                  : `You need ${mission.minScienceScore - totals.science} more science points.`
              }
            </p>
          </div>

          <div class="budget-summary">
            <p>Mission budget: $${mission.budgetCap}M</p>
            <p>Remaining after payload: $${budgetRemaining.toFixed(1)}M</p>
          </div>

          ${(() => {
            const validation = validateMissionSpec(this.buildMissionSpec());
            return `
              <div class="mission-validation ${validation.valid ? "valid" : "invalid"}">
                <strong>${
                  validation.valid
                    ? "Ready to Proceed to Spacecraft Design"
                    : "Action Required Before Spacecraft Design:"
                }</strong>
                ${
                  validation.valid
                    ? ""
                    : `<ul>${validation.errors
                        .map((err) => `<li>${this.escapeHTML(err)}</li>`)
                        .join("")}</ul>`
                }
              </div>
            `;
          })()}

          <p class="summary-note">
            Payload totals exclude spacecraft hardware and launch costs.
            Final mission feasibility is evaluated after spacecraft design
            and launch configuration.
          </p>
        </section>

      </section>
    `;
  }

  /**
   * Remove DOM nodes and event listeners when leaving the Mission phase.
   */
  destroy() {
    this.container.removeEventListener("click", this.handleClick);
    this.container.removeEventListener("change", this.handleChange);

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.container.innerHTML = "";
  }
}
