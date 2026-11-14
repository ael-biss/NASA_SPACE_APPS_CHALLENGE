/**
 * @file src/main.js
 * @owner Shared / Member 4 (Interface & Integration)
 * @goal Application bootstrapper. Currently runs the Phase 0 Three.js verification cube;
 *       in Phase 1+ it will initialize SceneManager, GameState, and GameInterface.
 */

import * as THREE from "three";
import "./styles/main.css";

// Phase 0 verification scene (replace with initGame() once module integration starts)
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101827);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const material = new THREE.MeshStandardMaterial({
  color: 0x2196f3,
  metalness: 0.5,
  roughness: 0.4,
});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(3, 3, 5);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.7));

function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += 0.005;
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
