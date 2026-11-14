/**
 * @file src/modules/spacecraft-design/index.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Public entry point for the Spacecraft Design module implementing the GameModule lifecycle
 *       and exposing buildSpacecraftModel() so Member 3 can render the player's craft in orbit.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
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
export function mount(sceneManager, gameState, uiContainer) {
  unmount();

  const bayGroup = new THREE.Group();
  bayGroup.name = "spacecraft-assembly-bay";

  // Studio + orbital rim lighting
  const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.85);
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
  keyLight.position.set(5, 7, 6);
  const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.1);
  rimLight.position.set(-6, -3, -5);
  bayGroup.add(ambientLight, keyLight, rimLight);

  // Subtle starfield & assembly bay turntable ring
  const stars = _createStarfield();
  bayGroup.add(stars);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 2.26, 64),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -1.6;
  bayGroup.add(ring);

  sceneManager.scene.background = new THREE.Color(0x060b16);
  sceneManager.addObject(bayGroup);

  const controls = new OrbitControls(sceneManager.camera, sceneManager.renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 2.2;
  controls.maxDistance = 14;
  controls.target.set(0, 0, 0);
  sceneManager.setCamera(new THREE.Vector3(3.4, 2.1, 4.4), controls.target);
  controls.update();

  // Restore previous spacecraft selection if player returns to Design phase
  const config = new SpacecraftConfig(gameState.spacecraft?.selection);
  const spacecraft = new Spacecraft();
  bayGroup.add(spacecraft.getGroup());

  const configurator = new SpacecraftConfigurator(uiContainer, {
    onSelectComponent: (category, componentId) => {
      config.setComponent(category, componentId);
      syncSpacecraft();
    },
    onToggleSolar: (deployed) => spacecraft.setSolarDeployed(deployed),
    onToggleThrust: (active) => spacecraft.setThrustActive(active),
  });

  configurator.mount();

  let lastMissionRef = gameState.mission;
  let isSyncing = false;

  const syncSpacecraft = () => {
    isSyncing = true;
    try {
      config.setInstruments(gameState.mission?.instruments);
      const spec = config.toSpacecraftSpec(gameState.mission);
      spacecraft.assemble(spec.selection);
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
    controls,
    spacecraft,
    configurator,
    unsubscribe,
  };
}

/**
 * Per-frame update hook advancing OrbitControls damping and solar/thruster animations.
 * @param {number} deltaTime
 */
export function update(deltaTime) {
  if (!activeState) return;
  activeState.controls.update();
  activeState.spacecraft.update(deltaTime);
}

/** Clean up assembly bay 3D objects, OrbitControls, subscriptions, and configurator UI. */
export function unmount() {
  if (!activeState) return;
  const { sceneManager, bayGroup, controls, spacecraft, configurator, unsubscribe } = activeState;

  unsubscribe();
  configurator.destroy();
  controls.dispose();
  spacecraft.dispose();

  bayGroup.traverse((obj) => {
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
 * @returns {{ spacecraft: Spacecraft, group: THREE.Group }}
 */
export function buildSpacecraftModel(spacecraftSpec) {
  const spacecraft = new Spacecraft();
  const group = spacecraft.assemble(spacecraftSpec.selection);
  return { spacecraft, group };
}

function _createStarfield() {
  const count = 600;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 35 + Math.random() * 45;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xcbd5e1, size: 0.14 });
  return new THREE.Points(geo, mat);
}
