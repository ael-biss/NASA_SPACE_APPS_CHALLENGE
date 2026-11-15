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
import { OnboardingGuide } from "./ui/OnboardingGuide.js";
import { soundFX } from "../../shared/utils/SoundEffects.js";
import { StartScreenScene } from "./models/StartScreenScene.js";
import { StartScreen } from "./ui/StartScreen.js";

/**
 * Bootstrap the full integrated ORBIT CRAFT Space Mission Design Game.
 * @param {HTMLElement} rootElement
 */
export function initGame(rootElement = document.body) {
  const sceneManager = new SceneManager(rootElement);
  const gameState = new GameState();

  const shell = document.createElement("div");
  shell.className = "gi-shell";
  shell.innerHTML = `
    <header class="gi-topbar gi-topbar-hidden">
      <div class="gi-topbar-left" data-role="stepper"></div>
      <div class="gi-topbar-right">
        <div data-role="hud"></div>
        <div data-role="guide-controls"></div>
      </div>
    </header>
    <main class="gi-module-root" data-role="module-root"></main>
    <div class="gi-guide-overlay" data-role="guide-overlay"></div>
    <div class="gi-modal-root" data-role="modal-root"></div>
  `;
  rootElement.appendChild(shell);

  const topbarEl = shell.querySelector(".gi-topbar");
  const stepperEl = shell.querySelector('[data-role="stepper"]');
  const hudEl = shell.querySelector('[data-role="hud"]');
  const guideControlsEl = shell.querySelector('[data-role="guide-controls"]');
  const guideOverlayEl = shell.querySelector('[data-role="guide-overlay"]');
  const moduleRoot = shell.querySelector('[data-role="module-root"]');
  const modalRoot = shell.querySelector('[data-role="modal-root"]');

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

  const guide = new OnboardingGuide(guideControlsEl, guideOverlayEl, gameState);

  gameState.subscribe((state) => {
    stepper.setActivePhase(state.phase);
  });

  // Mount Start Screen (logo + 3D space scene + single START MISSION CTA)
  let inStartMenu = true;
  const startScene = new StartScreenScene(sceneManager);
  startScene.mount();

  const startScreen = new StartScreen(shell, () => {
    soundFX.unlock();
    inStartMenu = false;
    startScene.unmount();
    topbarEl.classList.remove("gi-topbar-hidden");
    guide.mount();
    flow.setPhase("mission");
  });
  startScreen.mount();

  let lastTime = performance.now();
  let rafId = 0;
  function animate(now) {
    rafId = requestAnimationFrame(animate);
    const deltaTime = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    if (inStartMenu) {
      startScene.update(deltaTime);
    } else {
      flow.update(deltaTime);
    }
    sceneManager.render();
  }
  rafId = requestAnimationFrame(animate);

  return {
    sceneManager,
    gameState,
    flow,
    destroy: () => {
      cancelAnimationFrame(rafId);
      soundFX.stopEngineLoop();
      startScreen.destroy();
      startScene.unmount();
      guide.destroy();
      hud.destroy();
      stepper.destroy();
      flow.activeModule?.unmount?.();
      sceneManager.dispose();
    },
  };
}
