/**
 * @file src/shared/utils/AssetLoader.js
 * @owner Shared (Used primarily by Member 2: Spacecraft Design & Member 3: Launch & Orbit)
 * @goal Centralized Three.js GLTF/GLB + Draco loader with in-memory model caching
 *       so 3D assets in public/models/ are decoded once and cloned cleanly when reused.
 */

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

export class AssetLoader {
  /** @param {string} [dracoDecoderPath="/draco/gltf/"] */
  constructor(dracoDecoderPath = "/draco/gltf/") {
    this._cache = new Map();
    this._dracoLoader = new DRACOLoader();
    this._dracoLoader.setDecoderPath(dracoDecoderPath);
    this._gltfLoader = new GLTFLoader();
    this._gltfLoader.setDRACOLoader(this._dracoLoader);
  }

  /**
   * Load and cache a .glb/.gltf model from public/models/, returning a cloned scene.
   * Cloned nodes are tagged with `userData.sharedAsset = true` so callers do not dispose
   * cached GPU geometries or materials when tearing down temporary assemblies.
   * @param {string} url - Path relative to public/ (e.g. "/models/instruments/optical-camera.glb")
   * @returns {Promise<import('three').Group>}
   */
  async loadModel(url) {
    if (!url || typeof url !== "string") {
      throw new Error("AssetLoader.loadModel requires a valid model URL.");
    }

    let pending = this._cache.get(url);
    if (!pending) {
      pending = this._gltfLoader
        .loadAsync(url)
        .then((gltf) => {
          const toRemove = [];
          gltf.scene.traverse((obj) => {
            if (obj.isLight || obj.isCamera) toRemove.push(obj);
          });
          for (const obj of toRemove) {
            obj.parent?.remove(obj);
          }
          return gltf.scene;
        })
        .catch((err) => {
          this._cache.delete(url);
          throw err;
        });
      this._cache.set(url, pending);
    }

    const template = await pending;
    const clone = template.clone(true);
    clone.traverse((obj) => {
      obj.userData.sharedAsset = true;
    });
    return clone;
  }

  /**
   * Preload an array of model URLs ahead of a phase transition.
   * @param {string[]} urls
   * @returns {Promise<void>}
   */
  async preloadModels(urls) {
    await Promise.all(urls.map((url) => this.loadModel(url)));
  }

  /** Clear cached models and dispose Draco worker resources. */
  dispose() {
    for (const pending of this._cache.values()) {
      pending
        .then((scene) => {
          scene.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
              const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              mats.forEach((m) => m.dispose());
            }
          });
        })
        .catch(() => {});
    }
    this._cache.clear();
    this._dracoLoader.dispose();
  }
}
