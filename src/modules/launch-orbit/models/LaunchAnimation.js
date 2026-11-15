/**
 * @file src/modules/launch-orbit/models/LaunchAnimation.js
 * @owner Member 3 (Launch & Orbit)
 * @goal High-fidelity 3D launch and orbital insertion visualization.
 *       Features scientifically rigorous multi-stage rocket models (booster, interstage,
 *       vacuum upper stage, engine bell clusters, aerodynamic grid/base fins, side boosters,
 *       and clamshell payload fairings) with realistic MECO, staging, Korolev cross separation,
 *       vacuum engine ignition, and dynamic flight telemetry.
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

    // Vehicle 3D hierarchy
    this._stackGroup = null;
    this._stage1Group = null;
    this._stage2Group = null;
    this._interstageMesh = null;
    this._sideBoosterGroups = [];
    this._fairingLeft = null;
    this._fairingRight = null;

    // Propulsion & aerodynamic visuals
    this._stage1Plumes = [];
    this._sideBoosterPlumes = [];
    this._stage2Plume = null;
    this._rocketPlume = null; // Backwards-compatible alias for primary plume
    this._boosterGroup = null; // Backwards-compatible alias for stage 1

    // Staging state
    this._sideBoostersSeparated = false;
    this._stage1Separated = false;
    this._fairingSeparated = false;
    this._stage2Separated = false;
    this._separatingParts = [];

    // Particle & VFX arrays
    this._debris = [];
    this._fireballs = [];
    this._plumeSpawnAccum = 0;
    this._padStandRadius = 2.12;
    this._stackScale = 0.22;
    this._countdownTotalSec = 2.4;
    this._countdownRemaining = 0;
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
    this._countdownRemaining = this._countdownTotalSec;
    this._plumeSpawnAccum = 0;
    this._orbitAngle =
      this._orbit?.id === "LEO"
        ? 1.82
        : this._orbit?.id === "MEO" || this._orbit?.id === "GEO"
          ? 0
          : 0;

    this._sideBoostersSeparated = false;
    this._stage1Separated = false;
    this._fairingSeparated = false;
    this._stage2Separated = false;

    if (this._spacecraft?.setSolarDeployed) {
      this._spacecraft.setSolarDeployed(false);
    }
    if (this._spacecraft?.setThrustActive) {
      this._spacecraft.setThrustActive(false);
    }

    this._buildVehicleStack();
    // Hold main engine plumes off until T-0 ignition
    this._setBoostPlumesVisible(false);
  }

  setSpeed(multiplier) {
    this.speedMultiplier = Math.max(0.5, Math.min(100, multiplier));
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

  isCountdownActive() {
    return this.running && this._countdownRemaining > 0;
  }

  _setBoostPlumesVisible(visible) {
    for (const plume of this._stage1Plumes) {
      plume.visible = visible;
    }
    for (const plume of this._sideBoosterPlumes) {
      plume.visible = visible;
    }
  }

  /** Advance launch animation, countdown, plumes, debris physics, staging separation, and camera shake. */
  update(deltaTime) {
    const dt = Math.min(deltaTime, 0.08);
    this._cameraShake = Math.max(0, this._cameraShake - dt * 2.5);
    this._updateDebris(dt);
    this._updateFireballs(dt);
    this._updateSeparatingParts(dt);

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
      const blastDelay = 0.28 / Math.min(this.speedMultiplier, 8);
      if (this._secondaryBlastOrigin && this._failureHoldSec >= blastDelay) {
        this._spawnExplosion(this._secondaryBlastOrigin, 0.55, false);
        this._secondaryBlastOrigin = null;
      }
      // Keep tumbling detached stack slowly only if still intact
      if (this._stackGroup && this._stackGroup.visible) {
        this._stackGroup.rotation.z += dt * 1.4;
        this._stackGroup.rotation.x += dt * 0.9;
      }
      if (this._failureHoldSec >= 3.0 / Math.min(this.speedMultiplier, 8)) {
        this.running = false;
        this._onComplete?.(this._launchResult);
      }
      return;
    }

    // Pre-launch terminal countdown (T-3 .. T-2 .. T-1 -> Ignition)
    if (this._countdownRemaining > 0) {
      const countdownRate = Math.min(4, this.speedMultiplier);
      this._countdownRemaining = Math.max(0, this._countdownRemaining - dt * countdownRate);
      this._positionVehicleAlongTrajectory(0, 0);
      this._emitCryoVentParticles(dt);

      const countdownSec =
        this._countdownRemaining > 0
          ? Math.max(1, Math.ceil((this._countdownRemaining / this._countdownTotalSec) * 3))
          : 0;
      const phases = this._launchResult?.phases ?? [];
      if (phases[0]) {
        const snap = this._computeLiveTelemetrySnapshot(0);
        this._onPhaseUpdate?.(0, phases[0], {
          ...snap,
          failed: false,
          countdownSec,
          altitudeKm: 0,
          velocityKms: 0,
          gLoad: 1.0,
          propellantPct: 100,
        });
      }

      if (this._countdownRemaining > 0) {
        return;
      }
      // T-0 Main Engine Ignition!
      this._setBoostPlumesVisible(true);
      this._cameraShake = Math.max(this._cameraShake, 0.35);
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

    // Failure interrupt (for ascent G-load failures, trigger at exact computed burnout crossing)
    if (failedIdx >= 0) {
      const failWin = PHASE_WINDOWS[Math.min(failedIdx, PHASE_WINDOWS.length - 1)];
      const failedPhase = phases[failedIdx];
      const frac =
        failedPhase?.id === "ascent" &&
        typeof failedPhase?.metrics?.ascentFailureFraction === "number"
          ? Math.max(0.15, Math.min(0.95, failedPhase.metrics.ascentFailureFraction))
          : 0.58;
      const triggerPoint = failWin.start + (failWin.end - failWin.start) * frac;
      if (this.progress >= triggerPoint) {
        this.progress = triggerPoint;
        this._activePhaseIndex = failedIdx;
        this._positionVehicleAlongTrajectory(this.progress, failedIdx);
        this._emitPhaseTelemetry(failedIdx);
        this._triggerFailure(failedPhase);
        return;
      }
    }

    if (phaseIdx !== this._activePhaseIndex) {
      this._activePhaseIndex = phaseIdx;
      this._onPhaseEnter(phaseIdx);
    }

    // Dynamic staging transitions within ascent & deployment (progress 0.33 to 0.46)
    this._handleAscentStagingSequence(this.progress);

    this._positionVehicleAlongTrajectory(this.progress, phaseIdx);
    this._emitPhaseTelemetry(phaseIdx);

    // Dynamic plume flicker + exhaust stream particles
    this._animatePlumes(dt);

    if (this.progress >= 1 && failedIdx < 0) {
      this.running = false;
      this._orbiting = true;
      if (this._spacecraft?.setThrustActive) {
        this._spacecraft.setThrustActive(false);
      }
      if (this._stage2Plume) {
        this._stage2Plume.visible = false;
      }
      this._onComplete?.(this._launchResult);
    }
  }

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
    this._separatingParts = [];
    this._stackGroup = null;
    this._stage1Group = null;
    this._stage2Group = null;
    this._interstageMesh = null;
    this._sideBoosterGroups = [];
    this._stage1Plumes = [];
    this._sideBoosterPlumes = [];
    this._stage2Plume = null;
    this._fairingLeft = null;
    this._fairingRight = null;
    this._rocketPlume = null;
    this._boosterGroup = null;

    this.running = false;
    this.progress = 0;
    this._orbiting = false;
    this._failed = false;
    this._failureTriggered = false;
    this._failureHoldSec = 0;
    this._countdownRemaining = 0;
    this._plumeSpawnAccum = 0;
    this._secondaryBlastOrigin = null;
    this._sideBoostersSeparated = false;
    this._stage1Separated = false;
    this._fairingSeparated = false;
    this._stage2Separated = false;
  }

  /**
   * Constructs the full multi-stage launch vehicle with realistic dimensions,
   * detailed engine clusters, interstage adapter, vacuum upper stage, and fairing.
   */
  _buildVehicleStack() {
    this._stackGroup = new THREE.Group();
    this._stackGroup.name = "launch-vehicle-stack";

    const v = this._rocket?.visuals ?? {};
    const coreRadius = (v.coreDiameter ?? 0.22) / 2;
    const totalHeight = v.coreHeight ?? 2.0;
    const stage1Ratio = v.stage1Ratio ?? 0.72;
    const stage2Ratio = v.stage2Ratio ?? 0.28;

    const s1Height = totalHeight * stage1Ratio;
    const s2Height = totalHeight * stage2Ratio;
    const interstageHeight = s1Height * 0.08;

    const primaryColor = v.primaryColor ?? 0xf1f5f9;
    const accentColor = v.accentColor ?? 0x0f172a;
    const interstageColor = v.interstageColor ?? 0x1e293b;

    // Materials
    const bodyMat = new THREE.MeshStandardMaterial({
      color: primaryColor,
      metalness: 0.35,
      roughness: 0.45,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      metalness: 0.45,
      roughness: 0.35,
    });
    const interstageMat = new THREE.MeshStandardMaterial({
      color: interstageColor,
      metalness: 0.65,
      roughness: 0.3,
    });
    const metallicMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.8,
      roughness: 0.25,
    });

    // ── 1. STAGE 1 (MAIN BOOSTER) ──────────────────────────────────────────
    this._stage1Group = new THREE.Group();
    this._stage1Group.name = "stage-1-booster";

    // Main tank body
    const s1Tank = new THREE.Mesh(
      new THREE.CylinderGeometry(coreRadius, coreRadius * 1.03, s1Height, 24),
      bodyMat
    );
    s1Tank.position.y = -s1Height / 2;
    this._stage1Group.add(s1Tank);

    // Roll-markings / accent racing bands
    const bandMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(coreRadius * 1.002, coreRadius * 1.002, s1Height * 0.12, 24),
      darkMat
    );
    bandMesh.position.y = -s1Height * 0.35;
    this._stage1Group.add(bandMesh);

    // Boattail / thrust structure at base of Stage 1
    const boattail = new THREE.Mesh(
      new THREE.CylinderGeometry(coreRadius * 1.03, coreRadius * 0.94, s1Height * 0.08, 24),
      metallicMat
    );
    boattail.position.y = -s1Height + s1Height * 0.04;
    this._stage1Group.add(boattail);

    // Multi-engine bell cluster at base
    const clusterSpec = v.engineCluster ?? { count: 9, pattern: "octaweb", nozzleRadius: 0.024 };
    const nozzles = this._buildEngineCluster(clusterSpec, coreRadius * 0.88);
    nozzles.position.y = -s1Height;
    this._stage1Group.add(nozzles);

    // Stage 1 Plume
    const plumeColor = this._rocket?.id === "solid-sprint" ? 0xfef08a : 0xf97316;
    const plume = this._createPlume(plumeColor, coreRadius * 0.95, s1Height * 0.75, false);
    plume.position.y = -s1Height - s1Height * 0.375;
    this._stage1Group.add(plume);
    this._stage1Plumes.push(plume);
    this._rocketPlume = plume; // Alias

    // Aerodynamic Fins or Hypersonic Grid Fins
    if (v.gridFins) {
      const gridFins = this._buildGridFins(coreRadius, -s1Height * 0.08);
      this._stage1Group.add(gridFins);
    } else if (v.fins) {
      const aeroFins = this._buildAeroFins(coreRadius, -s1Height + 0.05);
      this._stage1Group.add(aeroFins);
    }

    this._stackGroup.add(this._stage1Group);
    this._boosterGroup = this._stage1Group; // Alias

    // ── 2. STRAP-ON SIDE BOOSTERS (HEAVY LIFTERS) ──────────────────────────
    this._sideBoosterGroups = [];
    this._sideBoosterPlumes = [];
    if (v.sideBoosters && v.sideBoosters >= 2) {
      const offset = v.boosterOffset ?? (coreRadius * 2.5);
      [-1, 1].forEach((dir) => {
        const sideGroup = new THREE.Group();
        sideGroup.name = `side-booster-${dir > 0 ? "right" : "left"}`;

        const srbBody = new THREE.Mesh(
          new THREE.CylinderGeometry(coreRadius * 0.95, coreRadius * 0.98, s1Height * 0.92, 18),
          bodyMat
        );
        srbBody.position.y = -s1Height / 2 - s1Height * 0.04;
        sideGroup.add(srbBody);

        // Slanted nose cone at top of side booster
        const noseCone = new THREE.Mesh(
          new THREE.ConeGeometry(coreRadius * 0.95, s1Height * 0.16, 18),
          darkMat
        );
        noseCone.position.y = -s1Height * 0.04 + s1Height * 0.08;
        sideGroup.add(noseCone);

        // Engines for side booster
        const sideNozzles = this._buildEngineCluster(clusterSpec, coreRadius * 0.82);
        sideNozzles.position.y = -s1Height;
        sideGroup.add(sideNozzles);

        // Side booster plume
        const sidePlume = this._createPlume(plumeColor, coreRadius * 0.85, s1Height * 0.7, false);
        sidePlume.position.y = -s1Height - s1Height * 0.35;
        sideGroup.add(sidePlume);
        this._sideBoosterPlumes.push(sidePlume);

        // Attach struts
        const strut = new THREE.Mesh(
          new THREE.BoxGeometry(offset * 0.35, 0.04, 0.04),
          metallicMat
        );
        strut.position.set(-dir * offset * 0.35 * 0.5, -s1Height * 0.25, 0);
        sideGroup.add(strut);

        sideGroup.position.set(dir * offset, 0, 0);
        this._stage1Group.add(sideGroup);
        this._sideBoosterGroups.push(sideGroup);
      });
    }

    // ── 3. INTERSTAGE ADAPTER ──────────────────────────────────────────────
    this._interstageMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(coreRadius * 0.98, coreRadius, interstageHeight, 24, 1, true),
      interstageMat
    );
    this._interstageMesh.position.y = interstageHeight / 2;
    this._stackGroup.add(this._interstageMesh);

    // ── 4. STAGE 2 (UPPER STAGE) ───────────────────────────────────────────
    this._stage2Group = new THREE.Group();
    this._stage2Group.name = "stage-2-upper";

    // Stage 2 propellant tank
    const s2Tank = new THREE.Mesh(
      new THREE.CylinderGeometry(coreRadius * 0.98, coreRadius * 0.98, s2Height, 24),
      bodyMat
    );
    s2Tank.position.y = interstageHeight + s2Height / 2;
    this._stage2Group.add(s2Tank);

    // Stage 2 vacuum engine nozzle (high expansion ratio bell extending downward)
    const upperEng = v.upperEngine ?? { count: 1, nozzleRadius: 0.058, expansionLength: 0.12 };
    const vacBell = new THREE.Mesh(
      new THREE.ConeGeometry(upperEng.nozzleRadius, upperEng.expansionLength, 18, 1, true),
      metallicMat
    );
    vacBell.position.y = interstageHeight - upperEng.expansionLength * 0.35;
    this._stage2Group.add(vacBell);

    // Glowing combustion throat inside vacuum bell
    const throatMesh = new THREE.Mesh(
      new THREE.SphereGeometry(upperEng.nozzleRadius * 0.35, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x93c5fd })
    );
    throatMesh.position.y = interstageHeight + 0.01;
    this._stage2Group.add(throatMesh);

    // Stage 2 Vacuum Plume (pale cyan / translucent, wide vacuum expansion angle)
    this._stage2Plume = this._createPlume(0x38bdf8, coreRadius * 1.35, s2Height * 0.85, true);
    this._stage2Plume.position.y = interstageHeight - s2Height * 0.42;
    this._stage2Plume.visible = false; // Hidden until Stage 2 ignition
    this._stage2Group.add(this._stage2Plume);

    // Payload Attach Fitting (PAF) / separation ring atop Stage 2
    const pafHeight = 0.06;
    const pafMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(coreRadius * 0.72, coreRadius * 0.98, pafHeight, 20),
      darkMat
    );
    pafMesh.position.y = interstageHeight + s2Height + pafHeight / 2;
    this._stage2Group.add(pafMesh);

    this._stackGroup.add(this._stage2Group);

    // ── 5. PAYLOAD FAIRINGS (AERODYNAMIC NOSE CONE) ─────────────────────────
    const hasFairing = this._launchResult?.fairingId !== "no-fairing";
    const fairingMat = new THREE.MeshStandardMaterial({
      color: this._launchResult?.fairingId === "reinforced-fairing" ? 0x94a3b8 : 0xf8fafc,
      metalness: 0.28,
      roughness: 0.4,
      side: THREE.DoubleSide,
    });

    const fairingBaseR = Math.max(coreRadius * 1.18, 0.14);
    const fairingH = Math.max(0.72, coreRadius * 4.4);
    const fairingHalfGeo = new THREE.CylinderGeometry(
      0.03,
      fairingBaseR,
      fairingH,
      18,
      1,
      false,
      0,
      Math.PI
    );

    const fairingCenterY = interstageHeight + s2Height + pafHeight + fairingH / 2;

    this._fairingLeft = new THREE.Mesh(fairingHalfGeo, fairingMat);
    this._fairingLeft.position.y = fairingCenterY;
    this._fairingLeft.visible = hasFairing;

    this._fairingRight = new THREE.Mesh(fairingHalfGeo, fairingMat);
    this._fairingRight.rotation.y = Math.PI;
    this._fairingRight.position.y = fairingCenterY;
    this._fairingRight.visible = hasFairing;

    this._stage2Group.add(this._fairingLeft, this._fairingRight);

    // ── 6. SPACECRAFT PAYLOAD BAY MOUNT (STOWED INSIDE FAIRING) ─────────────
    if (this._spacecraftGroup) {
      this._spacecraftGroup.visible = true;
      this._spacecraftGroup.scale.setScalar(1);
      const stowedBox = new THREE.Box3().setFromObject(this._spacecraftGroup);
      let stowedScale = 0.16;
      if (!stowedBox.isEmpty()) {
        const size = new THREE.Vector3();
        stowedBox.getSize(size);
        const radialSpan = Math.max(size.x, size.z, 0.25) / 2;
        const heightSpan = Math.max(size.y, 0.25);
        stowedScale = Math.min(
          0.22,
          (fairingBaseR * 0.68) / radialSpan,
          (fairingH * 0.62) / heightSpan
        );
      }
      this._stowedSpacecraftScale = Math.max(0.06, stowedScale);
      this._spacecraftGroup.scale.setScalar(this._stowedSpacecraftScale);
      this._spacecraftGroup.position.set(
        0,
        interstageHeight + s2Height + pafHeight + fairingH * 0.3,
        0
      );
      this._stage2Group.add(this._spacecraftGroup);
    }

    const frame = this._getCurrentSiteFrame();
    const nozzleHeight = (clusterSpec.nozzleRadius ?? 0.024) * 2.6;
    this._stackScale = 0.22;
    this._padStandRadius =
      (frame.earthRadius ?? 1.8) + 0.024 + (s1Height + nozzleHeight * 0.72) * this._stackScale;
    this._stackGroup.scale.setScalar(this._stackScale);
    this._stackGroup.position.copy(frame.up).multiplyScalar(this._padStandRadius);
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

  /** Build realistic engine nozzle clusters */
  _buildEngineCluster(clusterSpec, radius) {
    const group = new THREE.Group();
    const count = clusterSpec.count ?? 9;
    const rNozzle = clusterSpec.nozzleRadius ?? 0.024;
    const hNozzle = rNozzle * 2.6;
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.25,
    });
    const throatMat = new THREE.MeshBasicMaterial({
      color: clusterSpec.throatColor ?? 0xf97316,
    });

    const addNozzle = (x, z) => {
      const bell = new THREE.Mesh(
        new THREE.ConeGeometry(rNozzle, hNozzle, 12, 1, true),
        nozzleMat
      );
      bell.position.set(x, -hNozzle / 2, z);
      const throat = new THREE.Mesh(new THREE.SphereGeometry(rNozzle * 0.35, 8, 8), throatMat);
      throat.position.set(x, -hNozzle * 0.1, z);
      group.add(bell, throat);
    };

    if (count === 1) {
      addNozzle(0, 0);
    } else if (clusterSpec.pattern === "octaweb") {
      // 8 outer nozzles in a circle + 1 center nozzle
      addNozzle(0, 0);
      for (let i = 0; i < 8; i++) {
        const theta = (i / 8) * Math.PI * 2;
        addNozzle(Math.cos(theta) * radius * 0.72, Math.sin(theta) * radius * 0.72);
      }
    } else if (clusterSpec.pattern === "concentric") {
      // 12 outer + 6 middle + 1 center
      addNozzle(0, 0);
      for (let i = 0; i < 6; i++) {
        const theta = (i / 6) * Math.PI * 2;
        addNozzle(Math.cos(theta) * radius * 0.45, Math.sin(theta) * radius * 0.45);
      }
      for (let i = 0; i < 12; i++) {
        const theta = (i / 12) * Math.PI * 2;
        addNozzle(Math.cos(theta) * radius * 0.85, Math.sin(theta) * radius * 0.85);
      }
    } else {
      // Circular ring
      for (let i = 0; i < count; i++) {
        const theta = (i / count) * Math.PI * 2;
        addNozzle(Math.cos(theta) * radius * 0.7, Math.sin(theta) * radius * 0.7);
      }
    }
    return group;
  }

  /** Titanium folding hypersonic grid fins */
  _buildGridFins(radius, yPos) {
    const group = new THREE.Group();
    const finMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.9,
      roughness: 0.2,
    });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.08, 0.06), finMat);
      fin.position.set(Math.cos(angle) * (radius + 0.035), yPos, Math.sin(angle) * (radius + 0.035));
      fin.rotation.y = angle;
      group.add(fin);
    }
    return group;
  }

  /** Aerodynamic base delta fins */
  _buildAeroFins(radius, yPos) {
    const group = new THREE.Group();
    const finMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.5,
      roughness: 0.4,
    });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), finMat);
      fin.position.set(Math.cos(angle) * (radius + 0.04), yPos, Math.sin(angle) * (radius + 0.04));
      fin.rotation.z = Math.PI / 2;
      fin.rotation.y = angle;
      group.add(fin);
    }
    return group;
  }

  /** Create realistic animated exhaust plume */
  _createPlume(color, radius, length, isVacuum) {
    const group = new THREE.Group();
    group.name = isVacuum ? "vacuum-plume" : "atmospheric-plume";

    // Outer turbulent flame volume
    const outerGeo = new THREE.ConeGeometry(radius, length, 16);
    const outerMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: isVacuum ? 0.55 : 0.85,
    });
    const outerCone = new THREE.Mesh(outerGeo, outerMat);
    outerCone.rotation.x = Math.PI;
    group.add(outerCone);

    // Bright supersonic core
    const coreGeo = new THREE.ConeGeometry(radius * 0.45, length * 0.65, 12);
    const coreMat = new THREE.MeshBasicMaterial({
      color: isVacuum ? 0xffffff : 0xfef08a,
      transparent: true,
      opacity: 0.95,
    });
    const coreCone = new THREE.Mesh(coreGeo, coreMat);
    coreCone.rotation.x = Math.PI;
    group.add(coreCone);

    return group;
  }

  /** Animate plume flickering and emit glowing exhaust particle puffs */
  _animatePlumes(dt) {
    const jitter = 0.92 + Math.random() * 0.16;
    const activePlumes = [];
    for (const plume of this._stage1Plumes) {
      if (plume.visible) {
        plume.scale.set(1, jitter, 1);
        activePlumes.push({ plume, color: 0xfb923c, isVacuum: false });
      }
    }
    for (const plume of this._sideBoosterPlumes) {
      if (plume.visible) {
        plume.scale.set(1, jitter, 1);
        activePlumes.push({ plume, color: 0xfef08a, isVacuum: false });
      }
    }
    if (this._stage2Plume?.visible) {
      const vacJitter = 0.95 + Math.random() * 0.1;
      this._stage2Plume.scale.set(vacJitter, vacJitter, vacJitter);
      activePlumes.push({ plume: this._stage2Plume, color: 0x38bdf8, isVacuum: true });
    }

    if (activePlumes.length === 0) return;
    this._plumeSpawnAccum += dt * Math.min(this.speedMultiplier, 8);
    if (this._plumeSpawnAccum < 0.045) return;
    this._plumeSpawnAccum = 0;

    for (const { plume, color, isVacuum } of activePlumes) {
      this._emitPlumeParticles(plume, color, isVacuum);
    }
  }

  _emitCryoVentParticles(dt) {
    if (!this._stackGroup) return;
    this._plumeSpawnAccum += dt;
    if (this._plumeSpawnAccum < 0.14) return;
    this._plumeSpawnAccum = 0;

    const frame = this._getCurrentSiteFrame();
    const ventOrigin = this._stackGroup.position.clone().addScaledVector(frame.up, 0.08);
    this._spawnParticleStream(ventOrigin, frame.heading, 0xe0f2fe, 6, 0.25, 0.035, 0.55);
  }

  _emitPlumeParticles(plume, color, isVacuum) {
    if (!this._stackGroup) return;
    plume.updateMatrixWorld(true);
    const origin = new THREE.Vector3();
    plume.getWorldPosition(origin);
    const aftDir = new THREE.Vector3(0, -1, 0)
      .applyQuaternion(this._stackGroup.quaternion)
      .normalize();
    this._spawnParticleStream(
      origin,
      aftDir,
      color,
      isVacuum ? 6 : 10,
      isVacuum ? 0.9 : 1.4,
      isVacuum ? 0.045 : 0.06,
      isVacuum ? 0.35 : 0.45
    );
  }

  _spawnParticleStream(origin, dir, color, count, speed, size, maxAge) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const velocities = [];
    const spread = speed * 0.35;
    for (let i = 0; i < count; i++) {
      pos[i * 3] = origin.x + (Math.random() - 0.5) * 0.03;
      pos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.03;
      pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.03;
      const spd = speed * (0.7 + Math.random() * 0.6);
      velocities.push(
        new THREE.Vector3(
          dir.x * spd + (Math.random() - 0.5) * spread,
          dir.y * spd + (Math.random() - 0.5) * spread,
          dir.z * spd + (Math.random() - 0.5) * spread
        )
      );
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    points.name = "engine-plume-particles";
    this.root.add(points);
    this._debris.push({
      mesh: points,
      velocities,
      age: 0,
      maxAge,
      isPoints: true,
    });
  }

  _getVehicleAxes() {
    const q = this._stackGroup?.quaternion ?? new THREE.Quaternion();
    return {
      right: new THREE.Vector3(1, 0, 0).applyQuaternion(q).normalize(),
      up: new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize(),
      fwd: new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize(),
    };
  }

  _detachToSeparatingParts(part, currentParent, vel, rotVel, maxAge) {
    part.updateMatrixWorld(true);
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    part.getWorldPosition(worldPos);
    part.getWorldQuaternion(worldQuat);
    part.getWorldScale(worldScale);

    currentParent.remove(part);
    part.position.copy(this.root.worldToLocal(worldPos));
    part.quaternion.copy(worldQuat);
    part.scale.copy(worldScale);
    this.root.add(part);

    this._separatingParts.push({
      mesh: part,
      vel,
      rotVel,
      age: 0,
      maxAge,
    });
  }

  /** Sequence staging events (Side Boosters, Stage 1 MECO, Fairings, Stage 2 Deployment) */
  _handleAscentStagingSequence(p) {
    // 1. Side Boosters separation at progress ~0.33
    if (p >= 0.33 && !this._sideBoostersSeparated && this._sideBoosterGroups.length > 0) {
      this._sideBoostersSeparated = true;
      this._separateSideBoosters();
    }

    // 2. Stage 1 MECO & Interstage Separation at progress ~0.37
    if (p >= 0.37 && !this._stage1Separated && this._stage1Group) {
      this._stage1Separated = true;
      this._separateStage1();
    }

    // 3. Fairing Jettison once in vacuum at progress ~0.42
    if (p >= 0.42 && !this._fairingSeparated && this._fairingLeft?.visible) {
      this._fairingSeparated = true;
      this._separateFairings();
    }

    // 4. Upper-stage SECO & Spacecraft separation at deployment (~0.45)
    if (p >= 0.45 && !this._stage2Separated && this._stage2Group) {
      this._stage2Separated = true;
      this._separateStage2();
    }
  }

  /** Separate side boosters outward laterally & aft in vehicle frame */
  _separateSideBoosters() {
    for (const plume of this._sideBoosterPlumes) {
      plume.visible = false;
    }
    const { right, up, fwd } = this._getVehicleAxes();
    this._sideBoosterGroups.forEach((booster, idx) => {
      const dir = idx === 0 ? -1 : 1;
      const vel = right
        .clone()
        .multiplyScalar(dir * 0.42)
        .addScaledVector(up, -0.55)
        .addScaledVector(fwd, 0.12);
      this._detachToSeparatingParts(
        booster,
        this._stage1Group,
        vel,
        new THREE.Vector3(0.15, 0, dir * 0.45),
        4.5
      );
    });
    this._sideBoosterGroups = [];
  }

  /** Stage 1 MECO, separation along vehicle aft axis, and Stage 2 ignition */
  _separateStage1() {
    for (const plume of this._stage1Plumes) {
      plume.visible = false;
    }

    const { right, up } = this._getVehicleAxes();
    const stageOrigin = new THREE.Vector3();
    this._stage1Group.getWorldPosition(stageOrigin);
    const vel = up.clone().multiplyScalar(-0.65).addScaledVector(right, -0.08);
    this._detachToSeparatingParts(
      this._stage1Group,
      this._stackGroup,
      vel,
      new THREE.Vector3(0.2, 0.1, -0.35),
      6.0
    );

    // Stage 2 Ignition!
    if (this._stage2Plume) {
      this._stage2Plume.visible = true;
    }
    // Small interstage separation cold-gas puff
    this._spawnSparkBurst(stageOrigin, 0x94a3b8, 16);
  }

  /** Clamshell fairing separation revealing the spacecraft */
  _separateFairings() {
    if (!this._fairingLeft || !this._fairingRight) return;

    const { right, up, fwd } = this._getVehicleAxes();
    [-1, 1].forEach((dir) => {
      const fairing = dir === -1 ? this._fairingLeft : this._fairingRight;
      fairing.visible = true;
      const vel = right
        .clone()
        .multiplyScalar(dir * 0.65)
        .addScaledVector(up, -0.15)
        .addScaledVector(fwd, 0.2);
      this._detachToSeparatingParts(
        fairing,
        this._stage2Group,
        vel,
        new THREE.Vector3(0.5, dir * 0.6, 0.2),
        5.0
      );
    });

    this._fairingLeft = null;
    this._fairingRight = null;
  }

  /** Upper-stage SECO separation cleanly releasing the spacecraft */
  _separateStage2() {
    if (this._stage2Plume) {
      this._stage2Plume.visible = false;
    }
    if (this._spacecraftGroup && this._stackGroup && this._stage2Group.children.includes(this._spacecraftGroup)) {
      this._stage2Group.remove(this._spacecraftGroup);
      this._spacecraftGroup.position.set(0, 0.15, 0);
      this._spacecraftGroup.scale.setScalar(Math.max(0.22, (this._stowedSpacecraftScale ?? 0.16) * 1.45));
      this._stackGroup.add(this._spacecraftGroup);
    }

    const { right, up } = this._getVehicleAxes();
    const stageOrigin = new THREE.Vector3();
    this._stage2Group.getWorldPosition(stageOrigin);
    const vel = up.clone().multiplyScalar(-0.42).addScaledVector(right, 0.08);
    this._detachToSeparatingParts(
      this._stage2Group,
      this._stackGroup,
      vel,
      new THREE.Vector3(-0.18, 0.22, 0.12),
      5.5
    );
    this._stage2Group = null;
    this._spawnSparkBurst(stageOrigin, 0x38bdf8, 14);
  }

  /** Update detached stages and fairing halves drifting through space */
  _updateSeparatingParts(dt) {
    for (let i = this._separatingParts.length - 1; i >= 0; i--) {
      const part = this._separatingParts[i];
      part.age += dt;
      part.mesh.position.addScaledVector(part.vel, dt);
      part.mesh.rotation.x += part.rotVel.x * dt;
      part.mesh.rotation.y += part.rotVel.y * dt;
      part.mesh.rotation.z += part.rotVel.z * dt;

      if (part.age >= part.maxAge) {
        this.root.remove(part.mesh);
        this._disposeObject(part.mesh);
        this._separatingParts.splice(i, 1);
      }
    }
  }

  _onPhaseEnter(phaseIdx) {
    // Phase 3: Deployment (SECO & payload separation)
    if (phaseIdx === 3) {
      if (this._stage2Plume) {
        this._stage2Plume.visible = false;
      }
      if (!this._stage2Separated && this._stage2Group) {
        this._stage2Separated = true;
        this._separateStage2();
      }
      if (this._spacecraft?.setSolarDeployed) {
        this._spacecraft.setSolarDeployed(true);
      }
    }

    // Phase 4: TPI Burn
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
    const padStandRadius = this._padStandRadius ?? (frame.earthRadius ?? 1.8) + 0.34;
    const leoRadius = 3.0;
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
    } else if (progress < 0.58) {
      // LEO parking coast & deployment along KSC orbital plane (0.48 -> 0.72 rad)
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
    } else if (this._orbit?.id !== "LEO") {
      // Follow exact loop-free transfer trajectory computed by PlanetScene
      const t = Math.max(0, Math.min(1, (progress - 0.58) / 0.42));
      const curve = PlanetScene.computeTransferCurve(this._orbit, leoDeparture, leoDepartureDir);
      if (curve) {
        const pos = curve.getPoint(t);
        const nextPos = curve.getPoint(Math.min(1, t + 0.02));
        this._stackGroup.position.copy(pos);
        const travelDir = nextPos.clone().sub(pos);
        if (travelDir.lengthSq() > 1e-6) {
          this._alignVehicleToAxes(travelDir.normalize(), pos);
        }
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
    const liveSnapshot = this._computeLiveTelemetrySnapshot(this._activePhaseIndex);
    if (mode === "insufficient-science" || mode === "science-warning") {
      this._cameraShake = 0;
      this._onPhaseUpdate?.(this._activePhaseIndex, failedPhase, {
        ...liveSnapshot,
        failed: false,
        warning: true,
        failureMode: mode,
      });
      return;
    }

    this._cameraShake = 0.75;

    for (const p of this._stage1Plumes) p.visible = false;
    for (const p of this._sideBoosterPlumes) p.visible = false;
    if (this._stage2Plume) this._stage2Plume.visible = false;
    if (this._machCone) this._machCone.visible = false;
    this._spacecraft?.setThrustActive?.(false);

    const origin = this._stackGroup ? this._stackGroup.position.clone() : new THREE.Vector3();

    const blastScale =
      mode === "explosion"
        ? 1.35
        : mode === "structural-breakup" || mode === "suborbital-fall"
          ? 1.15
          : 1.05;

    this._spawnExplosion(origin, blastScale, true);
    this._secondaryBlastOrigin = origin.clone().add(
      new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4)
    );

    // Break the actual spacecraft and visible vehicle stages into tumbling parts that fade out and disappear
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
    if (this._sideBoostersGroup?.visible) {
      this._shatterGroupIntoParts(this._sideBoostersGroup, origin, 1.4, 2.2);
      this._sideBoostersGroup.visible = false;
    }
    if (this._stage1Group?.visible) {
      this._shatterGroupIntoParts(this._stage1Group, origin, 1.2, 2.3);
      this._stage1Group.visible = false;
    }
    if (this._stage2Group?.visible) {
      this._shatterGroupIntoParts(this._stage2Group, origin, 1.3, 2.3);
      this._stage2Group.visible = false;
    }
    if (this._boosterGroup?.visible) {
      this._shatterGroupIntoParts(this._boosterGroup, origin, 1.2, 2.3);
      this._boosterGroup.visible = false;
    }
    if (this._stackGroup) {
      this._stackGroup.visible = false;
    }

    this._onPhaseUpdate?.(this._activePhaseIndex, failedPhase, {
      ...liveSnapshot,
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

    this._spawnSparkBurst(origin, 0xf97316, includeSmoke ? 68 : 28);
  }

  _spawnSparkBurst(origin, color, count = 32) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      pos[i * 3] = origin.x;
      pos[i * 3 + 1] = origin.y;
      pos[i * 3 + 2] = origin.z;
      velocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 2.8,
          (Math.random() - 0.5) * 2.8,
          (Math.random() - 0.5) * 2.8
        )
      );
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size: 0.08,
      transparent: true,
      opacity: 1.0,
    });
    const pSystem = new THREE.Points(geo, mat);
    this.root.add(pSystem);

    this._debris.push({
      mesh: pSystem,
      velocities,
      age: 0,
      maxAge: 1.5,
      isPoints: true,
    });
  }

  _spawnPartChunk(origin, vel, color, size) {
    const chunk = new THREE.Mesh(
      new THREE.BoxGeometry(size, size * 1.5, size * 0.8),
      new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.4 })
    );
    chunk.position.copy(origin);
    this.root.add(chunk);

    this._debris.push({
      mesh: chunk,
      velocity: vel,
      rotationSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8
      ),
      age: 0,
      maxAge: 3.2,
      isPoints: false,
    });
  }

  _updateDebris(dt) {
    for (let i = this._debris.length - 1; i >= 0; i--) {
      const d = this._debris[i];
      d.age += dt;
      if (d.isPoints) {
        const posAttr = d.mesh.geometry.attributes.position;
        const arr = posAttr.array;
        for (let j = 0; j < d.velocities.length; j++) {
          const v = d.velocities[j];
          arr[j * 3] += v.x * dt;
          arr[j * 3 + 1] += v.y * dt;
          arr[j * 3 + 2] += v.z * dt;
        }
        posAttr.needsUpdate = true;
        if (d.mesh.material) {
          d.mesh.material.opacity = Math.max(0, 1 - d.age / d.maxAge);
        }
      } else {
        const vel = d.vel || d.velocity;
        const spin = d.spin || d.rotationSpeed;
        if (d.drag && vel) {
          vel.multiplyScalar(Math.max(0, 1 - d.drag * dt));
        }
        if (vel) d.mesh.position.addScaledVector(vel, dt);
        if (spin) {
          d.mesh.rotation.x += spin.x * dt;
          d.mesh.rotation.y += spin.y * dt;
          d.mesh.rotation.z += spin.z * dt;
        }
        if (d.fadeStart !== undefined) {
          const t = d.age / d.maxAge;
          const opacity =
            t <= d.fadeStart ? 1 : Math.max(0, 1 - (t - d.fadeStart) / Math.max(1e-4, 1 - d.fadeStart));
          d.mesh.traverse((obj) => {
            if (!obj.material) return;
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => {
              m.opacity = opacity;
            });
          });
        }
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

  _computeLiveTelemetrySnapshot(phaseIdx) {
    const phases = this._launchResult?.phases ?? [];
    const phase = phases[phaseIdx];
    const stats = this._launchResult?.missionStats ?? {};
    const stages = stats.stages ?? [];
    const stage1 = stages[0];
    const stage2 = stages[1];
    const orbitId = this._orbit?.id ?? "LEO";
    const targetCruiseAlt = this._orbit?.altitudeKm ?? 500;
    const p = Math.max(0.005, Math.min(1, this.progress || 0.005));

    let altitudeKm = 1;
    let velocityKms = 0.08;
    let propellantPct = 100;
    let gLoad = stats.twr ?? 1.3;
    let activeStageText = stage1?.name ?? "Stage 1 (Booster)";

    if (p <= 0.44) {
      const u = Math.max(0.015, p / 0.44);
      altitudeKm = Math.max(1, Math.round(500 * Math.pow(u, 1.85)));
      velocityKms = Number(Math.max(0.08, 7.62 * Math.pow(u, 1.12)).toFixed(2));
      propellantPct = Math.max(32, Math.round(100 - u * 68));

      const curve = Array.isArray(stats.ascentGCurve) ? stats.ascentGCurve : [];
      if (curve.length > 0) {
        const ascentFrac = Math.max(0, Math.min(1, (p - 0.14) / 0.30));
        let nearest = curve[0];
        for (const s of curve) {
          if (s.fraction <= ascentFrac) nearest = s;
        }
        gLoad = p < 0.14 ? Number((1.25 + (p / 0.14) * 1.1).toFixed(2)) : nearest.gLoad;
      }

      if (p >= 0.37) {
        activeStageText = stage2?.name ?? "Stage 2 (Upper Stage)";
      } else if (this._sideBoostersSeparated) {
        activeStageText = "Core Booster (Center)";
      }
    } else if (p <= 0.58) {
      altitudeKm = 500;
      velocityKms = 7.62;
      propellantPct = 32;
      gLoad = 0.0;
      activeStageText = "Spacecraft Bus (LEO Coast)";
    } else {
      const u = (p - 0.58) / 0.42;
      const isDeep = orbitId === "LUNAR" || orbitId === "MARS";
      const captureVel =
        orbitId === "MARS"
          ? 3.36
          : orbitId === "LUNAR"
            ? 1.68
            : orbitId === "GEO"
              ? 3.07
              : orbitId === "MEO"
                ? 3.87
                : 7.62;
      const peakTransferVel =
        orbitId === "MARS" ? 11.4 : orbitId === "LUNAR" ? 10.8 : orbitId === "GEO" ? 10.1 : orbitId === "MEO" ? 9.4 : 7.62;

      if (orbitId === "LEO") {
        altitudeKm = 500;
        velocityKms = 7.62;
      } else if (u < 0.35) {
        const t = u / 0.35;
        altitudeKm = Math.round(500 + (targetCruiseAlt * 0.12) * t);
        velocityKms = Number((7.62 + (peakTransferVel - 7.62) * t).toFixed(2));
      } else if (u < 0.72) {
        const t = (u - 0.35) / 0.37;
        altitudeKm = Math.round(500 + targetCruiseAlt * (0.12 + 0.88 * t));
        velocityKms = Number((peakTransferVel - (peakTransferVel - (isDeep ? 3.8 : captureVel + 0.5)) * t).toFixed(2));
      } else {
        const t = (u - 0.72) / 0.28;
        const finalAlt = isDeep ? this._orbit?.targetOrbitAltitudeKm ?? 100 : targetCruiseAlt;
        altitudeKm = Math.round(targetCruiseAlt + (finalAlt - targetCruiseAlt) * t);
        const midVel = isDeep ? 3.8 : captureVel + 0.5;
        velocityKms = Number((midVel + (captureVel - midVel) * t).toFixed(2));
      }

      const finalReserve =
        stats.totalDeltaVMs > 0
          ? Math.max(4, Math.min(28, Math.round(((stats.totalDeltaVMs - (stats.requiredDeltaVMs ?? 0)) / stats.totalDeltaVMs) * 100 + 8)))
          : 12;
      propellantPct = Math.max(4, Math.round(32 - (32 - finalReserve) * u));
      gLoad = p >= 0.58 && p < 0.72 ? 0.85 : p >= 0.88 ? 0.65 : 0.0;
      activeStageText = "Spacecraft Propulsion";
    }

    return {
      phase,
      altitudeKm,
      velocityKms,
      propellantPct,
      gLoad: Number(Number(gLoad).toFixed(2)),
      maxAllowableG: Number((stats.maxAllowableG ?? 8.0).toFixed(1)),
      countdownSec: 0,
      progress: this.progress,
      activeStage: activeStageText,
      stage1DeltaV: stage1?.deltaVMs ?? 0,
      stage2DeltaV: stage2?.deltaVMs ?? 0,
    };
  }

  _emitPhaseTelemetry(phaseIdx) {
    const snapshot = this._computeLiveTelemetrySnapshot(phaseIdx);
    if (!snapshot.phase) return;

    this._onPhaseUpdate?.(phaseIdx, snapshot.phase, {
      failed: false,
      altitudeKm: snapshot.altitudeKm,
      velocityKms: snapshot.velocityKms,
      propellantPct: snapshot.propellantPct,
      gLoad: snapshot.gLoad,
      maxAllowableG: snapshot.maxAllowableG,
      countdownSec: snapshot.countdownSec,
      progress: snapshot.progress,
      activeStage: snapshot.activeStage,
      stage1DeltaV: snapshot.stage1DeltaV,
      stage2DeltaV: snapshot.stage2DeltaV,
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
  