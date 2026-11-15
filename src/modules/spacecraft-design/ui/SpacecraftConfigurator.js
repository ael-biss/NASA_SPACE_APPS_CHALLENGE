/**
 * @file src/modules/spacecraft-design/ui/SpacecraftConfigurator.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Side-panel UI letting players browse subsystem categories, swap components,
 *       test solar deployment / thruster burn in 3D, and inspect live engineering readouts.
 */

import {
  ALL_SUBSYSTEM_CATEGORIES,
  getComponentsByCategory,
} from "../data/components.js";
import {
  formatBudget,
  formatDeltaV,
  formatMass,
  formatPower,
} from "../../../shared/utils/formatters.js";

const STYLE_ELEMENT_ID = "spacecraft-configurator-styles";

export class SpacecraftConfigurator {
  /**
   * @param {HTMLElement} container
   * @param {Object} handlers
   * @param {(category: string, componentId: string) => void} handlers.onSelectComponent
   * @param {(deployed: boolean) => void} [handlers.onToggleSolar]
   * @param {(active: boolean) => void} [handlers.onToggleThrust]
   */
  constructor(container, handlers) {
    this.container = container;
    this.handlers = handlers;
    this._activeCategory = "structures";
    this._solarDeployed = true;
    this._thrustActive = false;
    this._lastSpec = null;
    this._root = null;
  }

  /** Render subsystem tabs, component cards, 3D preview controls, and telemetry summary. */
  mount() {
    this._ensureStyles();

    this._root = document.createElement("aside");
    this._root.className = "sc-panel";
    this._root.innerHTML = `
      <header class="sc-header">
        <div>
          <span class="sc-badge">PHASE 2 · ASSEMBLY BAY</span>
          <h2>Spacecraft Design</h2>
        </div>
        <div class="sc-actions">
          <button type="button" class="sc-btn sc-btn-active" data-action="toggle-solar">
            Solar: Deployed
          </button>
          <button type="button" class="sc-btn" data-action="toggle-thrust">
            Thruster: Off
          </button>
        </div>
      </header>

      <nav class="sc-tabs" role="tablist"></nav>

      <section class="sc-list" aria-label="Component options"></section>

      <section class="sc-telemetry">
        <div class="sc-metric-grid" data-role="metrics"></div>
        <div class="sc-bars" data-role="bars"></div>
        <div class="sc-validation" data-role="validation"></div>
        <div class="sc-footer-cta" data-role="proceed-wrap"></div>
      </section>
    `;

    this.container.appendChild(this._root);

    this._root.addEventListener("click", (event) => {
      const target = event.target.closest("[data-action], [data-category], [data-component-id]");
      if (!target) return;

      if (target.dataset.category) {
        this._activeCategory = target.dataset.category;
        this._renderTabs();
        this._renderComponentList();
        return;
      }

      if (target.dataset.componentId) {
        this.handlers.onSelectComponent?.(this._activeCategory, target.dataset.componentId);
        return;
      }

      if (target.dataset.action === "toggle-solar") {
        this._solarDeployed = !this._solarDeployed;
        target.textContent = `Solar: ${this._solarDeployed ? "Deployed" : "Stowed"}`;
        target.classList.toggle("sc-btn-active", this._solarDeployed);
        this.handlers.onToggleSolar?.(this._solarDeployed);
      } else if (target.dataset.action === "toggle-thrust") {
        this._thrustActive = !this._thrustActive;
        target.textContent = `Thruster: ${this._thrustActive ? "Firing" : "Off"}`;
        target.classList.toggle("sc-btn-active", this._thrustActive);
        this.handlers.onToggleThrust?.(this._thrustActive);
      } else if (target.dataset.action === "proceed-launch") {
        this.handlers.onProceed?.();
      }
    });

    this._renderTabs();
    this._renderComponentList();
  }

  /**
   * Refresh live engineering readout, active selection highlight, and compatibility alerts.
   * @param {import('../../../shared/interfaces/SpacecraftSpec.js').SpacecraftSpec} spacecraftSpec
   */
  updateStats(spacecraftSpec) {
    this._lastSpec = spacecraftSpec;
    if (!this._root) return;

    this._renderComponentList();

    const metricsEl = this._root.querySelector('[data-role="metrics"]');
    const barsEl = this._root.querySelector('[data-role="bars"]');
    const validationEl = this._root.querySelector('[data-role="validation"]');
    const proceedEl = this._root.querySelector('[data-role="proceed-wrap"]');

    const powerMargin = spacecraftSpec.powerGeneratedWatts - spacecraftSpec.powerConsumedWatts;
    const powerSign = powerMargin >= 0 ? "+" : "";
    const limits = spacecraftSpec.limits ?? {};

    metricsEl.innerHTML = `
      <div class="sc-metric">
        <span>Wet Mass</span>
        <strong>${formatMass(spacecraftSpec.totalMassKg)}</strong>
      </div>
      <div class="sc-metric">
        <span>Onboard Δv</span>
        <strong>${formatDeltaV(spacecraftSpec.deltaVMs || 0)}</strong>
      </div>
      <div class="sc-metric">
        <span>Hardware Cost</span>
        <strong>${formatBudget(spacecraftSpec.costMillions)}</strong>
      </div>
      <div class="sc-metric">
        <span>Comms / Rate</span>
        <strong>${spacecraftSpec.maxRangeKm >= 1000000 ? `${Math.round(spacecraftSpec.maxRangeKm / 1000000)}M km` : `${spacecraftSpec.maxRangeKm.toLocaleString()} km`}</strong>
      </div>
      <div class="sc-metric">
        <span>G / Rad Limit</span>
        <strong>${(limits.maxG ?? 8).toFixed(1)}g · ${Math.round(limits.effectiveRadLimitKrad ?? 12)}kr</strong>
      </div>
      <div class="sc-metric">
        <span>Thermal / Width</span>
        <strong>${limits.tempMinC ?? -15}..${limits.tempMaxC ?? 55}°C · ${limits.stowedDiameterM ?? 1.2}m</strong>
      </div>
    `;

    const massRatio = spacecraftSpec.maxPayloadMassKg
      ? Math.min(100, (spacecraftSpec.carriedMassKg / spacecraftSpec.maxPayloadMassKg) * 100)
      : 0;
    const powerRatio = spacecraftSpec.powerGeneratedWatts
      ? Math.min(100, (spacecraftSpec.powerConsumedWatts / spacecraftSpec.powerGeneratedWatts) * 100)
      : 100;

    barsEl.innerHTML = `
      <div class="sc-bar-row">
        <div class="sc-bar-label">
          <span>Bus Capacity</span>
          <span>${formatMass(spacecraftSpec.carriedMassKg || 0)} / ${formatMass(spacecraftSpec.maxPayloadMassKg || 0)}</span>
        </div>
        <div class="sc-track">
          <div class="sc-fill ${massRatio > 100 ? "sc-fill-err" : massRatio > 88 ? "sc-fill-warn" : "sc-fill-ok"}" style="width:${Math.min(100, massRatio)}%"></div>
        </div>
      </div>
      <div class="sc-bar-row">
        <div class="sc-bar-label">
          <span>Power Load / Gen</span>
          <span>${formatPower(spacecraftSpec.powerConsumedWatts)} / ${formatPower(spacecraftSpec.powerGeneratedWatts)} (${powerSign}${Math.round(powerMargin)} W)</span>
        </div>
        <div class="sc-track">
          <div class="sc-fill ${powerMargin < 0 ? "sc-fill-err" : powerRatio > 85 ? "sc-fill-warn" : "sc-fill-ok"}" style="width:${Math.min(100, powerRatio)}%"></div>
        </div>
      </div>
    `;

    const items = [];
    if (spacecraftSpec.isValid && spacecraftSpec.warnings.length === 0) {
      items.push(`<div class="sc-alert sc-alert-ok">Spacecraft configuration valid and flight-ready.</div>`);
    }
    for (const err of spacecraftSpec.errors) {
      items.push(`<div class="sc-alert sc-alert-err">${this._escapeHtml(err)}</div>`);
    }
    for (const warn of spacecraftSpec.warnings) {
      items.push(`<div class="sc-alert sc-alert-warn">${this._escapeHtml(warn)}</div>`);
    }
    validationEl.innerHTML = items.join("");

    if (proceedEl) {
      proceedEl.innerHTML = this.handlers.onProceed
        ? `<button type="button" class="sc-cta" data-action="proceed-launch" ${spacecraftSpec.isValid ? "" : "disabled"}>
            Proceed to Launch &amp; Orbit →
          </button>`
        : "";
    }
  }

  /** Remove configurator DOM and event listeners. */
  destroy() {
    if (this._root && this._root.parentNode) {
      this._root.parentNode.removeChild(this._root);
    }
    this._root = null;
  }

  _renderTabs() {
    if (!this._root) return;
    const tabsEl = this._root.querySelector(".sc-tabs");
    tabsEl.innerHTML = ALL_SUBSYSTEM_CATEGORIES.map(
      (cat) => `
        <button
          type="button"
          class="sc-tab ${cat.key === this._activeCategory ? "sc-tab-active" : ""}"
          data-category="${cat.key}"
        >
          ${cat.label}
        </button>
      `
    ).join("");
  }

  _renderComponentList() {
    if (!this._root) return;
    const listEl = this._root.querySelector(".sc-list");
    const catMeta = ALL_SUBSYSTEM_CATEGORIES.find((c) => c.key === this._activeCategory);
    const selectedId = this._lastSpec?.selection?.[catMeta?.selectionKey];
    const items = getComponentsByCategory(this._activeCategory);

    listEl.innerHTML = items
      .map((item) => {
        const isSelected = item.id === selectedId;
        const stats = this._formatItemStats(this._activeCategory, item);
        return `
          <button
            type="button"
            class="sc-card ${isSelected ? "sc-card-selected" : ""}"
            data-component-id="${item.id}"
          >
            <div class="sc-card-top">
              <strong>${this._escapeHtml(item.name)}</strong>
              <span class="sc-cost">${formatBudget(item.costMillions)}</span>
            </div>
            <p class="sc-desc">${this._escapeHtml(item.description)}</p>
            <div class="sc-chips">${stats.map((s) => `<span>${s}</span>`).join("")}</div>
          </button>
        `;
      })
      .join("");
  }

  _formatItemStats(category, item) {
    switch (category) {
      case "structures":
        return [
          `Mass: ${item.massKg} kg`,
          `Max Load: ${item.maxPayloadMassKg} kg`,
          `Max ${item.maxG}g`,
        ];
      case "solarPanels":
        return [
          `Mass: ${item.massKg} kg`,
          `Gen: +${item.powerGeneratedWatts} W`,
          item.deployable ? "Deployable" : "Fixed",
        ];
      case "batteries":
        return [
          `Mass: ${item.massKg} kg`,
          `Cap: ${item.capacityWh} Wh`,
          `${item.tempMinC}..${item.tempMaxC}°C`,
        ];
      case "propulsion":
        return [
          `Dry/Fuel: ${item.dryMassKg}/${item.propellantMassKg} kg`,
          `Isp: ${item.ispSeconds} s`,
          `Draw: ${item.powerWatts} W`,
        ];
      case "antennas":
        return [
          `Mass: ${item.massKg} kg`,
          `Range: ${item.maxRangeKm >= 1000000 ? `${Math.round(item.maxRangeKm / 1000000)}M` : item.maxRangeKm.toLocaleString()} km`,
          `Rate: ${item.maxDataRateKbps} kbps`,
        ];
      case "avionics":
        return [
          `Mass: ${item.massKg} kg`,
          `Draw: ${item.powerWatts} W`,
          `Rad: ${item.radLimitKrad} krad`,
        ];
      case "thermalControl":
        return [
          `Mass: ${item.massKg} kg`,
          `Draw: ${item.powerWatts} W`,
          `Insul: ${Math.round(item.insulationFactor * 100)}%`,
        ];
      case "radiationShielding":
        return [
          `Mass: ${item.massKg} kg`,
          `Dose Pass: ${Math.round(item.attenuationFactor * 100)}%`,
        ];
      case "reactionWheels":
        return [
          `Mass: ${item.massKg} kg`,
          `Draw: ${item.powerWatts} W`,
          `Pointing: ±${item.pointingAccuracyDeg}°`,
        ];
      default:
        return [];
    }
  }

  _escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  _ensureStyles() {
    if (document.getElementById(STYLE_ELEMENT_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    style.textContent = `
      .sc-panel {
        pointer-events: auto;
        position: fixed;
        top: 72px;
        right: 16px;
        bottom: 16px;
        width: min(410px, calc(100vw - 32px));
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
      .sc-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
      }
      .sc-badge {
        display: inline-block;
        font-size: 10px;
        letter-spacing: 0.08em;
        color: #38bdf8;
        font-weight: 700;
      }
      .sc-header h2 {
        font-size: 17px;
        font-weight: 700;
        margin-top: 2px;
      }
      .sc-actions {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .sc-btn {
        background: rgba(30, 41, 59, 0.9);
        color: #cbd5e1;
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-radius: 6px;
        padding: 4px 8px;
        font-size: 11px;
        cursor: pointer;
        white-space: nowrap;
      }
      .sc-btn-active {
        background: rgba(14, 165, 233, 0.22);
        border-color: #38bdf8;
        color: #e0f2fe;
      }
      .sc-tabs {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
      }
      .sc-tab {
        background: rgba(30, 41, 59, 0.75);
        color: #94a3b8;
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 6px;
        padding: 6px 4px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      }
      .sc-tab-active {
        background: #0284c7;
        color: #fff;
        border-color: #38bdf8;
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
      .sc-card {
        text-align: left;
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 8px;
        padding: 10px;
        color: #f8fafc;
        cursor: pointer;
        transition: border-color 0.15s ease, background 0.15s ease;
      }
      .sc-card:hover {
        border-color: rgba(56, 189, 248, 0.6);
      }
      .sc-card-selected {
        border-color: #38bdf8;
        background: rgba(14, 116, 144, 0.22);
      }
      .sc-card-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
        margin-bottom: 4px;
      }
      .sc-cost {
        color: #38bdf8;
        font-weight: 700;
        font-size: 12px;
      }
      .sc-desc {
        font-size: 11px;
        color: #94a3b8;
        line-height: 1.35;
        margin-bottom: 6px;
      }
      .sc-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }
      .sc-chips span {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(51, 65, 85, 0.7);
        color: #e2e8f0;
      }
      .sc-telemetry {
        border-top: 1px solid rgba(148, 163, 184, 0.2);
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
        background: rgba(30, 41, 59, 0.65);
        padding: 6px;
        border-radius: 6px;
      }
      .sc-metric span {
        display: block;
        font-size: 10px;
        color: #94a3b8;
      }
      .sc-metric strong {
        font-size: 11.5px;
        color: #f8fafc;
      }
      .sc-bar-row {
        margin-bottom: 6px;
      }
      .sc-bar-label {
        display: flex;
        justify-content: space-between;
        font-size: 10.5px;
        color: #cbd5e1;
        margin-bottom: 3px;
      }
      .sc-track {
        height: 6px;
        background: rgba(51, 65, 85, 0.8);
        border-radius: 999px;
        overflow: hidden;
      }
      .sc-fill {
        height: 100%;
        border-radius: 999px;
        transition: width 0.2s ease;
      }
      .sc-fill-ok { background: #22c55e; }
      .sc-fill-warn { background: #f59e0b; }
      .sc-fill-err { background: #ef4444; }
      .sc-validation {
        max-height: 92px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .sc-alert {
        font-size: 11px;
        padding: 5px 8px;
        border-radius: 6px;
      }
      .sc-alert-ok {
        background: rgba(34, 197, 94, 0.16);
        border: 1px solid rgba(34, 197, 94, 0.45);
        color: #86efac;
      }
      .sc-alert-warn {
        background: rgba(245, 158, 11, 0.16);
        border: 1px solid rgba(245, 158, 11, 0.45);
        color: #fde68a;
      }
      .sc-alert-err {
        background: rgba(239, 68, 68, 0.16);
        border: 1px solid rgba(239, 68, 68, 0.45);
        color: #fca5a5;
      }
      .sc-cta {
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
      .sc-cta:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(style);
  }
}
