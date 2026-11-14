/**
 * @file src/modules/launch-orbit/ui/LaunchControlPanel.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Launch control UI panel for selecting a launch vehicle, reviewing payload/delta-v
 *       margins, triggering the 3D launch, and displaying live ascent telemetry.
 */

export class LaunchControlPanel {
  /**
   * @param {HTMLElement} container
   * @param {import('../../../core/GameState.js').GameState} gameState
   * @param {(rocketId: string, orbitId: string) => void} onLaunch
   */
  constructor(container, gameState, onLaunch) {
    this.container = container;
    this.gameState = gameState;
    this.onLaunch = onLaunch;
  }

  /** Render rocket selector, target orbit summary, readiness check, and Launch button. */
  mount() {
    // TODO: Populate rocket choices and bind Launch button click to onLaunch
  }

  /**
   * Update live telemetry readouts (altitude, velocity, delta-v remaining) during flight.
   * @param {{ altitudeKm: number, velocityKms: number, stage: string }} telemetry
   */
  updateTelemetry(telemetry) {
    // TODO: Update telemetry DOM values
  }

  /** Remove launch panel DOM and event listeners. */
  destroy() {
    this.container.innerHTML = "";
  }
}
