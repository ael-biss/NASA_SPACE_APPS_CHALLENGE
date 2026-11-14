/**
 * @file src/modules/spacecraft-design/ui/SpacecraftConfigurator.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Side-panel UI letting players browse subsystem categories, swap components,
 *       and inspect live mass, power balance, cost, and compatibility warnings.
 */

export class SpacecraftConfigurator {
  /**
   * @param {HTMLElement} container
   * @param {(category: string, componentId: string) => void} onSelectComponent
   */
  constructor(container, onSelectComponent) {
    this.container = container;
    this.onSelectComponent = onSelectComponent;
  }

  /** Render subsystem tabs, component cards, and engineering summary gauges. */
  mount() {
    // TODO: Build configurator DOM and wire click events to onSelectComponent
  }

  /**
   * Refresh live engineering readout and compatibility alerts in the UI.
   * @param {import('../../../shared/interfaces/SpacecraftSpec.js').SpacecraftSpec} spacecraftSpec
   */
  updateStats(spacecraftSpec) {
    // TODO: Update mass/power/cost meters and error/warning badges
  }

  /** Remove configurator DOM and event listeners. */
  destroy() {
    this.container.innerHTML = "";
  }
}
