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
  LEO: { scale: 1.55, orbitRadius: 2.05, ringColor: 0x19bfff },
  MEO: { scale: 1.48, orbitRadius: 2.38, ringColor: 0x1677ff },
  GEO: { scale: 1.38, orbitRadius: 2.68, ringColor: 0x19bfff },
  LUNAR: { scale: 1.42, orbitRadius: 2.15, ringColor: 0x35d58a },
  MARS: { scale: 1.48, orbitRadius: 2.22, ringColor: 0xff9d24 },
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

  const hemi = new THREE.HemisphereLight(0xeaf4ff, 0x050b1b, 0.72);
  const sun = new THREE.DirectionalLight(0xfff6e8, 2.25);
  sun.position.set(6, 4, 5);
  const rimLight = new THREE.DirectionalLight(0x19bfff, 0.75);
  rimLight.position.set(-5, -2, -4);
  previewGroup.add(hemi, sun, rimLight, _createStarfield());

  // Stage container offset slightly right so the left mission list never covers the planet
  const stagePivot = new THREE.Group();
  stagePivot.position.set(1.05, 0.1, 0);
  previewGroup.add(stagePivot);

  const planetHolder = new THREE.Group();
  planetHolder.name = "planet-holder";
  stagePivot.add(planetHolder);

  // Distant Earth visible in background when previewing Lunar missions
  const bgEarth = createPlanetModel("procedural:earth");
  bgEarth.scale.setScalar(0.75);
  bgEarth.position.set(-2.5, 1.55, -5.8);
  bgEarth.visible = false;
  stagePivot.add(bgEarth);

  const orbitPivot = new THREE.Group();
  orbitPivot.rotation.x = 0.34;
  orbitPivot.rotation.z = -0.18;
  stagePivot.add(orbitPivot);

  const orbitRingMaterial = new THREE.MeshBasicMaterial({
    color: ORBIT_VIEW_SPECS.LEO.ringColor,
    transparent: true,
    opacity: 0.58,
    side: THREE.DoubleSide,
  });
  const orbitRing = new THREE.Mesh(
    new THREE.RingGeometry(1.83, 1.87, 84),
    orbitRingMaterial
  );
  orbitRing.rotation.x = Math.PI / 2;
  orbitPivot.add(orbitRing);

  const markerPivot = new THREE.Group();
  orbitPivot.add(markerPivot);
  const targetMarker = _createOrbitingProbeIcon();
  targetMarker.position.x = 1.85;
  markerPivot.add(targetMarker);

  sceneManager.scene.background = new THREE.Color(0x050b1b);
  sceneManager.addObject(previewGroup);
  sceneManager.setCamera(new THREE.Vector3(0, 1.15, 5.5), new THREE.Vector3(0.45, 0, 0));

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

    bgEarth.visible = orbitId === "LUNAR" || String(modelKey).toLowerCase().includes("moon");

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

function _createOrbitingProbeIcon() {
  const probe = new THREE.Group();
  const bus = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.11, 8),
    new THREE.MeshStandardMaterial({
      color: 0xff9d24,
      emissive: 0x452200,
      metalness: 0.65,
      roughness: 0.25,
    })
  );
  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.015, 0.07),
    new THREE.MeshStandardMaterial({
      color: 0x1677ff,
      emissive: 0x19bfff,
      emissiveIntensity: 0.35,
      metalness: 0.5,
      roughness: 0.25,
    })
  );
  probe.add(bus, wing);
  return probe;
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
