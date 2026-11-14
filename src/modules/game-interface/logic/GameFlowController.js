/**
 * @file src/modules/game-interface/logic/GameFlowController.js
 * @owner Member 4 (Interface & Integration)
 * @goal Manages transitions between game phases (mission -> spacecraft -> launch -> results),
 *       unmounting the active module and mounting the next one cleanly.
 */

export class GameFlowController {
  /**
   * @param {import('../../../core/SceneManager.js').SceneManager} sceneManager
   * @param {import('../../../core/GameState.js').GameState} gameState
   * @param {HTMLElement} moduleContainer
   */
  constructor(sceneManager, gameState, moduleContainer) {
    this.sceneManager = sceneManager;
    this.gameState = gameState;
    this.moduleContainer = moduleContainer;
    this.activeModule = null;
  }

  /**
   * Check whether the player has completed prerequisites to enter a target phase.
   * @param {"mission" | "spacecraft" | "launch" | "results"} targetPhase
   * @returns {{ allowed: boolean, reason: string }}
   */
  canAdvanceTo(targetPhase) {
    // TODO: Gate "spacecraft" on valid mission, "launch" on valid spacecraft, "results" on launch completion
    return { allowed: true, reason: "" };
  }

  /**
   * Switch active game phase, unmount previous module, and mount the next module.
   * @param {"mission" | "spacecraft" | "launch" | "results"} phase
   */
  setPhase(phase) {
    // TODO: Call activeModule?.unmount(), look up module for phase, call mount(), update gameState.setPhase(phase)
  }

  /** Forward animation tick to the active module. */
  update(deltaTime) {
    this.activeModule?.update?.(deltaTime);
  }
}
