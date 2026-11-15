/**
 * @file src/modules/launch-orbit/index.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Public entry point for the Launch & Orbit module implementing the GameModule lifecycle.
 *       Combines PlanetScene, Member 2's 3D spacecraft, OrbitMechanics, LaunchAnimation, and LaunchControlPanel.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildSpacecraftModel } from "../spacecraft-design/index.js";
import { getOrbitById } from "./data/orbits.js";
import { getRocketById } from "./data/rockets.js";
import { OrbitMechanics } from "./logic/OrbitMechanics.js";
import { LaunchAnimation } from "./models/LaunchAnimation.js";
import { PlanetScene } from "./models/PlanetScene.js";
import { LaunchControlPanel } from "./ui/LaunchControlPanel.js";

let activeState = null;

import { OrbitMechanics } from './logic/OrbitMechanics.js';
import { LaunchControlPanel } from './ui/LaunchControlPanel.js';
import { getRocketById } from './data/rockets.js';
import { getOrbitById } from './data/orbits.js';

let _panel = null;
let _mechanics = null;

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

  const earthGroup = planetScene.buildEarth();
  const targetOrbitId = gameState.mission?.targetOrbitId || "LUNAR";
  const orbit = getOrbitById(targetOrbitId) ?? getOrbitById("LEO");
  planetScene.buildOrbitRing(orbit);

  const rootGroup = new THREE.Group();
  rootGroup.name = "launch-orbit-module";
  rootGroup.add(earthGroup);
  rootGroup.add(launchAnimation.getGroup());

  sceneManager.scene.background = new THREE.Color(0x030712);
  sceneManager.addObject(rootGroup);

  const controls = new OrbitControls(sceneManager.camera, sceneManager.renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 2.6;
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

  const startFlight = (rocketId, orbitId, fairingId) => {
    lastLaunchArgs = { rocketId, orbitId, fairingId };
    const rocket = getRocketById(rocketId);
    const resolvedOrbit = getOrbitById(orbitId) ?? orbit;
    const launchResult = mechanics.simulateLaunch(rocket, gameState.spacecraft, resolvedOrbit, {
      fairingId,
      missionSpec: gameState.mission,
    });
    gameState.setLaunch(launchResult);

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

    launchAnimation.start(rocket, currentSpacecraftHandle, resolvedOrbit, launchResult, {
      onPhaseUpdate: (phaseIndex, phase, telemetry) => {
        panel.updateTelemetry({
          phaseIndex,
          phase,
          ...telemetry,
        });
      },
      onComplete: (completedResult) => {
        panel.markFlightComplete(completedResult);
      },
    });
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
    getSpacecraftHandle: () => currentSpacecraftHandle,
  };
}

/**
 * Per-frame update hook advancing planet rotation, launch/orbit animation, and camera shake.
 * @param {number} deltaTime
 */
export function update(deltaTime) {
  if (!activeState) return;
  const { planetScene, launchAnimation, controls, sceneManager } = activeState;
  planetScene.update(deltaTime);
  launchAnimation.update(deltaTime);

  const shake = launchAnimation.getCameraShake();
  if (shake > 0.01) {
    const focus = launchAnimation.getFocusTarget();
    controls.target.set(
      focus.x + (Math.random() - 0.5) * shake * 0.25,
      focus.y + (Math.random() - 0.5) * shake * 0.25,
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
  launchAnimation.reset();
  const scHandle = getSpacecraftHandle();
  scHandle?.spacecraft?.dispose();
  planetScene.dispose();
  sceneManager.removeObject(rootGroup);
  activeState = null;
}
export function mount(sceneManager, gameState, uiContainer) {
  _mechanics = new OrbitMechanics();

  // HERE is where your onLaunch callback lives:
  _panel = new LaunchControlPanel(uiContainer, gameState, (rocketId, orbitId) => {
    const rocket = getRocketById(rocketId);
    
    // Fallback: If orbitId isn't passed from UI, get it from the active mission
    const targetOrbitId = orbitId || gameState.mission?.targetOrbitId;
    const orbit = getOrbitById(targetOrbitId);

    // FIX 1: GameState uses .spacecraft (there is no .get() method)
    const spacecraftSpec = gameState.spacecraft ?? null;

    const result = _mechanics.simulateLaunch(rocket, spacecraftSpec, orbit);
    console.log('[launch-orbit] LaunchResult:', result);

    // FIX 2: Member 4's GameState uses .setLaunch() (there is no .set() method)
    gameState.setLaunch(result);

    return result;
  });

  _panel.mount();
}

/**
 * Per-frame update hook for Earth rotation and launch animation.
 * @param {number} deltaTime
 */
export function update(deltaTime) {
  // Hook up LaunchAnimation / PlanetScene updates here
}

/** Clean up 3D objects and launch control UI. */
export function unmount() {
  _panel?.destroy();
  _panel = null;
  _mechanics = null;
}
