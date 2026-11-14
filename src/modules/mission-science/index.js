/**
 * @file src/modules/mission-science/index.js
 * @owner Member 1 (Mission & Science)
 * @goal Public entry point for the Mission & Science module implementing the GameModule lifecycle
 *       and exposing evaluateMission() for the end-of-game Results screen.
 */

import { MissionEvaluator } from "./logic/MissionEvaluator.js";

const evaluator = new MissionEvaluator();

/**
 * Mount the Mission & Science phase into the shared scene and UI container.
 * @param {import('../../core/SceneManager.js').SceneManager} sceneManager
 * @param {import('../../core/GameState.js').GameState} gameState
 * @param {HTMLElement} uiContainer
 */
export function mount(sceneManager, gameState, uiContainer) {
  // TODO: Set up target planet/orbit preview in sceneManager and mount MissionPlanner UI
}

/**
 * Per-frame update hook called during the Mission & Science phase.
 * @param {number} deltaTime
 */
export function update(deltaTime) {
  // TODO: Animate mission target preview if needed
}

/** Clean up 3D preview objects and MissionPlanner UI. */
export function unmount() {
  // TODO: Dispose MissionPlanner and remove module 3D objects from sceneManager
}

/**
 * Evaluate the completed mission for Member 4's Results screen.
 * @param {import('../../core/GameState.js').GameState} gameState
 */
export function evaluateMission(gameState) {
  return evaluator.calculateScore(
    gameState.mission,
    gameState.spacecraft,
    gameState.launch
  );
}
