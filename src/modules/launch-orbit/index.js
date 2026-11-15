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
  controls.minDistance = 1.4;
  controls.maxDistance = 38;

  const isDeepSpace = orbit.id === "LUNAR" || orbit.id === "MARS";
  const camPos = isDeepSpace
    ? new THREE.Vector3(orbit.orbitRadius3D * 0.45, 5.5, 11.5)
    : new THREE.Vector3(3.6, 2.8, 7.2);
  const camTarget = isDeepSpace
    ? new THREE.Vector3(orbit.orbitRadius3D * 0.4, 0, 0)
    : new THREE.Vector3(0, 0, 0);
  controls.target.copy(camTarget);
  sceneManager.setCamera(camPos, camTarget);
  controls.update();

  let currentSpacecraftHandle = null;
  let lastLaunchArgs = null;
  let userDragged = false;
  const followTarget = new THREE.Vector3().copy(camTarget);
  const smoothedFocus = new THREE.Vector3().copy(camTarget);

  const onControlStart = () => {
    userDragged = true;
  };
  controls.addEventListener("start", onControlStart);

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
    if (gameState.spacecraft) {
      currentSpacecraftHandle = buildSpacecraftModel(
        gameState.spacecraft,
        gameState.mission?.instruments ?? []
      );
    } else {
      currentSpacecraftHandle = null;
    }

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
    const padFocus = launchAnimation.getFocusTarget();
    followTarget.copy(padFocus);
    smoothedFocus.copy(padFocus);
    controls.target.copy(padFocus);
    const padViewOffset = siteFrame.up
      .clone()
      .multiplyScalar(1.3)
      .addScaledVector(siteFrame.heading, 1.8)
      .add(new THREE.Vector3(0.4, 0.5, 1.9))
      .normalize()
      .multiplyScalar(2.4);
    sceneManager.camera.position.copy(padFocus).add(padViewOffset);
    controls.update();
  };

  const panel = new LaunchControlPanel(uiContainer, gameState, {
    onLaunch: (rocketId, orbitId, fairingId) => startFlight(rocketId, orbitId, fairingId),
    onSpeedChange: (speed) => launchAnimation.setSpeed(speed),
    onViewResults: () => options.onProceed?.(),
    onReplay: () => {
      if (lastLaunchArgs) {
        startFlight(lastLaunchArgs.rocketId, lastLaunchArgs.orbitId, lastLaunchArgs.fairingId);
      }
    },
  });
  panel.mount();

  activeState = {
    sceneManager,
    rootGroup,
    planetScene,
    launchAnimation,
    controls,
    panel,
    followTarget,
    smoothedFocus,
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
    isUserDragged,
  } = activeState;

  planetScene.update(deltaTime, launchAnimation.running);
  launchAnimation.update(deltaTime);

  const shouldFollow = launchAnimation.running || launchAnimation._orbiting;
  if (shouldFollow) {
    const focus = launchAnimation.getFocusTarget();
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

    if (!isUserDragged() && launchAnimation.running) {
      const p = launchAnimation.progress ?? 0;
      const desiredDist = p < 0.2 ? 2.4 : p < 0.58 ? 3.5 : 5.4;
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
    const focus = launchAnimation.getFocusTarget();
    controls.target.set(
      focus.x + (Math.random() - 0.5) * shake * 0.22,
      focus.y + (Math.random() - 0.5) * shake * 0.22,
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
