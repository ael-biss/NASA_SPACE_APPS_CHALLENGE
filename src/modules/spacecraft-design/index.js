/**
 * @file src/modules/spacecraft-design/index.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Public entry point for the Spacecraft Design module implementing the GameModule lifecycle
 *       and exposing buildSpacecraftModel() so Member 3 can render the player's craft in orbit.
 */

import { Spacecraft } from "./models/Spacecraft.js";

/**
 * Mount the Spacecraft Design assembly bay (3D OrbitControls preview + configurator UI).
 * @param {import('../../core/SceneManager.js').SceneManager} sceneManager
 * @param {import('../../core/GameState.js').GameState} gameState
 * @param {HTMLElement} uiContainer
 */
export function mount(sceneManager, gameState, uiContainer) {
  // TODO: Instantiate Spacecraft, OrbitControls, SpacecraftConfig, and SpacecraftConfigurator
}

/**
 * Per-frame update hook (e.g., OrbitControls damping and slow turntable rotation).
 * @param {number} deltaTime
 */
export function update(deltaTime) {
  // TODO: Update OrbitControls and optional turntable/animation
}

/** Clean up assembly bay 3D objects, OrbitControls, and configurator UI. */
export function unmount() {
  // TODO: Remove spacecraft group from sceneManager and destroy configurator UI
}

/**
 * Build a standalone 3D spacecraft model from a SpacecraftSpec for Launch & Orbit.
 * @param {import('../../shared/interfaces/SpacecraftSpec.js').SpacecraftSpec} spacecraftSpec
 * @returns {import('three').Group}
 */
export function buildSpacecraftModel(spacecraftSpec) {
  const craft = new Spacecraft();
  return craft.assemble(spacecraftSpec.selection);
}
