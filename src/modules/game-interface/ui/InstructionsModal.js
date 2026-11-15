/**
 * @file src/modules/game-interface/ui/InstructionsModal.js
 * @owner Member 4 (Interface & Integration)
 * @goal Interactive Mission Instructions & How-to-Play modal explaining all four
 *       mission phases, engineering constraints, failure modes, and 3D controls.
 */

export const INSTRUCTION_SECTIONS = [
  {
    id: "overview",
    tabLabel: "Overview",
    badge: "MISSION BRIEFING",
    title: "Space Mission Design Game — How to Play",
    subtitle:
      "Design a scientific space mission from payload selection to orbital insertion while balancing mass, power, delta-v, and budget.",
    cards: [
      {
        heading: "4-Phase Mission Workflow",
        items: [
          "1. Mission & Science — Choose a target destination and equip scientific instruments to meet the science goal.",
          "2. Spacecraft Design — Engineer a flight-ready spacecraft bus, power, propulsion, thermal, and comms suite.",
          "3. Launch & Orbit — Select a launch site and rocket with enough lift capacity and delta-v to reach orbit.",
          "4. Results — Review your mission grade, flight timeline, and root-cause diagnostics, then iterate.",
        ],
      },
      {
        heading: "Golden Rules",
        items: [
          "Keep total cost (instruments + spacecraft + launch vehicle) within the mission budget.",
          "Maintain a positive power margin (solar generation must exceed bus + instrument demand).",
          "Ensure your selected rocket's payload capacity to the target orbit exceeds spacecraft mass.",
          "Meet the required science score—under-instrumented missions fail evaluation even after a clean launch.",
        ],
      },
    ],
  },
  {
    id: "mission",
    tabLabel: "1. Mission",
    badge: "PHASE 1 · MISSION & SCIENCE",
    title: "Mission & Science Planning",
    subtitle:
      "Select your target planet or orbit and assemble a scientific payload that satisfies mission objectives.",
    cards: [
      {
        heading: "Selecting a Target",
        items: [
          "Higher-energy destinations (GEO, Lunar, Mars) grant larger budgets but demand heavier propulsion, shielding, and larger rockets.",
          "Check the target orbit altitude, radiation environment, and thermal conditions before choosing instruments.",
        ],
      },
      {
        heading: "Instrument Selection",
        items: [
          "Each instrument adds science points as well as mass, power draw, and cost.",
          "Watch the Science Progress bar—aim to reach or exceed the mission's target science score.",
          "Avoid overloading your payload with redundant mass if you want to fly on a smaller, cheaper launch vehicle.",
        ],
      },
    ],
  },
  {
    id: "spacecraft",
    tabLabel: "2. Spacecraft",
    badge: "PHASE 2 · KENNEDY HANGAR",
    title: "Spacecraft Engineering",
    subtitle:
      "Configure subsystems in the integration hangar until the top HUD reports Flight Ready.",
    cards: [
      {
        heading: "Core Subsystems",
        items: [
          "Structure & Avionics: Sets structural G-load tolerance, payload mounting capacity, and onboard computing.",
          "Solar Panels & Batteries: Must generate positive net power and store enough energy for eclipse periods.",
          "Propulsion: Provides orbital maneuvering delta-v and specific impulse (Isp).",
          "Thermal, Shielding & Comms: Protects against deep-space radiation/heat and maintains link margin at target distance.",
        ],
      },
      {
        heading: "Resolving Engineering Errors",
        items: [
          "If the HUD shows Error(s), inspect the validation warnings in the Spacecraft Designer.",
          "Upgrade solar arrays for negative power margins, strengthen structure for high-G rockets, or trim mass to stay on budget.",
        ],
      },
    ],
  },
  {
    id: "launch",
    tabLabel: "3. Launch",
    badge: "PHASE 3 · LAUNCH & ORBIT",
    title: "Launch Vehicle & Flight Operations",
    subtitle:
      "Match your spacecraft with a capable launch site and rocket, then monitor staging and orbital insertion.",
    cards: [
      {
        heading: "Pre-Launch Checklist",
        items: [
          "Launch Site: Equatorial/coastal sites offer Earth-rotation velocity assist for orbital trajectories.",
          "Payload Capacity: Rocket max payload must be greater than or equal to spacecraft total mass.",
          "Peak G-Load & Delta-V: Ensure spacecraft structure tolerates rocket G-forces and combined delta-v reaches target orbit.",
        ],
      },
      {
        heading: "Flight Outcomes",
        items: [
          "Use the playback speed and camera controls to watch liftoff, booster separation, fairing jettison, and orbit insertion.",
          "Structural, thermal, radiation, power, signal, or propulsion failures cause spacecraft breakup.",
          "Insufficient science points triggers a mission warning without destroying the spacecraft.",
        ],
      },
    ],
  },
  {
    id: "results",
    tabLabel: "4. Results",
    badge: "PHASE 4 · MISSION DEBRIEF",
    title: "Results & Iteration",
    subtitle:
      "Analyze your mission score, subsystem health, and flight timeline to refine your design.",
    cards: [
      {
        heading: "Understanding Your Grade",
        items: [
          "A passing mission requires orbital insertion, a score of 70+, and all mission evaluation checks passing.",
          "If a flight fails, the failure report highlights the exact failed phase, root cause, and recommended fix.",
        ],
      },
      {
        heading: "Next Steps",
        items: [
          "Modify Design: Jump back to Spacecraft Design to swap subsystems without losing your mission.",
          "Replay Launch: Test a different launch site or rocket with the same spacecraft.",
          "New Mission: Start fresh with a different destination and payload.",
        ],
      },
    ],
  },
  {
    id: "controls",
    tabLabel: "3D Controls",
    badge: "VIEWPORT & SHORTCUTS",
    title: "Camera Controls & Keyboard Shortcuts",
    subtitle:
      "Navigate the 3D planet, Kennedy Hangar, and launch trajectory viewports.",
    cards: [
      {
        heading: "3D Viewport Controls",
        items: [
          "Left-click + Drag: Orbit camera around the planet, spacecraft, or launch vehicle.",
          "Scroll Wheel: Zoom in and out.",
          "Right-click + Drag: Pan the camera view.",
        ],
      },
      {
        heading: "Interface Shortcuts",
        items: [
          "Press ? anywhere (outside text inputs) to open or close this Instructions modal.",
          "Press Esc while Instructions are open to close the dialog.",
          "Click any unlocked step in the top phase bar to revisit earlier phases.",
        ],
      },
    ],
  },
];

const PHASE_TO_SECTION = {
  mission: "mission",
  spacecraft: "spacecraft",
  launch: "launch",
  results: "results",
};

export class InstructionsModal {
  /**
   * @param {HTMLElement} container
   * @param {() => string} [getActivePhase]
   */
  constructor(container, getActivePhase = () => "overview") {
    this.container = container;
    this.getActivePhase = getActivePhase;
    this._isOpen = false;
    this._activeSectionId = "overview";
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onClick = this._handleClick.bind(this);
  }

  /** Attach global keyboard and container click listeners. */
  mount() {
    this.container.addEventListener("click", this._onClick);
    if (typeof document !== "undefined") {
      document.addEventListener("keydown", this._onKeyDown);
    }
  }

  /** @returns {boolean} */
  isOpen() {
    return this._isOpen;
  }

  /**
   * Open the instructions modal, defaulting to the current phase's guide.
   * @param {string} [sectionId]
   */
  open(sectionId) {
    const resolved =
      sectionId ||
      PHASE_TO_SECTION[this.getActivePhase?.()] ||
      "overview";
    this._activeSectionId = INSTRUCTION_SECTIONS.some((s) => s.id === resolved)
      ? resolved
      : "overview";
    this._isOpen = true;
    this._render();
  }

  /** Close the instructions modal. */
  close() {
    if (!this._isOpen) return;
    this._isOpen = false;
    this.container.innerHTML = "";
  }

  /** Toggle open/closed state. */
  toggle() {
    if (this._isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Switch active instruction tab.
   * @param {string} sectionId
   */
  setSection(sectionId) {
    if (!INSTRUCTION_SECTIONS.some((s) => s.id === sectionId)) return;
    this._activeSectionId = sectionId;
    if (this._isOpen) {
      this._render();
    }
  }

  _handleClick(e) {
    if (!this._isOpen) return;
    if (e.target.closest("[data-inst-close]") || e.target.classList?.contains("gi-modal-backdrop")) {
      this.close();
      return;
    }
    const tabBtn = e.target.closest("[data-inst-tab]");
    if (tabBtn) {
      this.setSection(tabBtn.dataset.instTab);
    }
  }

  _handleKeyDown(e) {
    const tag = e.target?.tagName?.toLowerCase();
    const isTyping = tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable;
    if (e.key === "Escape" && this._isOpen) {
      this.close();
      return;
    }
    if (e.key === "?" && !isTyping) {
      e.preventDefault();
      this.toggle();
    }
  }

  _render() {
    const section =
      INSTRUCTION_SECTIONS.find((s) => s.id === this._activeSectionId) ||
      INSTRUCTION_SECTIONS[0];

    const tabsHtml = INSTRUCTION_SECTIONS.map((s) => {
      const active = s.id === section.id;
      return `
        <button
          type="button"
          class="gi-inst-tab ${active ? "gi-inst-tab-active" : ""}"
          data-inst-tab="${s.id}"
          role="tab"
          aria-selected="${active ? "true" : "false"}"
        >${this._esc(s.tabLabel)}</button>
      `;
    }).join("");

    const cardsHtml = section.cards
      .map(
        (card) => `
          <section class="gi-inst-card">
            <h3>${this._esc(card.heading)}</h3>
            <ul class="gi-inst-list">
              ${card.items.map((item) => `<li>${this._esc(item)}</li>`).join("")}
            </ul>
          </section>
        `
      )
      .join("");

    this.container.innerHTML = `
      <div class="gi-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="gi-inst-title">
        <div class="gi-modal gi-inst-modal">
          <div class="gi-modal-header">
            <div>
              <div class="gi-modal-badge">${this._esc(section.badge)}</div>
              <h2 id="gi-inst-title">${this._esc(section.title)}</h2>
              <p class="gi-modal-sub">${this._esc(section.subtitle)}</p>
            </div>
            <button type="button" class="gi-inst-close-x" data-inst-close aria-label="Close instructions">×</button>
          </div>

          <div class="gi-inst-tabs" role="tablist" aria-label="Instruction sections">
            ${tabsHtml}
          </div>

          <div class="gi-inst-grid">
            ${cardsHtml}
          </div>

          <div class="gi-modal-actions">
            <span class="gi-inst-hint">Tip: Press <kbd class="gi-inst-kbd">?</kbd> anytime to toggle instructions</span>
            <button type="button" class="gi-btn-primary" data-inst-close>Got It</button>
          </div>
        </div>
      </div>
    `;
  }

  _esc(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  /** Remove listeners and clear modal DOM. */
  destroy() {
    this.container.removeEventListener("click", this._onClick);
    if (typeof document !== "undefined") {
      document.removeEventListener("keydown", this._onKeyDown);
    }
    this.container.innerHTML = "";
  }
}
