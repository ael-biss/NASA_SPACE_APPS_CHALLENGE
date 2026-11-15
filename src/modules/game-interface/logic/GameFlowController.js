/**
 * @file src/modules/game-interface/logic/GameFlowController.js
 * @owner Member 4 (Interface & Integration)
 * @goal Manages transitions between game phases (mission -> spacecraft -> launch -> results),
 *       unmounting the active module and mounting the next one cleanly.
 */

import { validateMissionSpec } from "../../../shared/interfaces/MissionSpec.js";
import { validateSpacecraftSpec } from "../../../shared/interfaces/SpacecraftSpec.js";
import * as missionScience from "../../mission-science/index.js";
import * as spacecraftDesign from "../../spacecraft-design/index.js";
import * as launchOrbit from "../../launch-orbit/index.js";
import { MissionResultsModal } from "../ui/MissionResultsModal.js";

export class GameFlowController {
  /**
   * @param {import('../../../core/SceneManager.js').SceneManager} sceneManager
   * @param {import('../../../core/GameState.js').GameState} gameState
   * @param {HTMLElement} moduleContainer
   * @param {HTMLElement} [modalContainer]
   * @param {(phase: string) => void} [onPhaseChanged]
   */
  constructor(
    sceneManager,
    gameState,
    moduleContainer,
    modalContainer = moduleContainer,
    onPhaseChanged = null
  ) {
    this.sceneManager = sceneManager;
    this.gameState = gameState;
    this.moduleContainer = moduleContainer;
    this.modalContainer = modalContainer;
    this.onPhaseChanged = onPhaseChanged;
    this.activeModule = null;
    this._resultsModal = new MissionResultsModal(this.modalContainer);
  }

  /**
   * Check whether the player has completed prerequisites to enter a target phase.
   * @param {"mission" | "spacecraft" | "launch" | "results"} targetPhase
   * @returns {{ allowed: boolean, reason: string }}
   */
  canAdvanceTo(targetPhase) {
    if (targetPhase === "mission") {
      return { allowed: true, reason: "" };
    }
    if (targetPhase === "spacecraft") {
      const check = validateMissionSpec(this.gameState.mission);
      return {
        allowed: check.valid,
        reason: check.errors[0] ?? "",
      };
    }
    if (targetPhase === "launch") {
      const mCheck = validateMissionSpec(this.gameState.mission);
      if (!mCheck.valid) return { allowed: false, reason: mCheck.errors[0] ?? "" };
      const sCheck = validateSpacecraftSpec(this.gameState.spacecraft, {
        allowCompatibilityErrors: true,
      });
      return {
        allowed: sCheck.valid,
        reason: sCheck.errors[0] ?? "",
      };
    }
    if (targetPhase === "results") {
      return {
        allowed: Boolean(this.gameState.launch),
        reason: this.gameState.launch ? "" : "Run a launch simulation first.",
      };
    }
    return { allowed: false, reason: "Unknown phase." };
  }

  /**
   * Switch active game phase, unmount previous module, and mount the next module.
   * @param {"mission" | "spacecraft" | "launch" | "results"} phase
   */
  setPhase(phase) {
    const check = this.canAdvanceTo(phase);
    if (!check.allowed) return;

    this._resultsModal.hide();

    if (phase === "results") {
      const evaluation = missionScience.evaluateMission(this.gameState);
      this.gameState.setPhase("results");
      this.onPhaseChanged?.("results");
      this._resultsModal.show(
        evaluation,
        this.gameState.launch,
        {
          onModifyDesign: () => this.setPhase("spacecraft"),
          onReplayLaunch: () => this.setPhase("launch"),
          onNewMission: () => {
            this.gameState.reset();
            this.setPhase("mission");
          },
        },
        {
          mission: this.gameState.mission,
          spacecraft: this.gameState.spacecraft,
        }
      );
      return;
    }

    this.activeModule?.unmount?.();
    this.moduleContainer.innerHTML = "";

    if (phase === "mission") {
      this.activeModule = missionScience;
      missionScience.mount(this.sceneManager, this.gameState, this.moduleContainer, {
        onProceed: () => this.setPhase("spacecraft"),
      });
    } else if (phase === "spacecraft") {
      this.activeModule = spacecraftDesign;
      spacecraftDesign.mount(this.sceneManager, this.gameState, this.moduleContainer, {
        onProceed: () => this.setPhase("launch"),
      });
    } else if (phase === "launch") {
      this.activeModule = launchOrbit;
      launchOrbit.mount(this.sceneManager, this.gameState, this.moduleContainer, {
        onProceed: () => this.setPhase("results"),
      });
    }

    this.gameState.setPhase(phase);
    this.onPhaseChanged?.(phase);
  }

  /** Forward animation tick to the active module. */
  update(deltaTime) {
    this.activeModule?.update?.(deltaTime);
  }
}
