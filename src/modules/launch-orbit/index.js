/**
 * @file src/modules/launch-orbit/index.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Public entry point for the Launch & Orbit module implementing the GameModule lifecycle.
 */

import { OrbitMechanics } from './logic/OrbitMechanics.js';
import { LaunchControlPanel } from './ui/LaunchControlPanel.js';
import { getRocketById } from './data/rockets.js';
import { getOrbitById } from './data/orbits.js';

let _panel = null;
let _mechanics = null;

/**
 * Mount the Launch & Orbit 3D scene and launch control UI.
 * @param {import('../../core/SceneManager.js').SceneManager} sceneManager
 * @param {import('../../core/GameState.js').GameState} gameState
 * @param {HTMLElement} uiContainer
 */
export function mount(sceneManager, gameState, uiContainer) {
  _mechanics = new OrbitMechanics();

  // HERE is where your onLaunch callback lives:
  _panel = new LaunchControlPanel(uiContainer, gameState, (rocketId, orbitId) => {
    const rocket = getRocketById(rocketId);
    
    // Fallback: If orbitId isn't passed from UI, get it from the active mission
    const targetOrbitId = orbitId || gameState.mission?.targetOrbitId;
    const orbit = getOrbitById(targetOrbitId);

    // FIX 1: GameState uses .spacecraft (there is no .get() method)
    const spacecraftSpec = gameState.spacecraft ?? null;

    const result = _mechanics.simulateLaunch(rocket, spacecraftSpec, orbit);
    console.log('[launch-orbit] LaunchResult:', result);

    // FIX 2: Member 4's GameState uses .setLaunch() (there is no .set() method)
    gameState.setLaunch(result);

    return result;
  });

  _panel.mount();
}

/**
 * Per-frame update hook for Earth rotation and launch animation.
 * @param {number} deltaTime
 */
export function update(deltaTime) {
  // Hook up LaunchAnimation / PlanetScene updates here
}

/** Clean up 3D objects and launch control UI. */
export function unmount() {
  _panel?.destroy();
  _panel = null;
  _mechanics = null;
}