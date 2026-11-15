/**
 * @file src/modules/spacecraft-design/ui/SpacecraftConfigurator.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Interactive spacecraft assembly hangar UI with all 10 component categories
 *       (9 subsystems + 10th Scientific Instruments tab), progressive-disclosure specs,
 *       3D viewport camera/test controls, and visual engineering feedback.
 */

import {
  ALL_SUBSYSTEM_CATEGORIES,
  getComponentsByCategory,
} from "../data/components.js";
import { computeCheapestAutoFix } from "../logic/SpacecraftConfig.js";
import { getInstruments } from "../../mission-science/data/instruments.js";
import { getMissionById } from "../../mission-science/data/missions.js";
import { validateSpacecraftSpec } from "../../../shared/interfaces/SpacecraftSpec.js";
import {
  computeBudgetSummary,
  formatBudget,
  formatDeltaV,
  formatMass,
  formatPower,
} from "../../../shared/utils/formatters.js";

const STYLE_ELEMENT_ID = "spacecraft-configurator-styles";

const CATEGORIES_WITH_INSTRUMENTS = [
  ...ALL_SUBSYSTEM_CATEGORIES,
  { key: "instruments", selectionKey: null, label: "Instruments" },
];

const CATEGORY_ICONS = {
  structures: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 20 7 20 17 12 22 4 17 4 7"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`,
  solarPanels: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="8" height="12" rx="1"/><rect x="14" y="6" width="8" height="12" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  batteries: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="6" width="15" height="12" rx="2"/><line x1="21" y1="10" x2="21" y2="14"/><polyline points="12 9 9.5 12 13 12 10.5 15"/></svg>`,
  propulsion: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 4h6l1 6H8l1-6z"/><path d="M7 10h10l2 5H5l2-5z"/><path d="M10 15l2 6 2-6"/></svg>`,
  antennas: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 10a10 10 0 0 1 10 10"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="6" cy="18" r="2"/></svg>`,
  avionics: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><line x1="9" y1="3" x2="9" y2="6"/><line x1="15" y1="3" x2="15" y2="6"/><line x1="9" y1="18" x2="9" y2="21"/><line x1="15" y1="18" x2="15" y2="21"/></svg>`,
  thermalControl: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 14.76V3.5a2 2 0 0 0-4 0v11.26a4 4 0 1 0 4 0z"/></svg>`,
  radiationShielding: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/></svg>`,
  reactionWheels: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><line x1="12" y1="4" x2="12" y2="9.5"/><line x1="5" y1="16" x2="9.8" y2="13.2"/><line x1="19" y1="16" x2="14.2" y2="13.2"/></svg>`,
  instruments: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`,
};

export class SpacecraftConfigurator {
  /**
   * @param {HTMLElement} container
   * @param {import('../../../core/GameState.js').GameState | Object} gameStateOrHandlers
   * @param {Object} [maybeHandlers]
   */
  constructor(container, gameStateOrHandlers, maybeHandlers) {
    this.container = container;
    if (maybeHandlers) {
      this.gameState = gameStateOrHandlers;
      this.handlers = maybeHandlers;
    } else {
      this.gameState = null;
      this.handlers = gameStateOrHandlers ?? {};
    }

    this._activeCategory = "structures";
    this._solarDeployed = true;
    this._thrustActive = false;
    this._lastSpec = null;
    this._pendingAutoFix = null;
    this._confirmModal = null;
    this._escHandler = null;
    this._prepareTourHandler = null;
    this._root = null;
    this._controlsBar = null;
    this._instruments = getInstruments();
  }

  /** Render floating 3D controls, 10 subsystem tabs, visual component cards, and compact HUD. */
  mount() {
    this._ensureStyles();

    // Floating 3D Hangar Viewport Controls (bottom-left so spacecraft stays center stage)
    this._controlsBar = document.createElement("div");
    this._controlsBar.className = "sc-viewport-bar";
    this._controlsBar.setAttribute("data-tour", "view-controls-3d");
    this._controlsBar.innerHTML = `
      <span class="sc-vp-hint">Drag to Rotate · Scroll to Zoom</span>
      <div class="sc-vp-btns">
        <button type="button" class="sc-btn" data-action="zoom-in" title="Zoom In">+</button>
        <button type="button" class="sc-btn" data-action="zoom-out" title="Zoom Out">−</button>
        <button type="button" class="sc-btn" data-action="reset-view">Reset</button>
        <button type="button" class="sc-btn sc-btn-active" data-action="toggle-solar">Solar: Deployed</button>
        <button type="button" class="sc-btn" data-action="toggle-thrust">Thruster: Off</button>
      </div>
    `;
    this.container.appendChild(this._controlsBar);

    this._root = document.createElement("aside");
    this._root.className = "sc-panel";
    this._root.innerHTML = `
      <header class="sc-header">
        <div>
          <span class="sc-badge">Phase 2 · Spacecraft Assembly</span>
          <h2>Build Spacecraft</h2>
        </div>
        <span class="sc-status-pill" data-role="status-pill">Checking...</span>
      </header>

      <nav class="sc-tabs" role="tablist" aria-label="Spacecraft component categories" data-tour="subsystem-tabs"></nav>

      <section class="sc-list" aria-label="Component options"></section>

      <section class="sc-telemetry">
        <div class="sc-metric-grid" data-role="metrics"></div>
        <div class="sc-bars" data-role="bars"></div>
        <div class="sc-validation" data-role="validation" data-tour="validation-alerts"></div>
        <div class="sc-footer-cta" data-role="proceed-wrap"></div>
      </section>
    `;

    this.container.appendChild(this._root);

    const handleInteraction = (event) => {
      // Allow <summary> clicks inside <details> to toggle natively without triggering card selection
      if (event.target.closest("summary")) return;

      const target = event.target.closest(
        "[data-action], [data-category], [data-component-id], [data-instrument-id]"
      );
      if (!target) return;

      if (target.dataset.category) {
        this._activeCategory = target.dataset.category;
        this._renderTabs();
        this._renderComponentList();
        return;
      }

      if (target.dataset.instrumentId) {
        if (target.dataset.disabled === "true") return;
        this.handlers.onToggleInstrument?.(target.dataset.instrumentId);
        return;
      }

      if (target.dataset.componentId) {
        this.handlers.onSelectComponent?.(this._activeCategory, target.dataset.componentId);
        if (
          this._activeCategory === "structures" &&
          typeof document !== "undefined" &&
          typeof CustomEvent !== "undefined"
        ) {
          document.dispatchEvent(
            new CustomEvent("orbitcraft:tour-action", { detail: { actionId: "select-bus" } })
          );
        }
        return;
      }

      const action = target.dataset.action;
      if (action === "toggle-solar") {
        this._solarDeployed = !this._solarDeployed;
        target.textContent = `Solar: ${this._solarDeployed ? "Deployed" : "Stowed"}`;
        target.classList.toggle("sc-btn-active", this._solarDeployed);
        this.handlers.onToggleSolar?.(this._solarDeployed);
      } else if (action === "toggle-thrust") {
        this._thrustActive = !this._thrustActive;
        target.textContent = `Thruster: ${this._thrustActive ? "Firing" : "Off"}`;
        target.classList.toggle("sc-btn-active", this._thrustActive);
        this.handlers.onToggleThrust?.(this._thrustActive);
      } else if (action === "zoom-in") {
        this.handlers.onZoomIn?.();
      } else if (action === "zoom-out") {
        this.handlers.onZoomOut?.();
      } else if (action === "reset-view") {
        this.handlers.onResetView?.();
      } else if (action === "apply-autofix") {
        if (this._pendingAutoFix?.selection) {
          this._closeConfirmModal();
          this.handlers.onApplyAutoFix?.(this._pendingAutoFix.selection);
        }
      } else if (action === "proceed-launch") {
        const hasAlerts =
          (this._lastSpec?.errors?.length ?? 0) > 0 ||
          (this._lastSpec?.warnings?.length ?? 0) > 0;
        if (hasAlerts) {
          this._openConfirmModal();
        } else {
          this.handlers.onProceed?.();
        }
      }
    };

    this._root.addEventListener("click", handleInteraction);
    this._controlsBar.addEventListener("click", handleInteraction);

    if (typeof document !== "undefined") {
      this._prepareTourHandler = (e) => {
        if (e.detail?.step?.id === "structure-card" && this._activeCategory !== "structures") {
          this._activeCategory = "structures";
          this._renderTabs();
          this._renderComponentList();
        }
      };
      document.addEventListener("orbitcraft:prepare-tour-step", this._prepareTourHandler);
    }

    this._renderTabs();
    this._renderComponentList();
  }

  /**
   * Refresh compact engineering HUD, tab warning dots, and visual compatibility alerts.
   * @param {import('../../../shared/interfaces/SpacecraftSpec.js').SpacecraftSpec} spacecraftSpec
   */
  updateStats(spacecraftSpec) {
    this._lastSpec = spacecraftSpec;
    if (!this._root) return;

    this._renderTabs();
    this._renderComponentList();

    const statusPill = this._root.querySelector('[data-role="status-pill"]');
    const metricsEl = this._root.querySelector('[data-role="metrics"]');
    const barsEl = this._root.querySelector('[data-role="bars"]');
    const validationEl = this._root.querySelector('[data-role="validation"]');
    const proceedEl = this._root.querySelector('[data-role="proceed-wrap"]');

    const mission = this.gameState?.mission;
    const budget = computeBudgetSummary(mission, spacecraftSpec, null, 0);
    const hasMissionBudget = Boolean(mission && budget.startingBudget > 0);
    const budgetRemaining = hasMissionBudget ? budget.budgetRemaining : null;

    const powerMargin = spacecraftSpec.powerGeneratedWatts - spacecraftSpec.powerConsumedWatts;
    const powerSign = powerMargin >= 0 ? "+" : "";
    const errCount = spacecraftSpec.errors?.length ?? 0;

    if (statusPill) {
      statusPill.textContent = spacecraftSpec.isValid ? "Flight Ready" : `${errCount} Issue${errCount === 1 ? "" : "s"}`;
      statusPill.className = `sc-status-pill ${spacecraftSpec.isValid ? "sc-pill-ok" : "sc-pill-err"}`;
    }

    const totalMassTip =
      "Total Mass = Bus frame + carried mass (subsystems + propellant + instruments). Checked against your rocket payload capacity.";
    const carriedMassTip =
      "Carried Mass = Subsystems + propellant + instruments inside the bus (excludes the bus frame itself). Checked against Bus Structural Load limit.";

    metricsEl.innerHTML = `
      <div class="sc-metric">
        <span class="sc-metric-head">
          Total Mass
          <span class="sc-tip" tabindex="0" role="note" aria-label="Total Mass vs Carried Mass" data-tip="${this._escapeHtml(totalMassTip)}" title="${this._escapeHtml(totalMassTip)}">?</span>
        </span>
        <strong>${formatMass(spacecraftSpec.totalMassKg)}</strong>
      </div>
      <div class="sc-metric">
        <span class="sc-metric-head">Onboard Δv</span>
        <strong>${formatDeltaV(spacecraftSpec.deltaVMs || 0)}</strong>
      </div>
      <div class="sc-metric" title="${hasMissionBudget ? `Start Budget: $${budget.startingBudget}M · Hardware + Science Spent: $${budget.totalCost.toFixed(1)}M · Left: $${budget.budgetRemaining.toFixed(1)}M` : ""}">
        <span class="sc-metric-head">${hasMissionBudget ? "Budget Left" : "Craft Cost"}</span>
        <strong class="${budgetRemaining !== null && budgetRemaining < 20 ? "sc-text-warn" : ""}">${
          hasMissionBudget
            ? `${formatBudget(budgetRemaining)} <small class="sc-sub-val">/ $${budget.startingBudget}M</small>`
            : formatBudget(spacecraftSpec.costMillions)
        }</strong>
        ${hasMissionBudget ? `<em class="sc-sub-line">Spent $${budget.totalCost.toFixed(1)}M</em>` : ""}
      </div>
    `;

    const massRatio = spacecraftSpec.maxPayloadMassKg
      ? (spacecraftSpec.carriedMassKg / spacecraftSpec.maxPayloadMassKg) * 100
      : 0;
    const powerRatio = spacecraftSpec.powerGeneratedWatts
      ? Math.min(100, (spacecraftSpec.powerConsumedWatts / spacecraftSpec.powerGeneratedWatts) * 100)
      : 100;

    barsEl.innerHTML = `
      <div class="sc-bar-row">
        <div class="sc-bar-label">
          <span>
            Carried Mass (Bus Load)
            <span class="sc-tip" tabindex="0" role="note" aria-label="Carried Mass vs Total Mass" data-tip="${this._escapeHtml(carriedMassTip)}" title="${this._escapeHtml(carriedMassTip)}">?</span>
          </span>
          <span>${formatMass(spacecraftSpec.carriedMassKg || 0)} / ${formatMass(spacecraftSpec.maxPayloadMassKg || 0)}</span>
        </div>
        <div class="sc-track">
          <div class="sc-fill ${massRatio > 100 ? "sc-fill-err" : massRatio > 88 ? "sc-fill-warn" : "sc-fill-ok"}" style="width:${Math.min(100, massRatio)}%"></div>
        </div>
      </div>
      <div class="sc-bar-row" data-tour="power-bar">
        <div class="sc-bar-label">
          <span>Power (Draw / Gen)</span>
          <span>${formatPower(spacecraftSpec.powerConsumedWatts)} / ${formatPower(spacecraftSpec.powerGeneratedWatts)} (${powerSign}${Math.round(powerMargin)} W)</span>
        </div>
        <div class="sc-track">
          <div class="sc-fill ${powerMargin < 0 ? "sc-fill-err" : powerRatio > 85 ? "sc-fill-warn" : "sc-fill-ok"}" style="width:${Math.min(100, powerRatio)}%"></div>
        </div>
      </div>
    `;

    // Concise visual feedback (Level 1/2), with Level 3 full list expandable if > 1 alert
    const alerts = [
      ...(spacecraftSpec.errors ?? []).map((msg) => ({ type: "err", msg })),
      ...(spacecraftSpec.warnings ?? []).map((msg) => ({ type: "warn", msg })),
    ];

    this._pendingAutoFix =
      alerts.length > 0
        ? computeCheapestAutoFix(
            spacecraftSpec.selection,
            this.gameState?.mission?.instruments ?? [],
            this.gameState?.mission ?? null
          )
        : null;

    if (alerts.length === 0) {
      validationEl.innerHTML = `<div class="sc-alert sc-alert-ok">✓ All subsystems compatible and flight-ready.</div>`;
    } else {
      const primary = alerts[0];
      const tag = this._inferCategoryTag(primary.msg);
      const fixHtml = this._renderAutoFixHtml(this._pendingAutoFix);
      const restHtml =
        alerts.length > 1
          ? `
            <details class="oc-details">
              <summary>${alerts.length - 1} more advisory note${alerts.length - 1 === 1 ? "" : "s"}</summary>
              <div class="oc-details-body">
                ${alerts
                  .slice(1)
                  .map((a) => `<div class="sc-alert sc-alert-${a.type}">${this._escapeHtml(a.msg)}</div>`)
                  .join("")}
              </div>
            </details>
          `
          : "";

      validationEl.innerHTML = `
        <div class="sc-alert sc-alert-${primary.type}">
          <strong>${primary.type === "err" ? "WARNING" : "NOTICE"}${tag ? ` · Check ${tag}` : ""}:</strong>
          ${this._escapeHtml(primary.msg)}
        </div>
        ${fixHtml}
        ${restHtml}
      `;
    }

    if (proceedEl) {
      const canProceed = validateSpacecraftSpec(spacecraftSpec, {
        allowCompatibilityErrors: true,
      }).valid;
      const hasErrors = !spacecraftSpec.isValid || errCount > 0;
      const hasWarnings = (spacecraftSpec.warnings?.length ?? 0) > 0;
      const btnClass =
        canProceed && hasErrors
          ? "sc-cta sc-cta-caution"
          : canProceed && hasWarnings
            ? "sc-cta sc-cta-advisory"
            : "sc-cta";
      proceedEl.innerHTML = this.handlers.onProceed
        ? `<button type="button" class="${btnClass}" data-action="proceed-launch" ${canProceed ? "" : "disabled"}>
            Proceed to Launch & Orbit →
          </button>`
        : "";
    }
  }

  /** Remove configurator DOM and event listeners. */
  destroy() {
    this._closeConfirmModal();
    if (this._prepareTourHandler && typeof document !== "undefined") {
      document.removeEventListener("orbitcraft:prepare-tour-step", this._prepareTourHandler);
      this._prepareTourHandler = null;
    }
    if (this._root && this._root.parentNode) {
      this._root.parentNode.removeChild(this._root);
    }
    if (this._controlsBar && this._controlsBar.parentNode) {
      this._controlsBar.parentNode.removeChild(this._controlsBar);
    }
    this._root = null;
    this._controlsBar = null;
  }

  _formatSignedCostDelta(deltaMillions) {
    if (Math.abs(deltaMillions) < 0.05) return "$0.0M";
    const sign = deltaMillions > 0 ? "+" : "−";
    return `${sign}$${Math.abs(deltaMillions).toFixed(1)}M`;
  }

  _renderAutoFixHtml(autoFix) {
    if (!autoFix || !autoFix.changes?.length) return "";
    const deltaLabel = this._formatSignedCostDelta(autoFix.costDelta);
    const summaryText = autoFix.changes
      .map((c) => `${c.label}: ${c.toName}`)
      .join(" · ");
    const remainingText =
      autoFix.remainingErrors === 0 && autoFix.remainingWarnings === 0
        ? "Clears all warnings"
        : `Clears blocking issues (${autoFix.remainingWarnings} advisory left)`;

    return `
      <div class="sc-autofix-card">
        <div class="sc-autofix-meta">
          <strong>Auto-fix (${autoFix.changes.length} upgrade${autoFix.changes.length === 1 ? "" : "s"})</strong>
          <span class="sc-autofix-sub" title="${this._escapeHtml(summaryText)}">${this._escapeHtml(remainingText)}: ${this._escapeHtml(summaryText)}</span>
        </div>
        <button type="button" class="sc-autofix-btn" data-action="apply-autofix" data-tour="auto-fix-btn">
          Apply Fix (${deltaLabel})
        </button>
      </div>
    `;
  }

  _openConfirmModal() {
    this._closeConfirmModal();
    const spec = this._lastSpec;
    if (!spec) {
      this.handlers.onProceed?.();
      return;
    }

    const errors = spec.errors ?? [];
    const warnings = spec.warnings ?? [];
    const autoFix = this._pendingAutoFix;
    const modal = document.createElement("div");
    modal.className = "sc-modal-backdrop";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Confirm Launch With Advisories");

    const fixDelta = autoFix ? this._formatSignedCostDelta(autoFix.costDelta) : "";
    const fixButton =
      autoFix && autoFix.changes?.length
        ? `<button type="button" class="sc-modal-fix" data-modal-action="autofix">Auto-Fix Issues (${fixDelta})</button>`
        : "";

    modal.innerHTML = `
      <div class="sc-modal-card">
        <div class="sc-modal-head">
          <span class="sc-badge">${errors.length > 0 ? "Flight Readiness Warning" : "Mission Advisory"}</span>
          <h3>${errors.length > 0 ? "Proceed with Unresolved Errors?" : "Review Advisories Before Launch"}</h3>
        </div>
        <p class="sc-modal-lead">
          ${
            errors.length > 0
              ? "Your current spacecraft violates one or more mission constraints and is likely to fail or underperform in flight."
              : "Your craft is flight-valid, though mission advisories remain that could reduce survivability margin."
          }
        </p>
        <div class="sc-modal-list">
          ${errors.map((e) => `<div class="sc-alert sc-alert-err"><strong>ERROR:</strong> ${this._escapeHtml(e)}</div>`).join("")}
          ${warnings.map((w) => `<div class="sc-alert sc-alert-warn"><strong>ADVISORY:</strong> ${this._escapeHtml(w)}</div>`).join("")}
        </div>
        <div class="sc-modal-actions">
          <button type="button" class="sc-modal-cancel" data-modal-action="cancel">Back to Assembly</button>
          ${fixButton}
          <button type="button" class="sc-modal-confirm ${errors.length > 0 ? "sc-modal-confirm-danger" : ""}" data-modal-action="confirm">
            Proceed to Launch Anyway →
          </button>
        </div>
      </div>
    `;

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        this._closeConfirmModal();
        return;
      }
      const btn = e.target.closest("[data-modal-action]");
      if (!btn) return;
      const modalAction = btn.dataset.modalAction;
      if (modalAction === "cancel") {
        this._closeConfirmModal();
      } else if (modalAction === "autofix") {
        if (this._pendingAutoFix?.selection) {
          this._closeConfirmModal();
          this.handlers.onApplyAutoFix?.(this._pendingAutoFix.selection);
        }
      } else if (modalAction === "confirm") {
        this._closeConfirmModal();
        this.handlers.onProceed?.();
      }
    });

    this._escHandler = (e) => {
      if (e.key === "Escape") this._closeConfirmModal();
    };
    window.addEventListener("keydown", this._escHandler);

    this.container.appendChild(modal);
    this._confirmModal = modal;
  }

  _closeConfirmModal() {
    if (this._escHandler) {
      window.removeEventListener("keydown", this._escHandler);
      this._escHandler = null;
    }
    if (this._confirmModal && this._confirmModal.parentNode) {
      this._confirmModal.parentNode.removeChild(this._confirmModal);
    }
    this._confirmModal = null;
  }

  _getFlaggedCategories() {
    const flagged = new Set();
    const errs = this._lastSpec?.errors ?? [];
    for (const err of errs) {
      const lower = err.toLowerCase();
      if (lower.includes("mass") || lower.includes("load") || lower.includes("structure")) flagged.add("structures");
      if (lower.includes("power") || lower.includes("solar")) flagged.add("solarPanels");
      if (lower.includes("range") || lower.includes("data rate") || lower.includes("antenna")) flagged.add("antennas");
      if (lower.includes("radiation")) {
        flagged.add("radiationShielding");
        flagged.add("avionics");
      }
      if (lower.includes("thermal")) flagged.add("thermalControl");
    }
    const mission = this.gameState?.mission;
    if (mission) {
      const pts = (mission.instruments ?? []).reduce((s, i) => s + (i.sciencePoints || 0), 0);
      if (pts < (mission.minSciencePoints ?? 0)) flagged.add("instruments");
    }
    return flagged;
  }

  _inferCategoryTag(msg) {
    const lower = String(msg ?? "").toLowerCase();
    if (lower.includes("mass") || lower.includes("load")) return "Structure";
    if (lower.includes("power")) return "Solar Panels";
    if (lower.includes("range") || lower.includes("downlink") || lower.includes("data rate")) return "Antenna";
    if (lower.includes("radiation")) return "Shielding / Avionics";
    if (lower.includes("thermal") || lower.includes("temp")) return "Thermal";
    return "";
  }

  _renderTabs() {
    if (!this._root) return;
    const tabsEl = this._root.querySelector(".sc-tabs");
    const flagged = this._getFlaggedCategories();

    tabsEl.innerHTML = CATEGORIES_WITH_INSTRUMENTS.map(
      (cat) => `
        <button
          type="button"
          class="sc-tab ${cat.key === this._activeCategory ? "sc-tab-active" : ""}"
          data-category="${cat.key}"
          ${cat.key === "antennas" ? 'data-tour="antenna-tab"' : ""}
        >
          ${cat.label}
          ${flagged.has(cat.key) ? `<span class="sc-tab-dot" title="Engineering warning"></span>` : ""}
        </button>
      `
    ).join("");
  }

  _renderComponentList() {
    if (!this._root) return;
    const listEl = this._root.querySelector(".sc-list");

    if (this._activeCategory === "instruments") {
      this._renderInstrumentsTab(listEl);
      return;
    }

    const catMeta = ALL_SUBSYSTEM_CATEGORIES.find((c) => c.key === this._activeCategory);
    const selectedId = this._lastSpec?.selection?.[catMeta?.selectionKey];
    const items = getComponentsByCategory(this._activeCategory);
    const iconSvg = CATEGORY_ICONS[this._activeCategory] ?? "";

    listEl.innerHTML = items
      .map((item, idx) => {
        const isSelected = item.id === selectedId;
        const isTourStructureTarget = this._activeCategory === "structures" && idx === 0;
        const stats = this._formatItemStats(this._activeCategory, item);
        const advanced = this._formatAdvancedStats(this._activeCategory, item);
        return `
          <div
            role="button"
            tabindex="0"
            class="sc-card ${isSelected ? "sc-card-selected" : ""}"
            data-component-id="${item.id}"
            ${isTourStructureTarget ? 'data-tour="structure-card"' : ""}
            aria-pressed="${isSelected}"
          >
            <div class="sc-card-top">
              <div class="sc-card-title">
                <span class="sc-icon" aria-hidden="true">${iconSvg}</span>
                <strong>${this._escapeHtml(item.name)}</strong>
              </div>
              <span class="sc-cost">${formatBudget(item.costMillions)}</span>
            </div>
            <p class="sc-desc" title="${this._escapeHtml(item.description)}">${this._escapeHtml(item.description)}</p>
            <div class="sc-chips">${stats.map((s) => `<span>${s}</span>`).join("")}</div>
            <details class="oc-details sc-card-details">
              <summary>Specs & Details</summary>
              <div class="oc-details-body">
                <p class="sc-full-desc">${this._escapeHtml(item.description)}</p>
                ${
                  advanced.length > 0
                    ? `<div class="sc-adv-grid">${advanced.map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join("")}</div>`
                    : ""
                }
              </div>
            </details>
          </div>
        `;
      })
      .join("");
  }

  _renderInstrumentsTab(listEl) {
    const missionSpec = this.gameState?.mission;
    const missionTemplate = missionSpec?.missionId ? getMissionById(missionSpec.missionId) : null;
    const selectedIds = new Set((missionSpec?.instruments ?? []).map((i) => i.id));
    const recommendedIds = new Set(missionTemplate?.recommendedInstrumentIds ?? []);

    const isCompat = (inst) => {
      if (!missionTemplate?.objectives || !inst.compatibleObjectives) return true;
      return inst.compatibleObjectives.some((o) => missionTemplate.objectives.includes(o));
    };

    const currentScience = (missionSpec?.instruments ?? []).reduce((s, i) => s + (i.sciencePoints || 0), 0);
    const minScience = missionSpec?.minSciencePoints ?? 0;
    const sciencePct = minScience > 0 ? Math.min(100, (currentScience / minScience) * 100) : 100;

    const sorted = [...this._instruments].sort((a, b) => {
      const ca = isCompat(a) ? 0 : 1;
      const cb = isCompat(b) ? 0 : 1;
      if (ca !== cb) return ca - cb;
      const ra = recommendedIds.has(a.id) ? 0 : 1;
      const rb = recommendedIds.has(b.id) ? 0 : 1;
      return ra - rb;
    });

    const headerBanner = `
      <div class="sc-science-banner">
        <div class="sc-bar-label">
          <span>Science Payload Score</span>
          <strong class="${currentScience >= minScience ? "sc-text-ok" : "sc-text-warn"}">${currentScience} / ${minScience} pts</strong>
        </div>
        <div class="sc-track">
          <div class="sc-fill ${currentScience >= minScience ? "sc-fill-ok" : "sc-fill-warn"}" style="width:${sciencePct}%"></div>
        </div>
      </div>
    `;

    const cardsHtml = sorted
      .map((inst) => {
        const selected = selectedIds.has(inst.id);
        const compat = isCompat(inst);
        const rec = recommendedIds.has(inst.id);
        return `
          <div
            role="button"
            tabindex="${compat ? "0" : "-1"}"
            class="sc-card ${selected ? "sc-card-selected" : ""} ${compat ? "" : "sc-card-disabled"}"
            data-instrument-id="${inst.id}"
            data-disabled="${!compat}"
            aria-pressed="${selected}"
          >
            <div class="sc-card-top">
              <div class="sc-card-title">
                <span class="sc-icon" aria-hidden="true">${CATEGORY_ICONS.instruments}</span>
                <strong>${this._escapeHtml(inst.name)}</strong>
              </div>
              <span class="sc-cost">${formatBudget(inst.costMillions)}</span>
            </div>
            <p class="sc-desc" title="${this._escapeHtml(inst.scientificPurpose ?? inst.description)}">${this._escapeHtml(inst.scientificPurpose ?? inst.description)}</p>
            <div class="sc-chips">
              <span class="${rec ? "sc-chip-rec" : ""}">${rec ? "★ Recommended" : this._escapeHtml(inst.category)}</span>
              <span class="sc-chip-gold">+${inst.sciencePoints} pts</span>
              <span>${inst.massKg} kg</span>
              <span>${inst.powerWatts} W</span>
            </div>
            <details class="oc-details sc-card-details">
              <summary>Specs & Details</summary>
              <div class="oc-details-body">
                <p class="sc-full-desc">${this._escapeHtml(inst.description)}</p>
                <div><strong>Downlink:</strong> ${(inst.dataRateKbps / 1000).toFixed(1)} Mbps</div>
                <div><strong>Range:</strong> ${this._escapeHtml(inst.measurementRange ?? "Standard")}</div>
                ${compat ? "" : `<div class="sc-text-warn">Not compatible with this mission's objectives.</div>`}
              </div>
            </details>
          </div>
        `;
      })
      .join("");

    listEl.innerHTML = headerBanner + cardsHtml;
  }

  _formatItemStats(category, item) {
    switch (category) {
      case "structures":
        return [`Mass: ${item.massKg} kg`, `Max Load: ${item.maxPayloadMassKg} kg`];
      case "solarPanels":
        return [`Gen: +${item.powerGeneratedWatts} W`, `Mass: ${item.massKg} kg`];
      case "batteries":
        return [`Cap: ${item.capacityWh} Wh`, `Mass: ${item.massKg} kg`];
      case "propulsion":
        return [`Fuel: ${item.propellantMassKg} kg`, `Isp: ${item.ispSeconds} s`];
      case "antennas":
        return [
          `Range: ${item.maxRangeKm >= 1000000 ? `${Math.round(item.maxRangeKm / 1000000)}M` : item.maxRangeKm.toLocaleString()} km`,
          `Rate: ${item.maxDataRateKbps} kbps`,
        ];
      case "avionics":
        return [`Draw: ${item.powerWatts} W`, `Rad: ${item.radLimitKrad} krad`];
      case "thermalControl":
        return [`Insul: ${Math.round(item.insulationFactor * 100)}%`, `Mass: ${item.massKg} kg`];
      case "radiationShielding":
        return [`Dose Pass: ${Math.round(item.attenuationFactor * 100)}%`, `Mass: ${item.massKg} kg`];
      case "reactionWheels":
        return [`Pointing: ±${item.pointingAccuracyDeg}°`, `Mass: ${item.massKg} kg`];
      default:
        return [];
    }
  }

  _formatAdvancedStats(category, item) {
    const pairs = [];
    if (typeof item.maxG === "number") pairs.push(["Max Load", `${item.maxG}g`]);
    if (typeof item.vibrationLimitG === "number") pairs.push(["Vib Limit", `${item.vibrationLimitG}g`]);
    if (typeof item.tempMinC === "number" && typeof item.tempMaxC === "number") {
      pairs.push(["Thermal", `${item.tempMinC}..${item.tempMaxC}°C`]);
    }
    if (typeof item.powerWatts === "number") pairs.push(["Power Draw", `${item.powerWatts} W`]);
    if (typeof item.dryMassKg === "number") pairs.push(["Dry Mass", `${item.dryMassKg} kg`]);
    if (typeof item.stowedDiameterM === "number") pairs.push(["Width", `${item.stowedDiameterM} m`]);
    if (category === "solarPanels") pairs.push(["Type", item.deployable ? "Deployable" : "Body-mounted"]);
    return pairs;
  }

  _escapeHtml(str) {
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
      .sc-viewport-bar {
        pointer-events: auto;
        position: fixed;
        left: 16px;
        bottom: 16px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px 12px;
        background: rgba(16, 29, 51, 0.86);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(25, 191, 255, 0.3);
        border-radius: 10px;
        z-index: 20;
      }
      .sc-vp-hint {
        font-size: 11px;
        color: var(--oc-nebula-gray, #8CA3BF);
        letter-spacing: 0.04em;
      }
      .sc-vp-btns {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .sc-panel {
        pointer-events: auto;
        position: fixed;
        top: 72px;
        right: 16px;
        bottom: 16px;
        width: min(430px, calc(100vw - 32px));
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
      @media (max-width: 820px) {
        .sc-viewport-bar { display: none; }
      }
      .sc-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .sc-badge {
        display: inline-block;
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-size: 11px;
        letter-spacing: 0.08em;
        color: var(--oc-cosmic-cyan, #19BFFF);
        font-weight: 700;
        text-transform: uppercase;
      }
      .sc-header h2 {
        font-family: var(--font-display, "Orbitron", sans-serif);
        font-size: 16px;
        font-weight: 700;
        margin-top: 2px;
        color: var(--oc-starlight, #EAF4FF);
      }
      .sc-status-pill {
        font-size: 11.5px;
        font-weight: 700;
        padding: 3px 9px;
        border-radius: 999px;
        white-space: nowrap;
      }
      .sc-pill-ok {
        background: rgba(53, 213, 138, 0.16);
        border: 1px solid rgba(53, 213, 138, 0.5);
        color: var(--oc-success-green, #35D58A);
      }
      .sc-pill-err {
        background: rgba(255, 83, 100, 0.16);
        border: 1px solid rgba(255, 83, 100, 0.5);
        color: var(--oc-warning-red, #FF5364);
      }
      .sc-btn {
        background: rgba(5, 11, 27, 0.72);
        color: var(--oc-nebula-gray, #8CA3BF);
        border: 1px solid rgba(140, 163, 191, 0.34);
        border-radius: 6px;
        padding: 5px 9px;
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
      }
      .sc-btn:hover { border-color: var(--oc-cosmic-cyan, #19BFFF); color: var(--oc-starlight, #EAF4FF); }
      .sc-btn-active {
        background: rgba(22, 119, 255, 0.24);
        border-color: var(--oc-cosmic-cyan, #19BFFF);
        color: var(--oc-starlight, #EAF4FF);
      }
      .sc-tabs {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 5px;
      }
      .sc-tab {
        position: relative;
        background: rgba(5, 11, 27, 0.65);
        color: var(--oc-nebula-gray, #8CA3BF);
        border: 1px solid rgba(140, 163, 191, 0.24);
        border-radius: 6px;
        padding: 6px 4px;
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-size: 11.5px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sc-tab:hover { border-color: rgba(25, 191, 255, 0.55); color: var(--oc-starlight, #EAF4FF); }
      .sc-tab-active {
        background: linear-gradient(135deg, var(--oc-electric-blue, #1677FF), var(--oc-cosmic-cyan, #19BFFF));
        color: var(--oc-deep-space, #050B1B);
        border-color: var(--oc-cosmic-cyan, #19BFFF);
      }
      .sc-tab-dot {
        position: absolute;
        top: 3px;
        right: 3px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--oc-warning-red, #FF5364);
      }
      .sc-list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-right: 4px;
      }
      .sc-science-banner {
        background: rgba(5, 11, 27, 0.68);
        border: 1px solid rgba(255, 157, 36, 0.35);
        border-radius: 8px;
        padding: 8px 10px;
      }
      .sc-card {
        text-align: left;
        background: rgba(5, 11, 27, 0.72);
        border: 1px solid rgba(140, 163, 191, 0.24);
        border-radius: 9px;
        padding: 10px;
        color: var(--oc-starlight, #EAF4FF);
        cursor: pointer;
        transition: border-color 0.15s ease, background 0.15s ease;
      }
      .sc-card:hover:not(.sc-card-disabled) {
        border-color: rgba(25, 191, 255, 0.65);
      }
      .sc-card-selected {
        border-color: var(--oc-cosmic-cyan, #19BFFF);
        background: rgba(22, 119, 255, 0.2);
      }
      .sc-card-disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .sc-card-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 700;
        margin-bottom: 4px;
      }
      .sc-card-title {
        display: flex;
        align-items: center;
        gap: 7px;
      }
      .sc-icon {
        width: 18px;
        height: 18px;
        color: var(--oc-cosmic-cyan, #19BFFF);
        flex-shrink: 0;
      }
      .sc-cost {
        font-family: var(--font-body, "Inter", system-ui, sans-serif);
        font-variant-numeric: tabular-nums;
        color: var(--oc-stellar-gold, #FF9D24);
        font-weight: 700;
        font-size: 13px;
      }
      .sc-desc {
        font-size: 12.5px;
        color: var(--oc-nebula-gray, #8CA3BF);
        line-height: 1.4;
        margin-bottom: 6px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sc-full-desc {
        font-size: 12.5px;
        color: var(--oc-starlight, #EAF4FF);
        line-height: 1.48;
        margin: 0 0 8px 0;
        padding-bottom: 6px;
        border-bottom: 1px solid rgba(140, 163, 191, 0.16);
      }
      .sc-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }
      .sc-chips span {
        font-size: 11px;
        font-weight: 600;
        padding: 2px 7px;
        border-radius: 4px;
        background: rgba(16, 29, 51, 0.9);
        border: 1px solid rgba(140, 163, 191, 0.2);
        color: var(--oc-starlight, #EAF4FF);
      }
      .sc-chip-rec {
        border-color: rgba(53, 213, 138, 0.45) !important;
        color: var(--oc-success-green, #35D58A) !important;
      }
      .sc-chip-gold {
        border-color: rgba(255, 157, 36, 0.45) !important;
        color: var(--oc-stellar-gold, #FF9D24) !important;
      }
      .sc-card-details {
        margin-top: 7px;
      }
      .sc-adv-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 6px;
      }
      .sc-adv-grid span {
        display: block;
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--oc-nebula-gray, #8CA3BF);
      }
      .sc-adv-grid strong {
        font-size: 12.5px;
        font-variant-numeric: tabular-nums;
        color: var(--oc-starlight, #EAF4FF);
      }
      .sc-telemetry {
        border-top: 1px solid rgba(140, 163, 191, 0.24);
        padding-top: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .sc-metric-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
      }
      .sc-metric {
        background: rgba(5, 11, 27, 0.6);
        padding: 6px 7px;
        border-radius: 6px;
      }
      .sc-metric span.sc-metric-head,
      .sc-metric > span {
        display: flex;
        align-items: center;
        gap: 4px;
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--oc-nebula-gray, #8CA3BF);
      }
      .sc-sub-val {
        font-size: 10.5px;
        font-weight: 500;
        color: var(--oc-nebula-gray, #8CA3BF);
      }
      .sc-sub-line {
        display: block;
        font-style: normal;
        font-size: 10.5px;
        color: var(--oc-nebula-gray, #8CA3BF);
        margin-top: 1px;
      }
      .sc-tip {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 1px solid rgba(25, 191, 255, 0.55);
        background: rgba(25, 191, 255, 0.14);
        color: var(--oc-cosmic-cyan, #19BFFF);
        font-family: var(--font-body, "Inter", system-ui, sans-serif);
        font-size: 10px;
        font-weight: 700;
        line-height: 1;
        text-transform: none;
        letter-spacing: 0;
        cursor: help;
      }
      .sc-tip:hover::after,
      .sc-tip:focus::after {
        content: attr(data-tip);
        position: fixed;
        right: 28px;
        bottom: 185px;
        width: min(300px, calc(100vw - 56px));
        padding: 8px 10px;
        border-radius: 8px;
        background: rgba(5, 11, 27, 0.97);
        border: 1px solid var(--oc-cosmic-cyan, #19BFFF);
        color: var(--oc-starlight, #EAF4FF);
        font-size: 12px;
        font-weight: 500;
        line-height: 1.45;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.65);
        z-index: 60;
        pointer-events: none;
      }
      .sc-metric strong {
        font-family: var(--font-body, "Inter", system-ui, sans-serif);
        font-variant-numeric: tabular-nums;
        font-size: 13px;
        font-weight: 700;
        color: var(--oc-starlight, #EAF4FF);
      }
      .sc-text-ok { color: var(--oc-success-green, #35D58A) !important; }
      .sc-text-warn { color: var(--oc-stellar-gold, #FF9D24) !important; }
      .sc-bar-row { margin-bottom: 5px; }
      .sc-bar-label {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--oc-starlight, #EAF4FF);
        margin-bottom: 3px;
      }
      .sc-track {
        height: 6px;
        background: rgba(140, 163, 191, 0.22);
        border-radius: 999px;
        overflow: hidden;
      }
      .sc-fill {
        height: 100%;
        border-radius: 999px;
        transition: width 0.2s ease;
      }
      .sc-fill-ok { background: var(--oc-success-green, #35D58A); }
      .sc-fill-warn { background: var(--oc-stellar-gold, #FF9D24); }
      .sc-fill-err { background: var(--oc-warning-red, #FF5364); }
      .sc-validation {
        max-height: 152px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .sc-alert {
        font-size: 12.5px;
        font-weight: 500;
        line-height: 1.45;
        padding: 7px 10px;
        border-radius: 6px;
      }
      .sc-alert-ok {
        background: rgba(53, 213, 138, 0.14);
        border: 1px solid rgba(53, 213, 138, 0.45);
        color: var(--oc-success-green, #35D58A);
      }
      .sc-alert-warn {
        background: rgba(255, 157, 36, 0.16);
        border: 1px solid rgba(255, 157, 36, 0.48);
        color: var(--oc-stellar-gold, #FF9D24);
      }
      .sc-alert-err {
        background: rgba(255, 83, 100, 0.16);
        border: 1px solid rgba(255, 83, 100, 0.5);
        color: var(--oc-warning-red, #FF5364);
      }
      .sc-cta {
        width: 100%;
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
      .sc-cta-caution {
        border-color: var(--oc-warning-red, #FF5364);
        box-shadow: 0 0 0 1px rgba(255, 83, 100, 0.35);
      }
      .sc-cta-advisory {
        border-color: var(--oc-stellar-gold, #FF9D24);
      }
      .sc-cta:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .sc-autofix-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 7px 9px;
        border-radius: 7px;
        background: rgba(25, 191, 255, 0.1);
        border: 1px solid rgba(25, 191, 255, 0.42);
      }
      .sc-autofix-meta {
        min-width: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .sc-autofix-meta strong {
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-size: 12px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--oc-cosmic-cyan, #19BFFF);
      }
      .sc-autofix-sub {
        font-size: 11.5px;
        color: var(--oc-starlight, #EAF4FF);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sc-autofix-btn {
        flex-shrink: 0;
        padding: 6px 10px;
        border-radius: 6px;
        border: 1px solid var(--oc-cosmic-cyan, #19BFFF);
        background: linear-gradient(135deg, var(--oc-electric-blue, #1677FF), var(--oc-cosmic-cyan, #19BFFF));
        color: var(--oc-deep-space, #050B1B);
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-size: 12.5px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
      }
      .sc-autofix-btn:hover {
        filter: brightness(1.08);
      }
      .sc-modal-backdrop {
        pointer-events: auto;
        position: fixed;
        inset: 0;
        background: rgba(5, 11, 27, 0.78);
        backdrop-filter: blur(6px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        z-index: 80;
      }
      .sc-modal-card {
        width: min(490px, 100%);
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 18px;
        border-radius: 14px;
        background: var(--oc-space-navy, #101D33);
        border: 1px solid rgba(25, 191, 255, 0.45);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
        color: var(--oc-starlight, #EAF4FF);
      }
      .sc-modal-head h3 {
        font-family: var(--font-display, "Orbitron", sans-serif);
        font-size: 16px;
        margin: 4px 0 0 0;
        color: var(--oc-starlight, #EAF4FF);
      }
      .sc-modal-lead {
        font-size: 13px;
        line-height: 1.48;
        color: var(--oc-nebula-gray, #8CA3BF);
        margin: 0;
      }
      .sc-modal-list {
        max-height: 220px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .sc-modal-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
        padding-top: 6px;
        border-top: 1px solid rgba(140, 163, 191, 0.22);
      }
      .sc-modal-cancel,
      .sc-modal-fix,
      .sc-modal-confirm {
        padding: 8px 13px;
        border-radius: 7px;
        font-family: var(--font-ui, "Rajdhani", sans-serif);
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }
      .sc-modal-cancel {
        background: rgba(5, 11, 27, 0.75);
        border: 1px solid rgba(140, 163, 191, 0.4);
        color: var(--oc-starlight, #EAF4FF);
      }
      .sc-modal-fix {
        background: rgba(25, 191, 255, 0.16);
        border: 1px solid var(--oc-cosmic-cyan, #19BFFF);
        color: var(--oc-cosmic-cyan, #19BFFF);
      }
      .sc-modal-confirm {
        background: linear-gradient(135deg, #d97706, var(--oc-stellar-gold, #FF9D24));
        border: 1px solid var(--oc-stellar-gold, #FF9D24);
        color: var(--oc-deep-space, #050B1B);
      }
      .sc-modal-confirm-danger {
        background: linear-gradient(135deg, #dc2626, var(--oc-warning-red, #FF5364));
        border-color: var(--oc-warning-red, #FF5364);
        color: var(--oc-starlight, #EAF4FF);
      }
    `;
    document.head.appendChild(style);
  }
}
