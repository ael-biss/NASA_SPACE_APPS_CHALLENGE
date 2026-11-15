/**
 * @file src/modules/launch-orbit/models/LaunchAnimation.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Animates the rocket ascent from Earth, fairing/stage separation, and the
 *       player's 3D spacecraft entering and orbiting along the target orbit ring.
 */

import * as THREE from 'three';

export class LaunchAnimation {
  constructor() {
    this.running = false;
    this.progress = 0;
    this._spacecraft = null;
    this._phase = 'idle';       // 'idle' | 'ascent' | 'orbit'
    this._orbitRadius = 1.5;
    this._orbitAngle = 0;
    this._ascentDurationSec = 4.0;
    this._orbitAngularSpeed = 0.4;  // rad/s
    this._ascentCurve = null;
    this._tmpQuat = new THREE.Quaternion();
    this._tmpVec = new THREE.Vector3();
    this._fwd = new THREE.Vector3(0, 0, 1);
  }

  /**
   * Start ascent & orbit insertion animation.
   * @param {Object} rocket
   * @param {THREE.Group} spacecraftGroup - Built via Member 2's buildSpacecraftModel()
   * @param {Object} orbit
   * @param {Object} launchResult
   */
  start(rocket, spacecraftGroup, orbit, launchResult) {
    // If the launch failed, don't run an animation — just mark done.
    if (!launchResult?.success || !spacecraftGroup || !orbit) {
      this.running = false;
      this.progress = 1;
      this._phase = 'idle';
      return;
    }

    this._spacecraft = spacecraftGroup;
    this._orbitRadius = orbit.visualizationRadius ?? 1.5;
    this._orbitAngle = 0;
    this.progress = 0;
    this._phase = 'ascent';
    this.running = true;

    // Simple 3-point ascent: launch site → downrange kick → orbital insertion point.
    const start = new THREE.Vector3(1, 0, 0);
    const mid   = new THREE.Vector3(
      this._orbitRadius * 1.6,
      this._orbitRadius * 0.35,
      0,
    );
    const end   = new THREE.Vector3(0, 0, this._orbitRadius);

    this._ascentCurve = new THREE.CatmullRomCurve3(
      [start, mid, end],
      false,
      'catmullrom',
      0.5,
    );

    spacecraftGroup.position.copy(start);
  }

  /**
   * Advance launch or continuous orbit animation by deltaTime seconds.
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (!this._spacecraft) return;

    if (this._phase === 'ascent') {
      this.progress += deltaTime / this._ascentDurationSec;

      if (this.progress >= 1) {
        this.progress = 1;
        this._phase = 'orbit';
        this.running = false;   // insertion complete; orbit phase continues independently
        this._orbitAngle = 0;
      }

      const p = Math.min(this.progress, 1);
      const pos = this._ascentCurve.getPointAt(p);
      this._spacecraft.position.copy(pos);

      const tangent = this._ascentCurve.getTangentAt(p).normalize();
      this._orientAlong(tangent);
      return;
    }

    if (this._phase === 'orbit') {
      this._orbitAngle += deltaTime * this._orbitAngularSpeed;
      const x = Math.cos(this._orbitAngle) * this._orbitRadius;
      const z = Math.sin(this._orbitAngle) * this._orbitRadius;
      this._spacecraft.position.set(x, 0, z);

      this._tmpVec.set(-Math.sin(this._orbitAngle), 0, Math.cos(this._orbitAngle));
      this._orientAlong(this._tmpVec.normalize());
    }
  }

  _orientAlong(tangent) {
    if (!this._spacecraft) return;
    this._tmpQuat.setFromUnitVectors(this._fwd, tangent);
    this._spacecraft.quaternion.slerp(this._tmpQuat, 0.15);
  }

  /** @returns {boolean} True once orbital insertion sequence finishes */
  isComplete() {
    return !this.running && this.progress >= 1;
  }
}