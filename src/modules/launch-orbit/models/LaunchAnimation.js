/**
 * @file src/modules/launch-orbit/models/LaunchAnimation.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Animates the rocket ascent from Earth, Max-Q buffeting, stage/fairing separation,
 *       solar deployment, transfer burn, cruise, and target orbit insertion — plus visible
 *       3D explosions, structural breakups, and debris physics when any flight phase fails.
 */

import * as THREE from "three";

const PHASE_WINDOWS = [
  { id: "liftoff", start: 0.0, end: 0.14 },
  { id: "max-q", start: 0.14, end: 0.28 },
  { id: "ascent", start: 0.28, end: 0.44 },
  { id: "deployment", start: 0.44, end: 0.58 },
  { id: "tpi-burn", start: 0.58, end: 0.72 },
  { id: "cruise", start: 0.72, end: 0.88 },
  { id: "orbit-insertion", start: 0.88, end: 1.0 },
];

export class LaunchAnimation {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = "launch-animation-root";
    this.running = false;
    this.progress = 0;
    this.speedMultiplier = 1;
    this._orbiting = false;
    this._failed = false;
    this._failureTriggered = false;
    this._failureHoldSec = 0;
    this._orbitAngle = 0;

    this._rocket = null;
    this._spacecraft = null;
    this._spacecraftGroup = null;
    this._orbit = null;
    this._launchResult = null;
    this._onPhaseUpdate = null;
    this._onComplete = null;

    this._stackGroup = null;
    this._boosterGroup = null;
    this._fairingLeft = null;
    this._fairingRight = null;
    this._rocketPlume = null;
    this._machCone = null;
    this._debris = [];
    this._fireballs = [];
    this._activePhaseIndex = -1;
    this._focusTarget = new THREE.Vector3(0, 0, 2.0);
    this._cameraShake = 0;
    this._totalDurationSec = 18.0;
  }

  /**
   * Start phase-by-phase ascent & orbit insertion animation.
   * @param {Object} rocket
   * @param {{ spacecraft?: Object, group: THREE.Group } | THREE.Group} spacecraftOrHandle
   * @param {Object} orbit
   * @param {import('../../../shared/interfaces/LaunchResult.js').LaunchResult} launchResult
   * @param {{ onPhaseUpdate?: Function, onComplete?: Function }} [callbacks]
   */
  start(rocket, spacecraftOrHandle, orbit, launchResult, callbacks = {}) {
    this.reset();

    this._rocket = rocket;
    this._spacecraft = spacecraftOrHandle?.spacecraft ?? null;
    this._spacecraftGroup = spacecraftOrHandle?.group ?? spacecraftOrHandle;
    this._orbit = orbit ?? { id: "LEO", orbitRadius3D: 3.0, orbitalPeriodSec: 12 };
    this._launchResult = launchResult;
    this._onPhaseUpdate = callbacks.onPhaseUpdate ?? null;
    this._onComplete = callbacks.onComplete ?? null;

    this.running = true;
    this.progress = 0;
    this._orbiting = false;
    this._failed = false;
    this._failureTriggered = false;
    this._failureHoldSec = 0;
    this._activePhaseIndex = -1;

    this._buildVehicleStack();
    if (this._spacecraft?.setSolarDeployed) {
      this._spacecraft.setSolarDeployed(false);
    }
    if (this._spacecraft?.setThrustActive) {
      this._spacecraft.setThrustActive(false);
    }
  }

  setSpeed(multiplier) {
    this.speedMultiplier = Math.max(0.5, Math.min(4, multiplier));
  }

  getGroup() {
    return this.root;
  }

  getFocusTarget() {
    return this._focusTarget;
  }

  getCameraShake() {
    return this._cameraShake;
  }

  /** Advance launch animation, debris physics, or continuous target orbit. */
  update(deltaTime) {
    const dt = Math.min(deltaTime, 0.08);
    this._cameraShake = Math.max(0, this._cameraShake - dt * 2.5);
    this._updateDebris(dt);
    this._updateFireballs(dt);

    if (this._spacecraft?.update) {
      this._spacecraft.update(dt);
    }

    if (this._orbiting) {
      this._updateContinuousOrbit(dt);
      return;
    }

    if (!this.running) return;

    if (this._failureTriggered) {
      this._failureHoldSec += dt;
      // Keep tumbling detached stack slowly
      if (this._stackGroup) {
        this._stackGroup.rotation.z += dt * 1.4;
        this._stackGroup.rotation.x += dt * 0.9;
      }
      if (this._failureHoldSec >= 2.6 / this.speedMultiplier) {
        this.running = false;
        this._onComplete?.(this._launchResult);
      }
      return;
    }

    const prevProgress = this.progress;
    this.progress = Math.min(1, prevProgress + (dt * this.speedMultiplier) / this._totalDurationSec);

    const phases = this._launchResult?.phases ?? [];
    const failedIdx = phases.findIndex((p) => p.status === "failed");

    // Determine current active phase index
    let phaseIdx = PHASE_WINDOWS.findIndex(
      (w) => this.progress >= w.start && this.progress < w.end
    );
    if (phaseIdx < 0) phaseIdx = PHASE_WINDOWS.length - 1;

    // If this mission fails at failedIdx, stop & detonate partway through that phase
    if (failedIdx >= 0) {
      const failWin = PHASE_WINDOWS[Math.min(failedIdx, PHASE_WINDOWS.length - 1)];
      const triggerPoint = failWin.start + (failWin.end - failWin.start) * 0.58;
      if (this.progress >= triggerPoint) {
        this.progress = triggerPoint;
        if (this._activePhaseIndex !== failedIdx) {
          this._activePhaseIndex = failedIdx;
          this._emitPhaseTelemetry(failedIdx);
        }
        this._triggerFailure(phases[failedIdx]);
        return;
      }
    }

    if (phaseIdx !== this._activePhaseIndex) {
      this._activePhaseIndex = phaseIdx;
      this._onPhaseEnter(phaseIdx);
    }

    this._positionVehicleAlongTrajectory(this.progress, phaseIdx);
    this._emitPhaseTelemetry(phaseIdx);

    if (this.progress >= 1 && failedIdx < 0) {
      this.running = false;
      this._orbiting = true;
      if (this._spacecraft?.setThrustActive) {
        this._spacecraft.setThrustActive(false);
      }
      this._onComplete?.(this._launchResult);
    }
  }

  /** @returns {boolean} True once orbital insertion sequence or failure animation finishes */
  isComplete() {
    return !this.running && (this.progress >= 1 || this._failureTriggered);
  }

  reset() {
    while (this.root.children.length > 0) {
      const child = this.root.children[0];
      this.root.remove(child);
      this._disposeObject(child);
    }
    this._debris = [];
    this._fireballs = [];
    this._stackGroup = null;
    this._boosterGroup = null;
    this._fairingLeft = null;
    this._fairingRight = null;
    this._rocketPlume = null;
    this._machCone = null;
    this.running = false;
    this.progress = 0;
    this._orbiting = false;
    this._failed = false;
    this._failureTriggered = false;
  }

  _buildVehicleStack() {
    this._stackGroup = new THREE.Group();
    this._stackGroup.name = "launch-vehicle-stack";

    const isHeavy =
      this._rocket?.id === "heavy-lift" || this._rocket?.id === "super-heavy";
    const bodyRadius = isHeavy ? 0.16 : 0.11;

    // First stage booster
    this._boosterGroup = new THREE.Group();
    const boosterBody = new THREE.Mesh(
      new THREE.CylinderGeometry(bodyRadius, bodyRadius * 1.08, 0.72, 16),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.45, roughness: 0.38 })
    );
    boosterBody.position.y = -0.38;
    this._boosterGroup.add(boosterBody);

    if (isHeavy) {
      [-1, 1].forEach((side) => {
        const srb = new THREE.Mesh(
          new THREE.CylinderGeometry(bodyRadius * 0.55, bodyRadius * 0.6, 0.58, 12),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.4, roughness: 0.4 })
        );
        srb.position.set(side * bodyRadius * 1.55, -0.44, 0);
        this._boosterGroup.add(srb);
      });
    }

    this._rocketPlume = new THREE.Mesh(
      new THREE.ConeGeometry(bodyRadius * 0.95, 0.55, 14),
      new THREE.MeshBasicMaterial({
        color: this._rocket?.id === "solid-sprint" ? 0xfef08a : 0xf97316,
        transparent: true,
        opacity: 0.9,
      })
    );
    this._rocketPlume.rotation.x = Math.PI;
    this._rocketPlume.position.y = -1.0;
    this._boosterGroup.add(this._rocketPlume);
    this._stackGroup.add(this._boosterGroup);

    // Fairing halves (hidden if unfaired adapter chosen)
    const hasFairing = this._launchResult?.fairingId !== "no-fairing";
    const fairingMat = new THREE.MeshStandardMaterial({
      color: this._launchResult?.fairingId === "reinforced-fairing" ? 0x94a3b8 : 0xf1f5f9,
      metalness: 0.35,
      roughness: 0.4,
      side: THREE.DoubleSide,
    });
    const halfGeo = new THREE.CylinderGeometry(
      0.04,
      bodyRadius * 1.15,
      0.56,
      14,
      1,
      false,
      0,
      Math.PI
    );
    this._fairingLeft = new THREE.Mesh(halfGeo, fairingMat);
    this._fairingLeft.position.y = 0.25;
    this._fairingLeft.visible = hasFairing;

    this._fairingRight = new THREE.Mesh(halfGeo, fairingMat);
    this._fairingRight.rotation.y = Math.PI;
    this._fairingRight.position.y = 0.25;
    this._fairingRight.visible = hasFairing;

    this._stackGroup.add(this._fairingLeft, this._fairingRight);

    // Max-Q aerodynamic shock cone
    this._machCone = new THREE.Mesh(
      new THREE.ConeGeometry(bodyRadius * 2.2, 0.65, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
      })
    );
    this._machCone.position.y = 0.3;
    this._stackGroup.add(this._machCone);

    // Mount the player's actual 3D spacecraft inside the payload bay
    if (this._spacecraftGroup) {
      this._spacecraftGroup.scale.setScalar(0.24);
      this._spacecraftGroup.position.set(0, 0.2, 0);
      this._stackGroup.add(this._spacecraftGroup);
    }

    this._stackGroup.position.set(0, 0, 1.95);
    this.root.add(this._stackGroup);
  }

  _onPhaseEnter(phaseIdx) {
    if (phaseIdx === 2 && this._boosterGroup) {
      // Stage separation: detach booster into tumbling debris
      const worldPos = new THREE.Vector3();
      this._boosterGroup.getWorldPosition(worldPos);
      this._boosterGroup.visible = false;
      this._spawnPartChunk(worldPos, new THREE.Vector3(-0.3, -0.8, 0.2), 0xe2e8f0, 0.24);
    }

    if (phaseIdx === 3) {
      // Fairing jettison + solar panel deployment
      if (this._fairingLeft?.visible) {
        const pos = new THREE.Vector3();
        this._stackGroup.getWorldPosition(pos);
        this._fairingLeft.visible = false;
        this._fairingRight.visible = false;
        this._spawnPartChunk(pos, new THREE.Vector3(-0.9, 0.4, 0.3), 0xf1f5f9, 0.16);
        this._spawnPartChunk(pos, new THREE.Vector3(0.9, -0.4, 0.3), 0xf1f5f9, 0.16);
      }
      if (this._spacecraft?.setSolarDeployed) {
        this._spacecraft.setSolarDeployed(true);
      }
    }

    if (phaseIdx === 4 || phaseIdx === 6) {
      this._spacecraft?.setThrustActive?.(true);
    } else if (phaseIdx === 5) {
      this._spacecraft?.setThrustActive?.(false);
    }
  }

  _positionVehicleAlongTrajectory(progress, phaseIdx) {
    if (!this._stackGroup) return;

    const leoRadius = 3.0;
    const targetRadius = this._orbit?.orbitRadius3D ?? 3.0;
    const isDeep = this._orbit?.id === "LUNAR" || this._orbit?.id === "MARS";

    // Ascent from Earth surface (z=1.9) to LEO parking orbit (z=3.0) during phases 0..2
    if (progress < 0.44) {
      const t = progress / 0.44;
      const r = 1.92 + (leoRadius - 1.92) * t;
      const arcAngle = t * 0.45;
      this._stackGroup.position.set(
        Math.sin(arcAngle) * r * 0.35,
        Math.sin(t * Math.PI) * 0.35,
        Math.cos(arcAngle) * r
      );
      this._stackGroup.rotation.set(0.35 * t, 0, -0.25 * t);

      if (this._machCone) {
        this._machCone.material.opacity = phaseIdx === 1 ? 0.34 : 0.0;
      }
      if (this._rocketPlume) {
        this._rocketPlume.scale.set(1, 0.8 + Math.random() * 0.45, 1);
      }
    } else if (progress < 0.58) {
      // LEO coast & deployment
      if (this._machCone) this._machCone.material.opacity = 0;
      const t = (progress - 0.44) / 0.14;
      const angle = 0.25 + t * 0.35;
      this._stackGroup.position.set(Math.sin(angle) * leoRadius * 0.5, 0, Math.cos(angle) * leoRadius);
      this._stackGroup.rotation.set(Math.PI * 0.45, angle, 0);
    } else if (isDeep) {
      // Transfer & Cruise to Moon or Mars
      const t = (progress - 0.58) / 0.42;
      const p0 = new THREE.Vector3(0.7, 0, leoRadius * 0.92);
      const p1 = new THREE.Vector3(targetRadius * 0.45, 0.85, targetRadius * 0.32);
      const p2 = new THREE.Vector3(targetRadius * 0.82, 0.38, -0.85);
      const destR = this._orbit.id === "MARS" ? 1.6 : 1.37;
      const p3 = new THREE.Vector3(targetRadius, 0, -destR);

      const pos = this._sampleCatmull(p0, p1, p2, p3, t);
      this._stackGroup.position.copy(pos);
      const nextPos = this._sampleCatmull(p0, p1, p2, p3, Math.min(1, t + 0.02));
      this._stackGroup.lookAt(nextPos);
    } else if (this._orbit?.id !== "LEO") {
      // MEO / GEO Hohmann climb
      const t = (progress - 0.58) / 0.42;
      const r = leoRadius + (targetRadius - leoRadius) * t;
      const a = t * Math.PI * 0.65;
      this._stackGroup.position.set(Math.sin(a) * r, 0.15 * Math.sin(t * Math.PI), Math.cos(a) * r);
    } else {
      // LEO stabilization
      const t = (progress - 0.58) / 0.42;
      const a = 0.6 + t * 1.2;
      this._stackGroup.position.set(Math.sin(a) * leoRadius, 0, Math.cos(a) * leoRadius);
    }

    this._focusTarget.copy(this._stackGroup.position);
  }

  _sampleCatmull(p0, p1, p2, p3, t) {
    const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
    return curve.getPoint(Math.max(0, Math.min(1, t)));
  }

  _updateContinuousOrbit(dt) {
    if (!this._stackGroup) return;
    const period = this._orbit?.orbitalPeriodSec ?? 14;
    this._orbitAngle += (dt / period) * Math.PI * 2;

    if (this._orbit?.id === "LUNAR" || this._orbit?.id === "MARS") {
      const centerX = this._orbit.orbitRadius3D;
      const localR = this._orbit.id === "MARS" ? 1.6 : 1.37;
      this._stackGroup.position.set(
        centerX + Math.cos(this._orbitAngle) * 0.25,
        Math.sin(this._orbitAngle) * localR,
        Math.cos(this._orbitAngle) * localR
      );
      this._focusTarget.set(centerX, 0, 0);
    } else {
      const r = this._orbit?.orbitRadius3D ?? 3.0;
      this._stackGroup.position.set(
        Math.sin(this._orbitAngle) * r,
        0,
        Math.cos(this._orbitAngle) * r
      );
      this._focusTarget.set(0, 0, 0);
    }
    this._stackGroup.rotation.y += dt * 0.6;
  }

  _triggerFailure(failedPhase) {
    this._failed = true;
    this._failureTriggered = true;
    this._cameraShake = 0.65;

    if (this._rocketPlume) this._rocketPlume.visible = false;
    if (this._machCone) this._machCone.visible = false;
    this._spacecraft?.setThrustActive?.(false);

    const mode = this._launchResult?.failureMode || "explosion";
    const origin = this._stackGroup ? this._stackGroup.position.clone() : new THREE.Vector3();

    if (mode === "explosion" || mode === "structural-breakup" || mode === "suborbital-fall") {
      this._spawnExplosion(origin, mode === "explosion" ? 1.35 : 1.0);
      // Scatter visual debris fragments
      if (this._fairingLeft?.visible) {
        this._fairingLeft.visible = false;
        this._fairingRight.visible = false;
        this._spawnPartChunk(origin, new THREE.Vector3(-1.8, 1.2, 0.7), 0xf1f5f9, 0.18);
        this._spawnPartChunk(origin, new THREE.Vector3(1.6, -0.9, 1.1), 0xf1f5f9, 0.18);
      }
      if (this._boosterGroup?.visible) {
        this._boosterGroup.visible = false;
        this._spawnPartChunk(origin, new THREE.Vector3(0.4, -1.6, -0.8), 0xef4444, 0.22);
      }
      if (this._spacecraftGroup && mode === "structural-breakup") {
        this._spawnPartChunk(origin, new THREE.Vector3(1.4, 1.3, 0.4), 0x1d4ed8, 0.16);
        this._spawnPartChunk(origin, new THREE.Vector3(-1.3, 1.1, -0.5), 0x1d4ed8, 0.16);
      }
      if (mode === "explosion" && this._stackGroup) {
        this._stackGroup.visible = false;
      }
    } else if (mode === "thermal-failure") {
      this._spawnSparkBurst(origin, 0xef4444, 34);
    } else if (mode === "radiation-fried" || mode === "power-loss" || mode === "signal-lost") {
      this._spawnSparkBurst(origin, 0x38bdf8, 30);
    } else {
      // missed-capture
      this._spawnSparkBurst(origin, 0xf59e0b, 28);
    }

    this._onPhaseUpdate?.(this._activePhaseIndex, failedPhase, {
      failed: true,
      failureMode: mode,
    });
  }

  _spawnExplosion(origin, scale = 1.0) {
    // Expanding bright fireball core + outer blast shell
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 * scale, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.96 })
    );
    core.position.copy(origin);
    this.root.add(core);
    this._fireballs.push({ mesh: core, age: 0, maxAge: 1.4, growRate: 3.6 * scale });

    const blast = new THREE.Mesh(
      new THREE.SphereGeometry(0.24 * scale, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.85 })
    );
    blast.position.copy(origin);
    this.root.add(blast);
    this._fireballs.push({ mesh: blast, age: 0, maxAge: 1.8, growRate: 4.8 * scale });

    // Shockwave ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.2 * scale, 0.03, 10, 32),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.9 })
    );
    ring.position.copy(origin);
    ring.lookAt(0, 0, 10);
    this.root.add(ring);
    this._fireballs.push({ mesh: ring, age: 0, maxAge: 1.2, growRate: 6.5 * scale });

    this._spawnSparkBurst(origin, 0xf97316, 46);
  }

  _spawnSparkBurst(origin, color, count = 32) {
    const geo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0xfef08a : color,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(origin);
      this.root.add(mesh);
      const speed = 1.2 + Math.random() * 2.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      this._debris.push({
        mesh,
        vel: new THREE.Vector3(
          speed * Math.sin(phi) * Math.cos(theta),
          speed * Math.sin(phi) * Math.sin(theta),
          speed * Math.cos(phi)
        ),
        spin: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        age: 0,
        maxAge: 1.6 + Math.random() * 1.1,
      });
    }
  }

  _spawnPartChunk(origin, vel, color, size) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size * 1.6, size * 0.6),
      new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.4, transparent: true, opacity: 1 })
    );
    mesh.position.copy(origin);
    this.root.add(mesh);
    this._debris.push({
      mesh,
      vel,
      spin: new THREE.Vector3(3.2, 4.5, 2.1),
      age: 0,
      maxAge: 2.8,
    });
  }

  _updateDebris(dt) {
    for (let i = this._debris.length - 1; i >= 0; i--) {
      const d = this._debris[i];
      d.age += dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.spin.x * dt;
      d.mesh.rotation.y += d.spin.y * dt;
      d.mesh.rotation.z += d.spin.z * dt;
      const t = d.age / d.maxAge;
      if (d.mesh.material) {
        d.mesh.material.opacity = Math.max(0, 1 - t);
      }
      if (d.age >= d.maxAge) {
        this.root.remove(d.mesh);
        this._disposeObject(d.mesh);
        this._debris.splice(i, 1);
      }
    }
  }

  _updateFireballs(dt) {
    for (let i = this._fireballs.length - 1; i >= 0; i--) {
      const f = this._fireballs[i];
      f.age += dt;
      const s = 1 + f.age * f.growRate;
      f.mesh.scale.setScalar(s);
      const t = f.age / f.maxAge;
      if (f.mesh.material) {
        f.mesh.material.opacity = Math.max(0, 1 - t);
      }
      if (f.age >= f.maxAge) {
        this.root.remove(f.mesh);
        this._disposeObject(f.mesh);
        this._fireballs.splice(i, 1);
      }
    }
  }

  _emitPhaseTelemetry(phaseIdx) {
    const phases = this._launchResult?.phases ?? [];
    const phase = phases[phaseIdx];
    if (!phase) return;

    const altitudes = [12, 38, 190, 500, 3200, this._orbit?.altitudeKm * 0.5 || 15000, this._orbit?.altitudeKm || 500];
    const velocities = [0.6, 1.8, 7.2, 7.62, 10.4, 3.8, 1.6];

    this._onPhaseUpdate?.(phaseIdx, phase, {
      failed: false,
      altitudeKm: Math.round(altitudes[phaseIdx] ?? 500),
      velocityKms: Number((velocities[phaseIdx] ?? 7.6).toFixed(2)),
      progress: this.progress,
    });
  }

  _disposeObject(root) {
    root.traverse((obj) => {
      if (obj.userData?.sharedAsset) return;
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }
}
