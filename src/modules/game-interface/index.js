/**
 * @file src/modules/game-interface/index.js
 * @owner Member 4 (Interface & Integration)
 * @goal Public entry point for the game shell. Creates SceneManager, GameState,
 *       ResourceHUD, PhaseStepper, and GameFlowController and drives the main render loop.
 */

import { SceneManager } from "../../core/SceneManager.js";
import { GameState } from "../../core/GameState.js";
import { GameFlowController } from "./logic/GameFlowController.js";

/**
 * Bootstrap the full integrated Space Mission Design Game.
 * @param {HTMLElement} rootElement
 */
export function initGame(rootElement = document.body) {
  // TODO: Wire SceneManager, GameState, ResourceHUD, PhaseStepper, GameFlowController, and requestAnimationFrame loop
  const sceneManager = new SceneManager(rootElement);
  const gameState = new GameState();
  const flow = new GameFlowController(sceneManager, gameState, rootElement);
  return { sceneManager, gameState, flow };
}
