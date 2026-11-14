/**
 * @file src/core/SceneManager.js
 * @owner Core (Shared across all 4 members)
 * @goal Owns the shared Three.js WebGLRenderer, PerspectiveCamera, Scene, and resize loop.
 *       Modules add/remove 3D objects into this scene during their mount/unmount lifecycle.
 */

import * as THREE from "three";

export class SceneManager {
  /** @param {HTMLElement} container */
  constructor(container = document.body) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    );
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    this._onResize = () => this.handleResize();
    window.addEventListener("resize", this._onResize);
  }

  /** Update camera aspect ratio and renderer size on window resize. */
  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /** @param {THREE.Object3D} object */
  addObject(object) {
    this.scene.add(object);
  }

  /** @param {THREE.Object3D} object */
  removeObject(object) {
    this.scene.remove(object);
  }

  /** Position camera and aim at target coordinates. */
  setCamera(position, lookAt = new THREE.Vector3(0, 0, 0)) {
    this.camera.position.copy(position);
    this.camera.lookAt(lookAt);
  }

  /** Render one frame. */
  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /** Clean up renderer and event listeners. */
  dispose() {
    window.removeEventListener("resize", this._onResize);
    this.renderer.dispose();
  }
}
