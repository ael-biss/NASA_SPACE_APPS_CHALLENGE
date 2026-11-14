/**
 * @file src/modules/launch-orbit/models/LaunchAnimation.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Animates the rocket ascent from Earth, fairing/stage separation, and the
 *       player's 3D spacecraft entering and orbiting along the target orbit ring.
 */

export class LaunchAnimation {
  constructor() {
    this.running = false;
    this.progress = 0;
  }

  /**
   * Start ascent & orbit insertion animation.
   * @param {Object} rocket
   * @param {import('three').Group} spacecraftGroup - Built via Member 2's buildSpacecraftModel()
   * @param {Object} orbit
   * @param {import('../../../shared/interfaces/LaunchResult.js').LaunchResult} launchResult
   */
  start(rocket, spacecraftGroup, orbit, launchResult) {
    this.running = true;
    this.progress = 0;
    // TODO: Initialize ascent trajectory curve and orbital path parameters
  }

  /**
   * Advance launch or continuous orbit animation by deltaTime seconds.
   * @param {number} deltaTime
   */
  update(deltaTime) {
    // TODO: Interpolate position/attitude along launch curve, then orbit around Earth
  }

  /** @returns {boolean} True once orbital insertion sequence finishes */
  isComplete() {
    return !this.running && this.progress >= 1;
  }
}
