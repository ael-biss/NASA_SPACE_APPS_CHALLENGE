/**
 * @file src/modules/mission-science/index.js
 * @owner Member 1 (Mission & Science)
 * @goal Public entry point for the Mission & Science module implementing the GameModule lifecycle
 *       and exposing evaluateMission() for the end-of-game Results screen.
 */

import * as THREE from "three";
import { MissionEvaluator } from "./logic/MissionEvaluator.js";
import { MissionPlanner } from "./ui/MissionPlanner.js";

const evaluator = new MissionEvaluator();
let activeState = null;

function _buildTargetGlobe(targetOrbitId = "LUNAR") {
  const group = new THREE.Group();
  group.name = "mission-target-globe";

  let color = 0x2563eb;
  let emissive = 0x0f172a;
  let haloColor = 0x38bdf8;
  let hasHalo = true;

  if (targetOrbitId === "LUNAR") {
    color = 0x94a3b8;
    emissive = 0x1e293b;
    haloColor = 0xcbd5e1;
    hasHalo = false;
  } else if (targetOrbitId === "MARS") {
    color = 0xc2410c;
    emissive = 0x431407;
    haloColor = 0xfb923c;
    hasHalo = true;
  }

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.55, 48, 36),
    new THREE.MeshStandardMaterial({
      color,
      emissive,
      roughness: targetOrbitId === "LUNAR" ? 0.92 : 0.65,
      metalness: 0.08,
    })
  );
  group.add(sphere);

  // Subtle target orbit ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.15, 0.02, 12, 72),
    new THREE.MeshBasicMaterial({
      color: haloColor,
      transparent: true,
      opacity: 0.55,
    })
  );
  ring.rotation.x = Math.PI * 0.38;
  ring.rotation.y = Math.PI * 0.12;
  group.add(ring);

  if (hasHalo) {
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.66, 36, 24),
      new THREE.MeshBasicMaterial({
        color: haloColor,
        transparent: true,
        opacity: 0.14,
        side: THREE.BackSide,
      })
    );
    group.add(halo);
  }

  return group;
}

function _createStarfield() {
  const count = 700;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 40 + Math.random() * 50;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xe2e8f0, size: 0.15 }));
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

  const rootGroup = new THREE.Group();
  rootGroup.name = "mission-science-scene";

  const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 0.7);
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(6, 4, 5);
  rootGroup.add(hemi, sun, _createStarfield());

  let currentOrbitId = gameState.mission?.targetOrbitId ?? "LUNAR";
  let globeGroup = _buildTargetGlobe(currentOrbitId);
  rootGroup.add(globeGroup);

  sceneManager.scene.background = new THREE.Color(0x050914);
  sceneManager.addObject(rootGroup);
  sceneManager.setCamera(new THREE.Vector3(0, 0.6, 5.4), new THREE.Vector3(0, 0, 0));

  const planner = new MissionPlanner(uiContainer, gameState, {
    onProceed: options.onProceed,
  });
  planner.mount();

  const unsubscribe = gameState.subscribe((state) => {
    const nextOrbit = state.mission?.targetOrbitId ?? "LUNAR";
    if (nextOrbit !== currentOrbitId && activeState) {
      currentOrbitId = nextOrbit;
      rootGroup.remove(globeGroup);
      _disposeGroup(globeGroup);
      globeGroup = _buildTargetGlobe(currentOrbitId);
      rootGroup.add(globeGroup);
      activeState.globeGroup = globeGroup;
    }
  });

  activeState = {
    sceneManager,
    rootGroup,
    globeGroup,
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
  activeState.globeGroup.rotation.y += deltaTime * 0.28;
}

/** Clean up 3D preview objects and MissionPlanner UI. */
export function unmount() {
  if (!activeState) return;
  const { sceneManager, rootGroup, planner, unsubscribe } = activeState;
  unsubscribe();
  planner.destroy();
  _disposeGroup(rootGroup);
  sceneManager.removeObject(rootGroup);
  activeState = null;
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

function _disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => m.dispose());
    }
  });
}
