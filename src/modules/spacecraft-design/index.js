/**
 * @file src/modules/spacecraft-design/index.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Public entry point for the Spacecraft Design module implementing the GameModule lifecycle
 *       and exposing buildSpacecraftModel() so Member 3 can render the player's craft in orbit.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { AssetLoader } from "../../shared/utils/AssetLoader.js";
import { KennedyHangarScene } from "./models/KennedyHangarScene.js";
import { Spacecraft } from "./models/Spacecraft.js";
import { SpacecraftConfig } from "./logic/SpacecraftConfig.js";
import { SpacecraftConfigurator } from "./ui/SpacecraftConfigurator.js";

let activeState = null;

/**
 * Mount the Spacecraft Design assembly bay (3D OrbitControls preview + configurator UI).
 * @param {import('../../core/SceneManager.js').SceneManager} sceneManager
 * @param {import('../../core/GameState.js').GameState} gameState
 * @param {HTMLElement} uiContainer
 */
export function mount(sceneManager, gameState, uiContainer, options = {}) {
  unmount();

  const bayGroup = new THREE.Group();
  bayGroup.name = "spacecraft-assembly-bay";

  // Studio + orbital rim lighting & procedural reflections for metallic PBR instruments
  const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 1.15);
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(5, 7, 6);
  const backFillLight = new THREE.DirectionalLight(0xbae6fd, 1.35);
  backFillLight.position.set(-5, 4, -6);
  const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.0);
  rimLight.position.set(-6, -3, 3);
  bayGroup.add(hemiLight, keyLight, backFillLight, rimLight);

  const envRT = _createStudioEnvironment(sceneManager.renderer);
  const previousEnv = sceneManager.scene.environment;
  sceneManager.scene.environment = envRT.texture;

  // Kennedy Space Center Vehicle Integration High-Bay Hangar
  const hangar = new KennedyHangarScene();
  bayGroup.add(hangar.build());

  sceneManager.scene.background = new THREE.Color(0x60a5fa);
  sceneManager.addObject(bayGroup);

  const controls = new OrbitControls(sceneManager.camera, sceneManager.renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 2.4;
  controls.maxDistance = 8.8;
  controls.minPolarAngle = Math.PI * 0.16;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.target.set(0, -0.05, 0);
  sceneManager.setCamera(new THREE.Vector3(2.1, 1.05, 6.2), controls.target);
  controls.update();

  // Restore previous spacecraft selection if player returns to Design phase
  const assetLoader = new AssetLoader();
  const config = new SpacecraftConfig(gameState.spacecraft?.selection);
  const spacecraft = new Spacecraft({ assetLoader });
  bayGroup.add(spacecraft.getGroup());

  const configurator = new SpacecraftConfigurator(uiContainer, {
    onSelectComponent: (category, componentId) => {
      config.setComponent(category, componentId);
      syncSpacecraft();
    },
    onToggleSolar: (deployed) => spacecraft.setSolarDeployed(deployed),
    onToggleThrust: (active) => spacecraft.setThrustActive(active),
    onProceed: options.onProceed,
  });

  configurator.mount();

  let lastMissionRef = gameState.mission;
  let isSyncing = false;
  let elapsedSec = 0;

  const syncSpacecraft = () => {
    isSyncing = true;
    try {
      const instruments = gameState.mission?.instruments ?? [];
      config.setInstruments(instruments);
      const spec = config.toSpacecraftSpec(gameState.mission);
      spacecraft.assemble(spec.selection, instruments);
      hangar.fitPedestalToSpacecraft(spacecraft.getGroup());
      configurator.updateStats(spec);
      gameState.setSpacecraft(spec);
    } finally {
      isSyncing = false;
    }
  };

  // Re-validate automatically if MissionSpec updates while Design module is mounted
  const unsubscribe = gameState.subscribe((state) => {
    if (isSyncing || state.mission === lastMissionRef) return;
    lastMissionRef = state.mission;
    syncSpacecraft();
  });

  syncSpacecraft();

  activeState = {
    sceneManager,
    bayGroup,
    hangar,
    controls,
    spacecraft,
    configurator,
    assetLoader,
    envRT,
    previousEnv,
    unsubscribe,
    getElapsed: () => elapsedSec,
    addElapsed: (dt) => {
      elapsedSec += dt;
      return elapsedSec;
    },
  };
}

/**
 * Per-frame update hook advancing OrbitControls damping and solar/thruster animations.
 * @param {number} deltaTime
 */
export function update(deltaTime) {
  if (!activeState) return;
  const elapsed = activeState.addElapsed(deltaTime);
  activeState.controls.update();
  activeState.spacecraft.update(deltaTime);
  activeState.hangar.update(deltaTime, elapsed);
}

/** Clean up assembly bay 3D objects, OrbitControls, subscriptions, and configurator UI. */
export function unmount() {
  if (!activeState) return;
  const {
    sceneManager,
    bayGroup,
    hangar,
    controls,
    spacecraft,
    configurator,
    assetLoader,
    envRT,
    previousEnv,
    unsubscribe,
  } = activeState;

  unsubscribe();
  configurator.destroy();
  controls.dispose();
  spacecraft.dispose();
  hangar.dispose();
  assetLoader.dispose();
  sceneManager.scene.environment = previousEnv ?? null;
  envRT?.dispose();

  bayGroup.traverse((obj) => {
    if (obj.userData?.sharedAsset) return;
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => m.dispose());
    }
  });

  sceneManager.removeObject(bayGroup);
  activeState = null;
}

/**
 * Build a standalone 3D spacecraft model from a SpacecraftSpec for Launch & Orbit.
 * @param {import('../../shared/interfaces/SpacecraftSpec.js').SpacecraftSpec} spacecraftSpec
 * @param {Array<Object>} [instruments=[]]
 * @returns {{ spacecraft: Spacecraft, group: THREE.Group }}
 */
export function buildSpacecraftModel(spacecraftSpec, instruments = []) {
  const spacecraft = new Spacecraft();
  const group = spacecraft.assemble(spacecraftSpec.selection, instruments);
  return { spacecraft, group };
}

function _createStudioEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x334155);

  const panels = [
    { pos: [0, 6, 4], scale: [10, 4, 1], color: 0xfffbeb },
    { pos: [6, 3, -4], scale: [6, 6, 1], color: 0xe0f2fe },
    { pos: [-6, 2, 0], scale: [6, 6, 1], color: 0xbae6fd },
    { pos: [0, -6, 0], scale: [10, 1, 10], color: 0x475569 },
  ];
  const geo = new THREE.BoxGeometry(1, 1, 1);
  for (const p of panels) {
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: p.color }));
    mesh.position.set(...p.pos);
    mesh.scale.set(...p.scale);
    mesh.lookAt(0, 0, 0);
    envScene.add(mesh);
  }

  const envRT = pmrem.fromScene(envScene, 0.04);
  geo.dispose();
  envScene.traverse((obj) => {
    if (obj.material) obj.material.dispose();
  });
  pmrem.dispose();
  return envRT;
}
