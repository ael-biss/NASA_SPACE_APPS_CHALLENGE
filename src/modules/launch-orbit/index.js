/**
 * @file src/modules/launch-orbit/index.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Public entry point for the Launch & Orbit module implementing the GameModule lifecycle.
 *       Combines PlanetScene, Member 2's 3D spacecraft, OrbitMechanics, LaunchAnimation, and LaunchControlPanel.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { soundFX } from "../../shared/utils/SoundEffects.js";
import { buildSpacecraftModel } from "../spacecraft-design/index.js";
import { DEFAULT_LAUNCH_SITE_ID, getLaunchSiteById } from "./data/launchSites.js";
import { getOrbitById } from "./data/orbits.js";
import { getRocketById } from "./data/rockets.js";
import { OrbitMechanics } from "./logic/OrbitMechanics.js";
import { LaunchAnimation } from "./models/LaunchAnimation.js";
import { PlanetScene } from "./models/PlanetScene.js";
import { LaunchControlPanel } from "./ui/LaunchControlPanel.js";

let activeState = null;

/**
 * Mount the Launch & Orbit 3D scene and launch control UI.
 * @param {import('../../core/SceneManager.js').SceneManager} sceneManager
 * @param {import('../../core/GameState.js').GameState} gameState
 * @param {HTMLElement} uiContainer
 * @param {{ onProceed?: () => void }} [options]
 */
export function mount(sceneManager, gameState, uiContainer, options = {}) {
  unmount();

  const mechanics = new OrbitMechanics();
  const planetScene = new PlanetScene();
  const launchAnimation = new LaunchAnimation();
  const launchSite = getLaunchSiteById(DEFAULT_LAUNCH_SITE_ID);

  const earthGroup = planetScene.buildEarth(launchSite);
  const targetOrbitId = gameState.mission?.targetOrbitId || "LUNAR";
  const orbit = getOrbitById(targetOrbitId) ?? getOrbitById("LEO");
  const initialDvBreakdown = mechanics.calculateSiteDeltaVBreakdown(orbit, launchSite);
  planetScene.buildOrbitRing(orbit, launchSite, initialDvBreakdown.azimuthDeg);

  const rootGroup = new THREE.Group();
  rootGroup.name = "launch-orbit-module";
  rootGroup.add(earthGroup);
  rootGroup.add(launchAnimation.getGroup());

  sceneManager.scene.background = new THREE.Color(0x050b1b);
  sceneManager.addObject(rootGroup);

  const controls = new OrbitControls(sceneManager.camera, sceneManager.renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 0.18;
  controls.maxDistance = 180;

  const isDeepSpace = orbit.id === "LUNAR" || orbit.id === "MARS";
  const baseCamPos = isDeepSpace
    ? new THREE.Vector3(orbit.orbitRadius3D * 0.45, 5.5, 11.5)
    : new THREE.Vector3(3.6, 2.8, 7.2);
  const baseCamTarget = isDeepSpace
    ? new THREE.Vector3(orbit.orbitRadius3D * 0.4, 0, 0)
    : new THREE.Vector3(0, 0, 0);
  controls.target.copy(baseCamTarget);
  sceneManager.setCamera(baseCamPos, baseCamTarget);
  controls.update();

  let currentSpacecraftHandle = null;
  let lastLaunchArgs = null;
  let userDragged = false;
  let focusMode = "auto";
  const partScales = {
    scene: 1,
    rocket: 1,
    spacecraft: 1,
    earth: 1,
    destination: 1,
    orbit: 1,
  };
  const followTarget = new THREE.Vector3().copy(baseCamTarget);
  const smoothedFocus = new THREE.Vector3().copy(baseCamTarget);

  const onControlStart = () => {
    userDragged = true;
  };
  controls.addEventListener("start", onControlStart);

  const buildSpacecraftForStage = () => {
    if (currentSpacecraftHandle?.spacecraft) {
      currentSpacecraftHandle.spacecraft.dispose();
    }
    buildSpacecraftForStage();
  };

  const previewPadStack = (rocketId, fairingId) => {
    if (launchAnimation.running || launchAnimation._orbiting) return;
    const rocket = getRocketById(rocketId) ?? getRocketById("heavy-lift");
    buildSpacecraftForStage();
    const siteFrame = planetScene.getLaunchSiteFrame(launchSite, initialDvBreakdown.azimuthDeg);
    launchAnimation.preview(rocket, currentSpacecraftHandle, orbit, {
      fairingId,
      siteFrame,
      getSiteFrame: () => planetScene.getLaunchSiteFrame(launchSite, initialDvBreakdown.azimuthDeg),
    });
    if (focusMode === "vehicle") {
      const target = launchAnimation.getVehicleFocusTarget().multiplyScalar(partScales.scene);
      followTarget.copy(target);
      smoothedFocus.copy(target);
      controls.target.copy(target);
      controls.update();
    }
  };

  const zoomBy = (factor) => {
    userDragged = true;
    const offset = sceneManager.camera.position.clone().sub(controls.target);
    if (offset.lengthSq() < 1e-6) {
      offset.set(0.5, 0.4, 1.0);
    }
    const nextDist = Math.max(
      controls.minDistance,
      Math.min(controls.maxDistance, offset.length() * factor)
    );
    offset.setLength(nextDist);
    sceneManager.camera.position.copy(controls.target).add(offset);
    controls.update();
  };

  const focusCameraOn = (mode, { resetScales = false } = {}) => {
    focusMode = mode || "auto";
    if (resetScales) {
      applyPartScales({
        scene: 1,
        rocket: 1,
        spacecraft: 1,
        earth: 1,
        destination: 1,
        orbit: 1,
      });
    }

    const sScene = partScales.scene;
    if (focusMode === "vehicle") {
      const target = launchAnimation.getVehicleFocusTarget().multiplyScalar(sScene);
      const curDir = sceneManager.camera.position.clone().sub(controls.target);
      if (curDir.lengthSq() < 1e-5) {
        curDir.set(0.6, 0.45, 1.0);
      }
      const inspectDist = Math.max(
        0.55,
        1.45 * sScene * Math.max(partScales.rocket, partScales.spacecraft)
      );
      curDir.normalize().multiplyScalar(inspectDist);
      followTarget.copy(target);
      smoothedFocus.copy(target);
      controls.target.copy(target);
      sceneManager.camera.position.copy(target).add(curDir);
      controls.update();
      return;
    }

    if (focusMode === "earth") {
      userDragged = true;
      const target = new THREE.Vector3(0, 0, 0);
      const dir = sceneManager.camera.position.clone().sub(controls.target);
      if (dir.lengthSq() < 1e-5) dir.set(0.55, 0.35, 1.0);
      const dist = Math.max(2.8, 5.2 * partScales.earth * sScene);
      dir.normalize().multiplyScalar(dist);
      followTarget.copy(target);
      smoothedFocus.copy(target);
      controls.target.copy(target);
      sceneManager.camera.position.copy(target).add(dir);
      controls.update();
      return;
    }

    if (focusMode === "orbit" || (!launchAnimation.running && !launchAnimation._orbiting)) {
      if (focusMode === "orbit") userDragged = true;
      else userDragged = false;
      const sysScale = sScene * partScales.orbit;
      const target = baseCamTarget.clone().multiplyScalar(sysScale);
      const pos = baseCamPos.clone().multiplyScalar(sysScale);
      followTarget.copy(target);
      smoothedFocus.copy(target);
      controls.target.copy(target);
      sceneManager.camera.position.copy(pos);
      controls.update();
      return;
    }

    // "auto" during flight / orbit: re-enable automatic camera tracking
    userDragged = false;
    const focus = launchAnimation.getFocusTarget().clone().multiplyScalar(sScene);
    followTarget.copy(focus);
    smoothedFocus.copy(focus);
    controls.target.copy(focus);
    controls.update();
  };

  const applyPartScales = (nextScales = {}) => {
    const clampScale = (v, fallback) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(0.25, Math.min(4.5, n)) : fallback;
    };
    partScales.scene = clampScale(nextScales.scene, partScales.scene);
    partScales.rocket = clampScale(nextScales.rocket, partScales.rocket);
    partScales.spacecraft = clampScale(nextScales.spacecraft, partScales.spacecraft);
    partScales.earth = clampScale(nextScales.earth, partScales.earth);
    partScales.destination = clampScale(nextScales.destination, partScales.destination);
    partScales.orbit = clampScale(nextScales.orbit, partScales.orbit);

    rootGroup.scale.setScalar(partScales.scene);
    planetScene.setPartScales({
      earth: partScales.earth,
      destination: partScales.destination,
      orbit: partScales.orbit,
    });
    launchAnimation.setPartScales(partScales);

    controls.minDistance = Math.max(0.08, 0.18 * partScales.scene);
    controls.maxDistance = Math.max(120, 180 * partScales.scene * Math.max(1, partScales.orbit));

    if (focusMode === "vehicle") {
      const target = launchAnimation.getVehicleFocusTarget().multiplyScalar(partScales.scene);
      const delta = target.clone().sub(controls.target);
      controls.target.copy(target);
      followTarget.copy(target);
      smoothedFocus.copy(target);
      sceneManager.camera.position.add(delta);
      controls.update();
    }
  };

  const startFlight = (rocketId, orbitId, fairingId) => {
    lastLaunchArgs = { rocketId, orbitId, fairingId };
    userDragged = false;
    const rocket = getRocketById(rocketId);
    const resolvedOrbit = getOrbitById(orbitId) ?? orbit;
    const launchResult = mechanics.simulateLaunch(rocket, gameState.spacecraft, resolvedOrbit, {
      fairingId,
      launchSite,
      missionSpec: gameState.mission,
      allowInvalid: true,
    });
    gameState.setLaunch(launchResult);

    const launchAzimuthDeg = launchResult.missionStats?.launchAzimuthDeg ?? 90;
    planetScene.orientToSite(launchSite);
    planetScene.buildOrbitRing(resolvedOrbit, launchSite, launchAzimuthDeg);

    if (currentSpacecraftHandle?.spacecraft) {
      currentSpacecraftHandle.spacecraft.dispose();
    }
    buildSpacecraftForStage();

    panel.setFlightState(launchResult);

    let lastCountdown = null;
    let engineStarted = false;
    let lastStageLabel = "";

    const siteFrame = planetScene.getLaunchSiteFrame(launchSite, launchAzimuthDeg);
    launchAnimation.start(rocket, currentSpacecraftHandle, resolvedOrbit, launchResult, {
      siteFrame,
      getSiteFrame: () => planetScene.getLaunchSiteFrame(launchSite, launchAzimuthDeg),
      onPhaseUpdate: (phaseIndex, phase, telemetry) => {
        if (telemetry?.countdownSec > 0) {
          if (telemetry.countdownSec !== lastCountdown) {
            lastCountdown = telemetry.countdownSec;
            soundFX.playCountdownTick(false);
          }
        } else if (!engineStarted && !telemetry?.failed) {
          engineStarted = true;
          soundFX.playCountdownTick(true);
          soundFX.startEngineLoop();
        }

        if (telemetry?.activeStage && telemetry.activeStage !== lastStageLabel) {
          if (lastStageLabel) {
            soundFX.playStageSeparation();
          }
          lastStageLabel = telemetry.activeStage;
        }

        if (telemetry?.failed) {
          soundFX.stopEngineLoop();
          soundFX.playAlarm();
        } else if (engineStarted) {
          const thrIntensity = (telemetry?.gLoad ?? 1) > 0.2 ? 1.0 : 0.25;
          soundFX.updateEngineIntensity(thrIntensity);
        }

        panel.updateTelemetry({
          phaseIndex,
          phase,
          ...telemetry,
        });
      },
      onComplete: (completedResult) => {
        soundFX.stopEngineLoop();
        if (completedResult?.success) {
          soundFX.playSuccess();
        }
        panel.markFlightComplete(completedResult);
      },
    });

    // Frame the camera cleanly at the KSC launch pad for T-3 countdown
    const padFocus = launchAnimation.getFocusTarget().clone().multiplyScalar(partScales.scene);
    followTarget.copy(padFocus);
    smoothedFocus.copy(padFocus);
    controls.target.copy(padFocus);
    const padViewOffset = siteFrame.up
      .clone()
      .multiplyScalar(1.3)
      .addScaledVector(siteFrame.heading, 1.8)
      .add(new THREE.Vector3(0.4, 0.5, 1.9))
      .normalize()
      .multiplyScalar(2.4 * partScales.scene * Math.max(0.75, partScales.rocket));
    sceneManager.camera.position.copy(padFocus).add(padViewOffset);
    controls.update();
  };

  const panel = new LaunchControlPanel(uiContainer, gameState, {
    onSelectRocket: (rocketId) => previewPadStack(rocketId, panel.getSelectedFairingId()),
    onSelectFairing: (fairingId) => previewPadStack(panel.getSelectedRocketId(), fairingId),
    onLaunch: (rocketId, orbitId, fairingId) => startFlight(rocketId, orbitId, fairingId),
    onSpeedChange: (speed) => launchAnimation.setSpeed(speed),
    onZoom: (factor) => zoomBy(factor),
    onResetView: () => focusCameraOn("auto"),
    onFocusMode: (mode) => focusCameraOn(mode),
    onPartScaleChange: (scales) => applyPartScales(scales),
    onResetPartScales: () =>
      applyPartScales({
        scene: 1,
        rocket: 1,
        spacecraft: 1,
        earth: 1,
        destination: 1,
        orbit: 1,
      }),
    onViewResults: () => options.onProceed?.(),
    onReplay: () => {
      if (lastLaunchArgs) {
        startFlight(lastLaunchArgs.rocketId, lastLaunchArgs.orbitId, lastLaunchArgs.fairingId);
      }
    },
  });
  panel.mount();
  previewPadStack(panel.getSelectedRocketId(), panel.getSelectedFairingId());

  activeState = {
    sceneManager,
    rootGroup,
    planetScene,
    launchAnimation,
    controls,
    panel,
    followTarget,
    smoothedFocus,
    partScales,
    getFocusMode: () => focusMode,
    isUserDragged: () => userDragged,
    onControlStart,
    getSpacecraftHandle: () => currentSpacecraftHandle,
  };
}

/**
 * Per-frame update hook advancing planet rotation, launch/orbit animation, smooth camera follow, and shake.
 * @param {number} deltaTime
 */
export function update(deltaTime) {
  if (!activeState) return;
  const {
    planetScene,
    launchAnimation,
    controls,
    sceneManager,
    followTarget,
    smoothedFocus,
    partScales,
    getFocusMode,
    isUserDragged,
  } = activeState;

  planetScene.update(deltaTime, launchAnimation.running);
  launchAnimation.update(deltaTime);

  const focusMode = getFocusMode();
  const isFlightTracking = launchAnimation.running || launchAnimation._orbiting;
  const shouldFollow =
    focusMode === "vehicle" || (focusMode === "auto" && isFlightTracking);
  if (shouldFollow) {
    const rawFocus =
      focusMode === "vehicle"
        ? launchAnimation.getVehicleFocusTarget()
        : launchAnimation.getFocusTarget();
    const focus = rawFocus.clone().multiplyScalar(partScales.scene);
    const alpha = Math.min(1, deltaTime * 5.5);
    const prevX = smoothedFocus.x;
    const prevY = smoothedFocus.y;
    const prevZ = smoothedFocus.z;
    smoothedFocus.lerp(focus, alpha);

    const dx = smoothedFocus.x - prevX;
    const dy = smoothedFocus.y - prevY;
    const dz = smoothedFocus.z - prevZ;

    controls.target.set(
      followTarget.x + dx,
      followTarget.y + dy,
      followTarget.z + dz
    );
    followTarget.copy(controls.target);
    sceneManager.camera.position.x += dx;
    sceneManager.camera.position.y += dy;
    sceneManager.camera.position.z += dz;

    if (focusMode === "auto" && !isUserDragged() && launchAnimation.running) {
      const p = launchAnimation.progress ?? 0;
      const baseDesiredDist = p < 0.2 ? 2.4 : p < 0.58 ? 3.5 : 5.4;
      const desiredDist = baseDesiredDist * partScales.scene * Math.max(0.75, partScales.orbit);
      const offset = sceneManager.camera.position.clone().sub(controls.target);
      const curDist = offset.length();
      if (curDist > 1e-4) {
        const nextDist = curDist + (desiredDist - curDist) * Math.min(1, deltaTime * 1.8);
        offset.setLength(nextDist);
        sceneManager.camera.position.copy(controls.target).add(offset);
      }
    }
  }

  const shake = launchAnimation.getCameraShake();
  if (shake > 0.01) {
    const focus = launchAnimation.getFocusTarget().clone().multiplyScalar(partScales.scene);
    controls.target.set(
      focus.x + (Math.random() - 0.5) * shake * 0.22 * partScales.scene,
      focus.y + (Math.random() - 0.5) * shake * 0.22 * partScales.scene,
      focus.z
    );
  }
  controls.update();
}

/** Clean up 3D planet/orbit objects, launch animation, controls, and launch control UI. */
export function unmount() {
  if (!activeState) return;
  const {
    sceneManager,
    rootGroup,
    planetScene,
    launchAnimation,
    controls,
    panel,
    getSpacecraftHandle,
  } = activeState;

  panel.destroy();
  controls.dispose();
  soundFX.stopEngineLoop();
  launchAnimation.reset();
  const scHandle = getSpacecraftHandle();
  scHandle?.spacecraft?.dispose();
  planetScene.dispose();
  sceneManager.removeObject(rootGroup);
  activeState = null;
}
