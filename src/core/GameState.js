/**
 * @file src/core/GameState.js
 * @owner Core (Shared across all 4 members)
 * @goal Central reactive state store holding MissionSpec, SpacecraftSpec, and LaunchResult.
 *       Provides pub/sub notifications so UI HUDs and modules stay in sync without direct coupling.
 */

export class GameState {
  constructor() {
    this.mission = null;
    this.spacecraft = null;
    this.launch = null;
    this.phase = "mission"; // "mission" | "spacecraft" | "launch" | "results"
    this._listeners = new Set();
  }

  /**
   * Subscribe to any state change.
   * @param {(state: GameState) => void} listener
   * @returns {() => void} Unsubscribe callback
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /** Notify all subscribers of updated state. */
  _notify() {
    for (const listener of this._listeners) {
      listener(this);
    }
  }

  /** @param {import('../shared/interfaces/MissionSpec.js').MissionSpec} missionSpec */
  setMission(missionSpec) {
    this.mission = missionSpec;
    this._notify();
  }

  /** @param {import('../shared/interfaces/SpacecraftSpec.js').SpacecraftSpec} spacecraftSpec */
  setSpacecraft(spacecraftSpec) {
    this.spacecraft = spacecraftSpec;
    this._notify();
  }

  /** @param {import('../shared/interfaces/LaunchResult.js').LaunchResult} launchResult */
  setLaunch(launchResult) {
    this.launch = launchResult;
    this._notify();
  }

  /** @param {"mission" | "spacecraft" | "launch" | "results"} phase */
  setPhase(phase) {
    this.phase = phase;
    this._notify();
  }

  /** Reset all mission selections to start a new game. */
  reset() {
    this.mission = null;
    this.spacecraft = null;
    this.launch = null;
    this.phase = "mission";
    this._notify();
  }
}
