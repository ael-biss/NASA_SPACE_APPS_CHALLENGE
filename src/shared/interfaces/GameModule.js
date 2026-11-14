/**
 * @file src/shared/interfaces/GameModule.js
 * @owner Shared (Implemented by Members 1, 2, 3; orchestrated by Member 4)
 * @goal Documents the standard lifecycle contract every feature module exports so
 *       Member 4 (Interface & Integration) can switch game phases cleanly.
 */

/**
 * @typedef {Object} GameModule
 * @property {(sceneManager: import('../../core/SceneManager.js').SceneManager, gameState: import('../../core/GameState.js').GameState, uiContainer: HTMLElement) => void} mount
 *   Initialize 3D objects in sceneManager and render module UI into uiContainer.
 * @property {(deltaTime: number) => void} update
 *   Per-frame animation/simulation tick called from the main loop.
 * @property {() => void} unmount
 *   Remove module 3D objects, clear UI elements, and unsubscribe listeners.
 */

export {};
