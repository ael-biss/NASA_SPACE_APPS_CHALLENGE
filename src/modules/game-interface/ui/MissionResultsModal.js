/**
 * @file src/modules/game-interface/ui/MissionResultsModal.js
 * @owner Member 4 (Interface & Integration)
 * @goal End-of-mission summary modal presenting the MissionEvaluator grade, checklist
 *       breakdown (why the mission succeeded or failed), and buttons to revise or replay.
 */

export class MissionResultsModal {
  /** @param {HTMLElement} container */
  constructor(container) {
    this.container = container;
  }

  /**
   * Display final mission score, engineering checklist, and retry/modify actions.
   * @param {{ score: number, grade: string, summary: string, checks: Array<Object> }} evaluationResult
   * @param {{ onModifyDesign: () => void, onNewMission: () => void }} actions
   */
  show(evaluationResult, actions) {
    // TODO: Render results card with pass/fail breakdown and action buttons
  }

  /** Hide and clear the modal. */
  hide() {
    this.container.innerHTML = "";
  }
}
