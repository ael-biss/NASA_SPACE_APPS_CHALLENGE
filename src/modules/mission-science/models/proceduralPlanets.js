/**
 * @file src/modules/mission-science/models/proceduralPlanets.js
 * @owner Member 1 (Mission & Science)
 * @goal High-detail 3D planet and moon models (Earth, Moon, Mars) for the Mission & Science
 *       target preview, using real equirectangular .jpg textures with procedural fallbacks.
 */

import * as THREE from "three";

function _createCanvasTexture(width, height, drawFn) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  drawFn(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function _createEarthFallbackTexture() {
  return _createCanvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = "#0f3d7a";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#2b6e49";
    const blobs = [
      [110, 95, 42, 34],
      [145, 165, 26, 42],
      [255, 85, 36, 26],
      [272, 145, 30, 44],
      [355, 92, 65, 36],
      [410, 178, 28, 22],
    ];
    for (const [x, y, rx, ry] of blobs) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(0, 0, w, 16);
    ctx.fillRect(0, h - 16, w, 16);
  });
}

function _createMoonFallbackTexture() {
  return _createCanvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = "#9ca3af";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#4b5563";
    const maria = [
      [165, 92, 46, 32, 0.2],
      [228, 108, 34, 24, -0.3],
      [285, 96, 28, 22, 0.1],
      [195, 138, 24, 18, 0.4],
      [360, 115, 30, 20, -0.2],
    ];
    for (const [x, y, rx, ry, rot] of maria) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function _createMarsFallbackTexture() {
  return _createCanvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = "#c2410c";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(92, 31, 14, 0.68)";
    const plains = [
      [180, 95, 48, 28, 0.15],
      [340, 125, 42, 32, -0.3],
      [430, 165, 36, 22, 0.2],
    ];
    for (const [x, y, rx, ry, rot] of plains) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(0, 0, w, 14);
    ctx.fillRect(0, h - 14, w, 14);
  });
}

/**
 * Create a high-resolution planet sphere that displays an immediate procedural
 * canvas texture and upgrades asynchronously to an equirectangular .jpg map.
 */
function _createTexturedSphere({
  name,
  textureUrl,
  fallbackTexture,
  fallbackColor,
  roughness,
  metalness,
}) {
  const mat = new THREE.MeshStandardMaterial({
    map: fallbackTexture ?? null,
    color: fallbackTexture ? 0xffffff : fallbackColor,
    roughness,
    metalness,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.0, 64, 48), mat);
  mesh.name = name;

  if (typeof Image !== "undefined" && textureUrl) {
    const loader = new THREE.TextureLoader();
    loader.load(
      textureUrl,
      (loadedTex) => {
        if (!mesh.parent) {
          loadedTex.dispose();
          return;
        }
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        loadedTex.anisotropy = 4;
        if (fallbackTexture) fallbackTexture.dispose();
        mat.map = loadedTex;
        mat.color.setHex(0xffffff);
        mat.needsUpdate = true;
      },
      undefined,
      () => {
        // Retain procedural canvas texture if external image fails to load
      }
    );
  }

  return mesh;
}

/**
 * 1. EARTH
 * Uses /textures/earth-blue-marble.jpg with cloud layer and atmospheric blue rim glow.
 */
export function createEarthModel() {
  const group = new THREE.Group();
  group.name = "planet:earth";

  group.add(
    _createTexturedSphere({
      name: "earth-sphere",
      textureUrl: "/textures/earth-blue-marble.jpg",
      fallbackTexture: _createEarthFallbackTexture(),
      fallbackColor: 0x1d4ed8,
      roughness: 0.72,
      metalness: 0.06,
    })
  );

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.016, 36, 24),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
      roughness: 1.0,
    })
  );
  group.add(clouds);

  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(1.072, 36, 24),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.16,
      side: THREE.BackSide,
    })
  );
  group.add(atmo);

  return group;
}

/**
 * 2. MOON
 * Uses /textures/moon.jpg (2K equirectangular lunar map) with procedural fallback.
 */
export function createMoonModel() {
  const group = new THREE.Group();
  group.name = "planet:moon";

  group.add(
    _createTexturedSphere({
      name: "moon-sphere",
      textureUrl: "/textures/moon.jpg",
      fallbackTexture: _createMoonFallbackTexture(),
      fallbackColor: 0x94a3b8,
      roughness: 0.92,
      metalness: 0.04,
    })
  );

  return group;
}

/**
 * 3. MARS
 * Uses /textures/mars.jpg (2K equirectangular Mars map) with dusty atmospheric haze.
 */
export function createMarsModel() {
  const group = new THREE.Group();
  group.name = "planet:mars";

  group.add(
    _createTexturedSphere({
      name: "mars-sphere",
      textureUrl: "/textures/mars.jpg",
      fallbackTexture: _createMarsFallbackTexture(),
      fallbackColor: 0xc2410c,
      roughness: 0.85,
      metalness: 0.05,
    })
  );

  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(1.07, 36, 24),
    new THREE.MeshBasicMaterial({
      color: 0xfb923c,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
    })
  );
  group.add(haze);

  return group;
}

export const PLANET_BUILDERS = {
  "procedural:earth": createEarthModel,
  "procedural:moon": createMoonModel,
  "procedural:mars": createMarsModel,
};

/**
 * Build a 3D planet/moon model from a model spec ("procedural:earth"), destination ("Moon"),
 * or orbit ID ("LUNAR", "MARS", "LEO", "MEO", "GEO").
 * @param {string} key
 * @returns {THREE.Group}
 */
export function createPlanetModel(key = "procedural:earth") {
  const normalized = String(key).toLowerCase();
  if (PLANET_BUILDERS[normalized]) {
    return PLANET_BUILDERS[normalized]();
  }
  if (normalized.includes("moon") || normalized.includes("lunar")) {
    return createMoonModel();
  }
  if (normalized.includes("mars")) {
    return createMarsModel();
  }
  return createEarthModel();
}
