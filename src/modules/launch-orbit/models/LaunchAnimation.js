/**
 * @file src/modules/launch-orbit/models/LaunchAnimation.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Animates the rocket ascent from Earth, Max-Q buffeting, stage/fairing separation,
 *       solar deployment, transfer burn, cruise, and target orbit insertion — plus visible
 *       3D explosions, structural breakups, and debris physics when any flight phase fails.
 */

import * as THREE from "three";
import { PlanetScene } from "./PlanetScene.js";

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
    this._secondaryBlastOrigin = null;
    this._orbitAngle = 0;

    this._rocket = null;
    this._spacecraft = null;
    this._spacecraftGroup = null;
    this._orbit = null;
    this._launchResult = null;
    this._siteFrame = null;
    this._getSiteFrame = null;
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
    this._getSiteFrame = callbacks.getSiteFrame ?? null;
    this._siteFrame = callbacks.siteFrame ?? this._resolveDefaultSiteFrame();
    this._onPhaseUpdate = callbacks.onPhaseUpdate ?? null;
    this._onComplete = callbacks.onComplete ?? null;

    this.running = true;
    this.progress = 0;
    this._orbiting = false;
    this._failed = false;
    this._failureTriggered = false;
    this._failureHoldSec = 0;
    this._secondaryBlastOrigin = null;
    this._activePhaseIndex = -1;
    this._orbitAngle =
      this._orbit?.id === "LEO"
        ? 1.82
        : this._orbit?.id === "MEO" || this._orbit?.id === "GEO"
          ? 0
          : 0;

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
      if (this._secondaryBlastOrigin && this._failureHoldSec >= 0.28 / this.speedMultiplier) {
        this._spawnExplosion(this._secondaryBlastOrigin, 0.55, false);
        this._secondaryBlastOrigin = null;
      }
      // Keep tumbling detached stack slowly only if still intact
      if (this._stackGroup && this._stackGroup.visible) {
        this._stackGroup.rotation.z += dt * 1.4;
        this._stackGroup.rotation.x += dt * 0.9;
      }
      if (this._failureHoldSec >= 3.0 / this.speedMultiplier) {
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
    this._secondaryBlastOrigin = null;
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
      this._spacecraftGroup.visible = true;
      this._spacecraftGroup.scale.setScalar(0.24);
      this._spacecraftGroup.position.set(0, 0.2, 0);
      this._stackGroup.add(this._spacecraftGroup);
    }

    const frame = this._getCurrentSiteFrame();
    const padStandRadius = (frame.earthRadius ?? 1.8) + 0.42;
    this._stackGroup.scale.setScalar(0.55);
    this._stackGroup.position.copy(frame.up).multiplyScalar(padStandRadius);
    this._alignVehicleToAxes(frame.up, frame.heading);
    this._focusTarget.copy(this._stackGroup.position);
    this.root.add(this._stackGroup);
  }

  _resolveDefaultSiteFrame() {
    const latDeg = 28.6;
    const lonDeg = -80.6;
    const azDeg = this._launchResult?.missionStats?.launchAzimuthDeg ?? 90;
    const earthRadius = 1.8;
    const up = PlanetScene.latLonToVector3(latDeg, lonDeg, earthRadius).normalize();
    const lonRad = THREE.MathUtils.degToRad(lonDeg);
    const azRad = THREE.MathUtils.degToRad(azDeg);
    const east = new THREE.Vector3(-Math.sin(lonRad), 0, -Math.cos(lonRad)).normalize();
    const north = up.clone().cross(east).normalize();
    const heading = north
      .clone()
      .multiplyScalar(Math.cos(azRad))
      .addScaledVector(east, Math.sin(azRad))
      .normalize();
    const planeNormal = up.clone().cross(heading).normalize();
    return {
      earthRadius,
      surfacePos: up.clone().multiplyScalar(earthRadius),
      up,
      east,
      north,
      heading,
      planeNormal,
    };
  }

  _getCurrentSiteFrame() {
    if (typeof this._getSiteFrame === "function") {
      return this._getSiteFrame() ?? this._siteFrame ?? this._resolveDefaultSiteFrame();
    }
    return this._siteFrame ?? this._resolveDefaultSiteFrame();
  }

  _alignVehicleToAxes(noseDir, refForward) {
    if (!this._stackGroup) return;
    const yAxis = noseDir.clone().normalize();
    const candidate = refForward?.clone() ?? new THREE.Vector3(1, 0, 0);
    if (Math.abs(yAxis.dot(candidate)) > 0.96) {
      candidate.set(0, 1, 0);
      if (Math.abs(yAxis.dot(candidate)) > 0.96) {
        candidate.set(0, 0, 1);
      }
    }
    const zAxis = candidate.clone().cross(yAxis).normalize();
    const xAxis = yAxis.clone().cross(zAxis).normalize();
    const mat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    this._stackGroup.quaternion.setFromRotationMatrix(mat);
  }

  _smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
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

    const frame = this._getCurrentSiteFrame();
    const { up: u0, heading } = frame;
    const padStandRadius = (frame.earthRadius ?? 1.8) + 0.42;
    const leoRadius = 3.0;
    const targetRadius = this._orbit?.orbitRadius3D ?? 3.0;
    const isDeep = this._orbit?.id === "LUNAR" || this._orbit?.id === "MARS";
    const deployAngle = 0.72;

    const leoDeparture = u0
      .clone()
      .multiplyScalar(Math.cos(deployAngle) * leoRadius)
      .addScaledVector(heading, Math.sin(deployAngle) * leoRadius);
    const leoDepartureDir = u0
      .clone()
      .multiplyScalar(-Math.sin(deployAngle))
      .addScaledVector(heading, Math.cos(deployAngle))
      .normalize();

    // Ascent from KSC LC-39A pad (vertical liftoff -> eastward gravity turn into LEO plane)
    if (progress < 0.44) {
      const t = progress / 0.44;
      const radialGain = Math.pow(t, 0.85);
      const r = padStandRadius + (leoRadius - padStandRadius) * radialGain;
      const downrangeAngle = 0.48 * Math.pow(t, 1.45);

      const radial = u0
        .clone()
        .multiplyScalar(Math.cos(downrangeAngle))
        .addScaledVector(heading, Math.sin(downrangeAngle))
        .normalize();
      const tangent = u0
        .clone()
        .multiplyScalar(-Math.sin(downrangeAngle))
        .addScaledVector(heading, Math.cos(downrangeAngle))
        .normalize();

      this._stackGroup.position.copy(radial).multiplyScalar(r);

      const pitchT = this._smoothstep(0.1, 0.88, t);
      const pitchAngle = pitchT * (Math.PI / 2);
      const noseDir = radial
        .clone()
        .multiplyScalar(Math.cos(pitchAngle))
        .addScaledVector(tangent, Math.sin(pitchAngle))
        .normalize();
      this._alignVehicleToAxes(noseDir, radial);

      if (this._machCone) {
        this._machCone.material.opacity = phaseIdx === 1 ? 0.34 : 0.0;
      }
      if (this._rocketPlume) {
        this._rocketPlume.scale.set(1, 0.8 + Math.random() * 0.45, 1);
      }
    } else if (progress < 0.58) {
      // LEO parking coast & deployment along KSC orbital plane (0.48 -> 0.72 rad)
      if (this._machCone) this._machCone.material.opacity = 0;
      const t = (progress - 0.44) / 0.14;
      const angle = 0.48 + t * (deployAngle - 0.48);
      const radial = u0
        .clone()
        .multiplyScalar(Math.cos(angle))
        .addScaledVector(heading, Math.sin(angle))
        .normalize();
      const tangent = u0
        .clone()
        .multiplyScalar(-Math.sin(angle))
        .addScaledVector(heading, Math.cos(angle))
        .normalize();

      this._stackGroup.position.copy(radial).multiplyScalar(leoRadius);
      this._alignVehicleToAxes(tangent, radial);
    } else if (isDeep) {
      // Outbound transfer & cruise from LEO departure point to Moon or Mars capture ring
      const t = (progress - 0.58) / 0.42;
      const p1 = leoDeparture.clone().addScaledVector(leoDepartureDir, targetRadius * 0.35);
      p1.x = Math.max(p1.x, targetRadius * 0.42);
      const p2 = new THREE.Vector3(targetRadius * 0.78, 0.35, -0.95);
      const destR = this._orbit.id === "MARS" ? 1.6 : 1.37;
      const p3 = new THREE.Vector3(targetRadius, 0, -destR);

      const pos = this._sampleCatmull(leoDeparture, p1, p2, p3, t);
      this._stackGroup.position.copy(pos);
      const nextPos = this._sampleCatmull(leoDeparture, p1, p2, p3, Math.min(1, t + 0.02));
      const travelDir = nextPos.clone().sub(pos);
      if (travelDir.lengthSq() > 1e-6) {
        this._alignVehicleToAxes(travelDir.normalize(), pos);
      }
    } else if (this._orbit?.id !== "LEO") {
      // MEO / GEO transfer arc from LEO departure point to target orbit ring
      const t = (progress - 0.58) / 0.42;
      const p1 = leoDeparture
        .clone()
        .addScaledVector(leoDepartureDir, targetRadius * 0.45)
        .setLength(targetRadius * 0.76);
      const p2 = new THREE.Vector3(targetRadius, 0, 0);
      const curve = new THREE.CatmullRomCurve3([leoDeparture, p1, p2]);
      const pos = curve.getPoint(Math.max(0, Math.min(1, t)));
      const nextPos = curve.getPoint(Math.max(0, Math.min(1, t + 0.02)));
      this._stackGroup.position.copy(pos);
      const travelDir = nextPos.clone().sub(pos);
      if (travelDir.lengthSq() > 1e-6) {
        this._alignVehicleToAxes(travelDir.normalize(), pos);
      }
    } else {
      // LEO stabilization along site orbital plane
      const t = (progress - 0.58) / 0.42;
      const a = deployAngle + t * 1.1;
      const radial = u0
        .clone()
        .multiplyScalar(Math.cos(a))
        .addScaledVector(heading, Math.sin(a))
        .normalize();
      const tangent = u0
        .clone()
        .multiplyScalar(-Math.sin(a))
        .addScaledVector(heading, Math.cos(a))
        .normalize();
      this._stackGroup.position.copy(radial).multiplyScalar(leoRadius);
      this._alignVehicleToAxes(tangent, radial);
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
      this._stackGroup.rotation.y += dt * 0.6;
    } else if (this._orbit?.id === "LEO") {
      const frame = this._getCurrentSiteFrame();
      const leoRadius = 3.0;
      const radial = frame.up
        .clone()
        .multiplyScalar(Math.cos(this._orbitAngle))
        .addScaledVector(frame.heading, Math.sin(this._orbitAngle))
        .normalize();
      const tangent = frame.up
        .clone()
        .multiplyScalar(-Math.sin(this._orbitAngle))
        .addScaledVector(frame.heading, Math.cos(this._orbitAngle))
        .normalize();
      this._stackGroup.position.copy(radial).multiplyScalar(leoRadius);
      this._alignVehicleToAxes(tangent, radial);
      this._focusTarget.set(0, 0, 0);
    } else {
      const r = this._orbit?.orbitRadius3D ?? 3.0;
      const inclRad = ((this._orbit?.inclinationDeg ?? 0) * Math.PI) / 180;
      const localPos = new THREE.Vector3(
        Math.cos(this._orbitAngle) * r,
        0,
        Math.sin(this._orbitAngle) * r
      );
      localPos.applyAxisAngle(new THREE.Vector3(1, 0, 0), inclRad);
      this._stackGroup.position.copy(localPos);
      this._focusTarget.set(0, 0, 0);
      this._stackGroup.rotation.y += dt * 0.6;
    }
  }

  _triggerFailure(failedPhase) {
    this._failed = true;
    this._failureTriggered = true;

    const mode = this._launchResult?.failureMode || "explosion";
    if (mode === "insufficient-science" || mode === "science-warning") {
      this._cameraShake = 0;
      this._onPhaseUpdate?.(this._activePhaseIndex, failedPhase, {
        failed: false,
        warning: true,
        failureMode: mode,
      });
      return;
    }

    this._cameraShake = 0.75;

    if (this._rocketPlume) this._rocketPlume.visible = false;
    if (this._machCone) this._machCone.visible = false;
    this._spacecraft?.setThrustActive?.(false);

    const origin = this._stackGroup ? this._stackGroup.position.clone() : new THREE.Vector3();

    if (mode === "explosion" || mode === "structural-breakup" || mode === "suborbital-fall") {
      const blastScale = mode === "explosion" ? 1.35 : 1.15;
      this._spawnExplosion(origin, blastScale, true);
      this._secondaryBlastOrigin = origin.clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4)
      );

      // Break the actual spacecraft and vehicle into tumbling parts that fade out and disappear
      this._shatterGroupIntoParts(this._spacecraftGroup, origin, 1.5, 2.4);
      if (this._spacecraftGroup) {
        this._spacecraftGroup.visible = false;
      }
      if (this._fairingLeft?.visible) {
        this._shatterGroupIntoParts(this._fairingLeft, origin, 1.8, 2.1);
        this._shatterGroupIntoParts(this._fairingRight, origin, 1.8, 2.1);
        this._fairingLeft.visible = false;
        this._fairingRight.visible = false;
      }
      if (this._boosterGroup?.visible) {
        this._shatterGroupIntoParts(this._boosterGroup, origin, 1.2, 2.3);
        this._boosterGroup.visible = false;
      }
      if (this._stackGroup) {
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

  /**
   * Detach real 3D child parts of a vehicle/spacecraft group into independent
   * tumbling debris that fly outward and fade until completely gone.
   */
  _shatterGroupIntoParts(sourceGroup, origin, blastSpeed = 1.4, maxAge = 2.4) {
    if (!sourceGroup || !sourceGroup.children.length) return;
    sourceGroup.updateMatrixWorld(true);
    this.root.updateMatrixWorld(true);

    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();

    for (const child of sourceGroup.children) {
      if (!child.visible) continue;
      child.getWorldPosition(worldPos);
      child.getWorldQuaternion(worldQuat);
      child.getWorldScale(worldScale);

      const localPos = this.root.worldToLocal(worldPos.clone());
      const part = child.clone(true);
      part.position.copy(localPos);
      part.quaternion.copy(worldQuat);
      part.scale.copy(worldScale);

      part.traverse((obj) => {
        if (obj.userData?.sharedAsset) {
          obj.userData = { ...obj.userData, sharedAsset: false };
        }
        if (obj.material) {
          const cloneMat = (m) => {
            const c = m.clone();
            c.transparent = true;
            c.opacity = 1;
            return c;
          };
          obj.material = Array.isArray(obj.material)
            ? obj.material.map(cloneMat)
            : cloneMat(obj.material);
        }
      });

      this.root.add(part);

      const radial = localPos.clone().sub(origin);
      if (radial.lengthSq() < 1e-4) {
        radial.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      }
      radial.normalize();

      const speed = blastSpeed * (0.75 + Math.random() * 0.9);
      const vel = radial.multiplyScalar(speed).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.9,
          (Math.random() - 0.5) * 0.9,
          (Math.random() - 0.5) * 0.9
        )
      );

      this._debris.push({
        mesh: part,
        vel,
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 7.5,
          (Math.random() - 0.5) * 7.5,
          (Math.random() - 0.5) * 7.5
        ),
        age: 0,
        maxAge: maxAge * (0.85 + Math.random() * 0.3),
        fadeStart: 0.42,
        drag: 0.45,
      });
    }
  }

  _spawnExplosion(origin, scale = 1.0, includeSmoke = true) {
    // 1. Blinding white-yellow core flash
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.16 * scale, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 })
    );
    flash.position.copy(origin);
    this.root.add(flash);
    this._fireballs.push({ mesh: flash, age: 0, maxAge: 0.45, growRate: 6.2 * scale });

    // 2. Multi-lobe orange/red plasma fireballs
    const lobes = [
      { offset: [0, 0, 0], color: 0xfef08a, r: 0.18, maxAge: 1.0, grow: 3.8 },
      { offset: [0.09, 0.06, -0.05], color: 0xf97316, r: 0.22, maxAge: 1.45, grow: 4.5 },
      { offset: [-0.08, -0.05, 0.07], color: 0xef4444, r: 0.2, maxAge: 1.6, grow: 4.1 },
    ];
    for (const lobe of lobes) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(lobe.r * scale, 18, 14),
        new THREE.MeshBasicMaterial({ color: lobe.color, transparent: true, opacity: 0.88 })
      );
      mesh.position.copy(origin).add(
        new THREE.Vector3(lobe.offset[0] * scale, lobe.offset[1] * scale, lobe.offset[2] * scale)
      );
      this.root.add(mesh);
      this._fireballs.push({
        mesh,
        age: 0,
        maxAge: lobe.maxAge,
        growRate: lobe.grow * scale,
      });
    }

    // 3. Expanding shockwave rings
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.18 * scale, 0.024, 10, 32),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85 })
      );
      ring.position.copy(origin);
      ring.rotation.set(i === 0 ? 0.35 : 1.2, i === 0 ? 0.2 : -0.7, 0);
      this.root.add(ring);
      this._fireballs.push({ mesh: ring, age: 0, maxAge: 0.9, growRate: 7.5 * scale });
    }

    // 4. Lingering dark smoke / soot puffs
    if (includeSmoke) {
      for (let i = 0; i < 6; i++) {
        const smoke = new THREE.Mesh(
          new THREE.SphereGeometry((0.15 + Math.random() * 0.08) * scale, 12, 10),
          new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? 0x1e293b : 0x334155,
            transparent: true,
            opacity: 0.55,
          })
        );
        smoke.position.copy(origin).add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.25 * scale,
            (Math.random() - 0.5) * 0.25 * scale,
            (Math.random() - 0.5) * 0.25 * scale
          )
        );
        this.root.add(smoke);
        this._fireballs.push({
          mesh: smoke,
          age: 0,
          maxAge: 2.1 + Math.random() * 0.5,
          growRate: (2.2 + Math.random() * 1.1) * scale,
        });
      }
    }

    this._spawnSparkBurst(origin, 0xf97316, includeSmoke ? 54 : 26);
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
      if (d.drag) {
        d.vel.multiplyScalar(Math.max(0, 1 - d.drag * dt));
      }
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.spin.x * dt;
      d.mesh.rotation.y += d.spin.y * dt;
      d.mesh.rotation.z += d.spin.z * dt;
      const t = d.age / d.maxAge;
      const fadeStart = d.fadeStart ?? 0;
      const opacity =
        t <= fadeStart ? 1 : Math.max(0, 1 - (t - fadeStart) / Math.max(1e-4, 1 - fadeStart));
      d.mesh.traverse((obj) => {
        if (!obj.material) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          m.opacity = opacity;
        });
      });
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
