/**
 * @file src/modules/game-interface/index.js
 * @owner Member 4 (Interface & Integration)
 * @goal Public entry point for the game shell. Creates SceneManager, GameState,
 *       ResourceHUD, PhaseStepper, and GameFlowController and drives the main render loop.
 */

import { SceneManager } from "../../core/SceneManager.js";
import { GameState } from "../../core/GameState.js";
import { GameFlowController } from "./logic/GameFlowController.js";
import { PhaseStepper } from "./ui/PhaseStepper.js";
import { ResourceHUD } from "./ui/ResourceHUD.js";
import { InstructionsModal } from "./ui/InstructionsModal.js";

/**
 * Bootstrap the full integrated Space Mission Design Game.
 * @param {HTMLElement} rootElement
 */
export function initGame(rootElement = document.body) {
  const sceneManager = new SceneManager(rootElement);
  const gameState = new GameState();

  const shell = document.createElement("div");
  shell.className = "gi-shell";
  shell.innerHTML = `
    <header class="gi-topbar">
      <div class="gi-topbar-left" data-role="stepper"></div>
      <div class="gi-topbar-right">
        <div data-role="hud"></div>
        <button type="button" class="gi-help-btn" data-role="instructions-btn" title="Mission Instructions (?)">? Instructions</button>
      </div>
    </header>
    <main class="gi-module-root" data-role="module-root"></main>
    <div class="gi-modal-root" data-role="modal-root"></div>
    <div class="gi-modal-root" data-role="instructions-root"></div>
  `;
  rootElement.appendChild(shell);

  const stepperEl = shell.querySelector('[data-role="stepper"]');
  const hudEl = shell.querySelector('[data-role="hud"]');
  const instructionsBtn = shell.querySelector('[data-role="instructions-btn"]');
  const moduleRoot = shell.querySelector('[data-role="module-root"]');
  const modalRoot = shell.querySelector('[data-role="modal-root"]');
  const instructionsRoot = shell.querySelector('[data-role="instructions-root"]');

  let stepper = null;
  const flow = new GameFlowController(
    sceneManager,
    gameState,
    moduleRoot,
    modalRoot,
    (phase) => stepper?.setActivePhase(phase)
  );

  stepper = new PhaseStepper(
    stepperEl,
    (phase) => flow.setPhase(phase),
    (phase) => flow.canAdvanceTo(phase).allowed
  );
  stepper.mount();

  const hud = new ResourceHUD(hudEl, gameState);
  hud.mount();

  const instructionsModal = new InstructionsModal(instructionsRoot, () => gameState.phase);
  instructionsModal.mount();
  const onInstructionsClick = () => instructionsModal.toggle();
  instructionsBtn.addEventListener("click", onInstructionsClick);

  gameState.subscribe((state) => {
    stepper.setActivePhase(state.phase);
  });

  flow.setPhase("mission");

  let lastTime = performance.now();
  let rafId = 0;
  function animate(now) {
    rafId = requestAnimationFrame(animate);
    const deltaTime = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    flow.update(deltaTime);
    sceneManager.render();
  }
  rafId = requestAnimationFrame(animate);

  return {
    sceneManager,
    gameState,
    flow,
    destroy: () => {
      cancelAnimationFrame(rafId);
      instructionsBtn.removeEventListener("click", onInstructionsClick);
      instructionsModal.destroy();
      hud.destroy();
      stepper.destroy();
      flow.activeModule?.unmount?.();
      sceneManager.dispose();
    },
  };
}
