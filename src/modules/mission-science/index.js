/**
 * @file src/modules/mission-science/index.js
 * @owner Member 1 (Mission & Science)
 * @goal Public entry point for the Mission & Science module implementing the GameModule lifecycle
 *       and exposing evaluateMission() for the end-of-game Results screen.
 */

import * as THREE from "three";
import { getMissionById } from "./data/missions.js";
import { MissionEvaluator } from "./logic/MissionEvaluator.js";
import { createPlanetModel } from "./models/proceduralPlanets.js";
import { MissionPlanner } from "./ui/MissionPlanner.js";

const evaluator = new MissionEvaluator();

const ORBIT_VIEW_SPECS = {
  LEO: { scale: 1.35, orbitRadius: 1.85, ringColor: 0x38bdf8 },
  MEO: { scale: 1.3, orbitRadius: 2.2, ringColor: 0x60a5fa },
  GEO: { scale: 1.2, orbitRadius: 2.55, ringColor: 0x93c5fd },
  LUNAR: { scale: 1.2, orbitRadius: 1.95, ringColor: 0xe2e8f0 },
  MARS: { scale: 1.28, orbitRadius: 2.05, ringColor: 0xfb923c },
};

let activeState = null;

function _disposeObject(obj) {
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat) => {
        if (mat.map) mat.map.dispose();
        mat.dispose();
      });
    }
  });
}

/**
 * Mount the Mission & Science phase into the shared scene and UI container.
 * @param {import('../../core/SceneManager.js').SceneManager} sceneManager
 * @param {import('../../core/GameState.js').GameState} gameState
 * @param {HTMLElement} uiContainer
 * @param {{ onProceed?: () => void }} [options]
 */
export function mount(sceneManager, gameState, uiContainer, options = {}) {
  unmount();

  const previewGroup = new THREE.Group();
  previewGroup.name = "mission-target-preview";

  const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 0.75);
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(6, 4, 5);
  const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
  rimLight.position.set(-5, -2, -4);
  previewGroup.add(hemi, sun, rimLight, _createStarfield());

  const planetHolder = new THREE.Group();
  planetHolder.name = "planet-holder";
  previewGroup.add(planetHolder);

  const orbitPivot = new THREE.Group();
  orbitPivot.rotation.x = 0.32;
  orbitPivot.rotation.z = -0.18;
  previewGroup.add(orbitPivot);

  const orbitRingMaterial = new THREE.MeshBasicMaterial({
    color: ORBIT_VIEW_SPECS.LEO.ringColor,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  });
  const orbitRing = new THREE.Mesh(
    new THREE.RingGeometry(1.83, 1.87, 72),
    orbitRingMaterial
  );
  orbitRing.rotation.x = Math.PI / 2;
  orbitPivot.add(orbitRing);

  const markerPivot = new THREE.Group();
  orbitPivot.add(markerPivot);
  const targetMarker = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.08, 0),
    new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.6,
      metalness: 0.7,
      roughness: 0.25,
    })
  );
  targetMarker.position.x = 1.85;
  markerPivot.add(targetMarker);

  sceneManager.scene.background = new THREE.Color(0x050914);
  sceneManager.addObject(previewGroup);
  sceneManager.setCamera(new THREE.Vector3(0, 1.4, 5.4), new THREE.Vector3(0, 0, 0));

  let currentModelKey = null;

  const syncPlanetPreview = (missionSpec) => {
    const orbitId = missionSpec?.targetOrbitId || "LEO";
    const template = missionSpec?.missionId ? getMissionById(missionSpec.missionId) : null;
    const modelKey = template?.model ?? template?.destination ?? orbitId;

    if (modelKey !== currentModelKey) {
      currentModelKey = modelKey;
      while (planetHolder.children.length > 0) {
        const old = planetHolder.children[0];
        planetHolder.remove(old);
        _disposeObject(old);
      }
      planetHolder.add(createPlanetModel(modelKey));
    }

    const view = ORBIT_VIEW_SPECS[orbitId] || ORBIT_VIEW_SPECS.LEO;
    planetHolder.scale.setScalar(view.scale);
    orbitRingMaterial.color.setHex(view.ringColor);
    orbitRing.scale.setScalar(view.orbitRadius / 1.85);
    targetMarker.position.x = view.orbitRadius;
  };

  const unsubscribe = gameState?.subscribe
    ? gameState.subscribe(() => {
        syncPlanetPreview(gameState.mission);
      })
    : null;

  const planner = new MissionPlanner(uiContainer, gameState, {
    onProceed: options.onProceed,
  });
  planner.mount();

  syncPlanetPreview(gameState?.mission);

  activeState = {
    sceneManager,
    previewGroup,
    planetHolder,
    markerPivot,
    planner,
    unsubscribe,
  };
}

/**
 * Per-frame update hook called during the Mission & Science phase.
 * @param {number} deltaTime
 */
export function update(deltaTime) {
  if (!activeState) return;
  activeState.planetHolder.rotation.y += deltaTime * 0.18;
  activeState.markerPivot.rotation.y += deltaTime * 0.65;
}

/** Clean up 3D preview objects and MissionPlanner UI. */
export function unmount() {
  if (!activeState) return;

  const { sceneManager, previewGroup, planner, unsubscribe } = activeState;
  activeState = null;

  if (unsubscribe) unsubscribe();
  planner.destroy();
  sceneManager.removeObject(previewGroup);
  _disposeObject(previewGroup);
}

/**
 * Evaluate the completed mission for Member 4's Results screen.
 * @param {import('../../core/GameState.js').GameState} gameState
 */
export function evaluateMission(gameState) {
  return evaluator.calculateScore(
    gameState.mission,
    gameState.spacecraft,
    gameState.launch
  );
}

function _createStarfield() {
  const count = 450;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 22 + Math.random() * 28;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: 0xcbd5e1, size: 0.1, sizeAttenuation: true })
  );
}
