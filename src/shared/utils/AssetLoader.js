/**
 * @file src/shared/utils/AssetLoader.js
 * @owner Shared (Used primarily by Member 2: Spacecraft Design & Member 3: Launch & Orbit)
 * @goal Centralized Three.js GLTF/GLB + Draco loader with in-memory model caching
 *       so 3D assets in public/models/ are decoded once and cloned cleanly when reused.
 */

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

export class AssetLoader {
  constructor() {
    this._cache = new Map();
    this._dracoLoader = new DRACOLoader();
    // TODO: Configure local or CDN Draco decoder path if compressed GLBs are used.
    this._gltfLoader = new GLTFLoader();
    this._gltfLoader.setDRACOLoader(this._dracoLoader);
  }

  /**
   * Load and cache a .glb/.gltf model from public/models/, returning a cloned scene.
   * @param {string} url - Path relative to public/ (e.g. "/models/space_craft.glb")
   * @returns {Promise<import('three').Group>}
   */
  async loadModel(url) {
    // TODO: Implement cached GLTFLoader.loadAsync(url) and return gltf.scene.clone()
    throw new Error(`AssetLoader.loadModel not implemented yet for: ${url}`);
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
    this._cache.clear();
    this._dracoLoader.dispose();
  }
}
