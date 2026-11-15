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
    this._machCone = null;
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

    this._sideBoostersSeparated = false;
    this._stage1Separated = false;
    this._fairingSeparated = false;
    this._stage2Separated = false;

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

  /** Advance launch animation, debris physics, staging separation, and camera shake. */
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

    // Failure interrupt
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

    // Dynamic staging transitions within ascent phase (progress 0.28 to 0.44)
    this._handleAscentStagingSequence(this.progress);

    this._positionVehicleAlongTrajectory(this.progress, phaseIdx);
    this._emitPhaseTelemetry(phaseIdx);

    // Dynamic plume flicker
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
    this._machCone = null;
    this._rocketPlume = null;
    this._boosterGroup = null;

    this.running = false;
    this.progress = 0;
    this._orbiting = false;
    this._failed = false;
    this._failureTriggered = false;
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

    const fairingH = Math.max(0.65, coreRadius * 4.2);
    const fairingHalfGeo = new THREE.CylinderGeometry(
      0.03,
      coreRadius * 1.15,
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

    // Transonic Max-Q shock cone
    this._machCone = new THREE.Mesh(
      new THREE.ConeGeometry(coreRadius * 2.8, 0.75, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
      })
    );
    this._machCone.position.y = fairingCenterY;
    this._stackGroup.add(this._machCone);

    // ── 6. SPACECRAFT PAYLOAD BAY MOUNT ─────────────────────────────────────
    if (this._spacecraftGroup) {
      this._spacecraftGroup.scale.setScalar(0.24);
      this._spacecraftGroup.position.set(0, interstageHeight + s2Height + pafHeight + 0.12, 0);
      this._stage2Group.add(this._spacecraftGroup);
    }

    this._stackGroup.position.set(0, 0, 1.95);
    this.root.add(this._stackGroup);
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

  /** Animate plume flickering */
  _animatePlumes(dt) {
    const jitter = 0.92 + Math.random() * 0.16;
    for (const plume of this._stage1Plumes) {
      if (plume.visible) {
        plume.scale.set(1, jitter, 1);
      }
    }
    for (const plume of this._sideBoosterPlumes) {
      if (plume.visible) {
        plume.scale.set(1, jitter, 1);
      }
    }
    if (this._stage2Plume?.visible) {
      const vacJitter = 0.95 + Math.random() * 0.1;
      this._stage2Plume.scale.set(vacJitter, vacJitter, vacJitter);
    }
  }

  /** Sequence staging events (Side Boosters, Stage 1 MECO, Stage 2 Ignition, Fairings) */
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
  }

  /** Separate side boosters into realistic outward Korolev cross */
  _separateSideBoosters() {
    for (const plume of this._sideBoosterPlumes) {
      plume.visible = false;
    }
    this._sideBoosterGroups.forEach((booster, idx) => {
      const dir = idx === 0 ? -1 : 1;
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      booster.getWorldPosition(worldPos);
      booster.getWorldQuaternion(worldQuat);

      this._stage1Group.remove(booster);
      booster.position.copy(worldPos);
      booster.quaternion.copy(worldQuat);
      this.root.add(booster);

      // Peel outwards and push backward
      this._separatingParts.push({
        mesh: booster,
        vel: new THREE.Vector3(dir * 0.65, -0.75, 0.25),
        rotVel: new THREE.Vector3(0, 0, dir * 0.4),
        age: 0,
        maxAge: 4.5,
      });
    });
    this._sideBoosterGroups = [];
  }

  /** Stage 1 MECO, separation, and Stage 2 ignition */
  _separateStage1() {
    for (const plume of this._stage1Plumes) {
      plume.visible = false;
    }

    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    this._stage1Group.getWorldPosition(worldPos);
    this._stage1Group.getWorldQuaternion(worldQuat);

    this._stackGroup.remove(this._stage1Group);
    this._stage1Group.position.copy(worldPos);
    this._stage1Group.quaternion.copy(worldQuat);
    this.root.add(this._stage1Group);

    // Tumbling booster falls back towards Earth
    this._separatingParts.push({
      mesh: this._stage1Group,
      vel: new THREE.Vector3(-0.15, -0.85, 0.1),
      rotVel: new THREE.Vector3(0.2, 0.1, -0.3),
      age: 0,
      maxAge: 6.0,
    });

    // Stage 2 Ignition!
    if (this._stage2Plume) {
      this._stage2Plume.visible = true;
    }
    // Small interstage visual gas puff
    this._spawnSparkBurst(worldPos, 0x94a3b8, 16);
  }

  /** Clamshell fairing separation revealing the spacecraft */
  _separateFairings() {
    if (!this._fairingLeft || !this._fairingRight) return;

    [-1, 1].forEach((dir) => {
      const fairing = dir === -1 ? this._fairingLeft : this._fairingRight;
      fairing.visible = true;
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      fairing.getWorldPosition(worldPos);
      fairing.getWorldQuaternion(worldQuat);

      this._stage2Group.remove(fairing);
      fairing.position.copy(worldPos);
      fairing.quaternion.copy(worldQuat);
      this.root.add(fairing);

      this._separatingParts.push({
        mesh: fairing,
        vel: new THREE.Vector3(dir * 1.1, 0.25, 0.35),
        rotVel: new THREE.Vector3(0.5, dir * 0.6, 0.2),
        age: 0,
        maxAge: 5.0,
      });
    });

    this._fairingLeft = null;
    this._fairingRight = null;
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

    const leoRadius = 3.0;
    const targetRadius = this._orbit?.orbitRadius3D ?? 3.0;
    const isDeep = this._orbit?.id === "LUNAR" || this._orbit?.id === "MARS";

    // Ascent from Earth surface (z=1.92) to LEO parking orbit (z=3.0) during phases 0..2
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
        this._machCone.material.opacity = phaseIdx === 1 ? 0.38 : 0.0;
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

    for (const p of this._stage1Plumes) p.visible = false;
    for (const p of this._sideBoosterPlumes) p.visible = false;
    if (this._stage2Plume) this._stage2Plume.visible = false;
    if (this._machCone) this._machCone.visible = false;
    this._spacecraft?.setThrustActive?.(false);

    const mode = this._launchResult?.failureMode || "explosion";
    const origin = this._stackGroup ? this._stackGroup.position.clone() : new THREE.Vector3();

    if (mode === "explosion" || mode === "structural-breakup" || mode === "suborbital-fall") {
      this._spawnExplosion(origin, mode === "explosion" ? 1.35 : 1.0);
      if (this._fairingLeft?.visible) {
        this._fairingLeft.visible = false;
        this._fairingRight.visible = false;
        this._spawnPartChunk(origin, new THREE.Vector3(-1.8, 1.2, 0.7), 0xf1f5f9, 0.18);
        this._spawnPartChunk(origin, new THREE.Vector3(1.6, -0.9, 1.1), 0xf1f5f9, 0.18);
      }
      if (this._stage1Group?.visible) {
        this._stage1Group.visible = false;
        this._spawnPartChunk(origin, new THREE.Vector3(-0.8, -1.4, 0.4), 0xe2e8f0, 0.26);
      }
    }
  }

  _spawnExplosion(origin, scale = 1.0) {
    const sphereGeo = new THREE.SphereGeometry(0.18 * scale, 16, 16);
    const fireMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.9,
    });
    const fireball = new THREE.Mesh(sphereGeo, fireMat);
    fireball.position.copy(origin);
    this.root.add(fireball);

    this._fireballs.push({
      mesh: fireball,
      age: 0,
      maxAge: 1.2,
      growRate: 4.8 * scale,
    });

    this._spawnSparkBurst(origin, 0xfef08a, Math.round(36 * scale));
    this._spawnSparkBurst(origin, 0xef4444, Math.round(28 * scale));
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
        d.mesh.position.addScaledVector(d.velocity, dt);
        d.mesh.rotation.x += d.rotationSpeed.x * dt;
        d.mesh.rotation.y += d.rotationSpeed.y * dt;
        d.mesh.rotation.z += d.rotationSpeed.z * dt;
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

    const stages = this._launchResult?.missionStats?.stages ?? [];
    const stage1 = stages[0];
    const stage2 = stages[1];

    const altitudes = [12, 38, 190, 500, 3200, this._orbit?.altitudeKm * 0.5 || 15000, this._orbit?.altitudeKm || 500];
    const velocities = [0.6, 1.8, 7.2, 7.62, 10.4, 3.8, 1.6];

    let activeStageText = "Stage 1 (Booster)";
    if (this.progress >= 0.44) {
      activeStageText = "Spacecraft Bus";
    } else if (this.progress >= 0.37) {
      activeStageText = stage2?.name ?? "Stage 2 (Upper Stage)";
    } else if (this._sideBoostersSeparated) {
      activeStageText = "Core Booster (Center)";
    }

    this._onPhaseUpdate?.(phaseIdx, phase, {
      failed: false,
      altitudeKm: Math.round(altitudes[phaseIdx] ?? 500),
      velocityKms: Number((velocities[phaseIdx] ?? 7.6).toFixed(2)),
      progress: this.progress,
      activeStage: activeStageText,
      stage1DeltaV: stage1?.deltaVMs ?? 0,
      stage2DeltaV: stage2?.deltaVMs ?? 0,
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
