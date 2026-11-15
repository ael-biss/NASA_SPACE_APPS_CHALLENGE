/**
 * @file src/modules/mission-science/models/proceduralPlanets.js
 * @owner Member 1 (Mission & Science)
 * @goal Procedural 3D planet and moon models (Earth, Moon, Mars) for the Mission & Science
 *       target preview, matching the procedural model pattern used for instruments.
 */

import * as THREE from "three";

const UP_Y = new THREE.Vector3(0, 1, 0);

/**
 * Place a surface feature mesh on a sphere of radius `r` at spherical coordinates `(latDeg, lonDeg)`,
 * oriented along the outward surface normal.
 */
function placeOnSphere(mesh, r, latDeg, lonDeg) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const normal = new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.sin(lon)
  ).normalize();

  mesh.position.copy(normal).multiplyScalar(r);
  mesh.quaternion.setFromUnitVectors(UP_Y, normal);
}

/**
 * 1. EARTH
 * Deep-blue oceans, green/ochre continental landmasses, polar ice caps,
 * drifting cloud patches, and an outer atmospheric glow shell.
 */
export function createEarthModel() {
  const group = new THREE.Group();
  group.name = "planet:earth";

  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    emissive: 0x0b1f4d,
    roughness: 0.42,
    metalness: 0.12,
  });
  const landMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    roughness: 0.78,
    metalness: 0.04,
  });
  const aridMat = new THREE.MeshStandardMaterial({
    color: 0xca8a04,
    roughness: 0.85,
    metalness: 0.03,
  });
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.55,
    metalness: 0.05,
  });
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.45,
    roughness: 0.9,
  });
  const atmoMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.16,
    side: THREE.BackSide,
  });

  // Ocean core
  group.add(new THREE.Mesh(new THREE.SphereGeometry(1.0, 40, 28), oceanMat));

  // Stylized continental landmasses
  const continents = [
    { lat: 38, lon: -100, rx: 0.34, rz: 0.24, mat: landMat }, // North America
    { lat: -15, lon: -60, rx: 0.22, rz: 0.3, mat: landMat },  // South America
    { lat: 48, lon: 15, rx: 0.24, rz: 0.18, mat: landMat },   // Europe
    { lat: 8, lon: 20, rx: 0.28, rz: 0.3, mat: aridMat },     // Africa
    { lat: 42, lon: 90, rx: 0.42, rz: 0.28, mat: landMat },   // Asia
    { lat: -25, lon: 135, rx: 0.2, rz: 0.16, mat: aridMat },  // Australia
  ];
  for (const c of continents) {
    const geo = new THREE.CylinderGeometry(c.rx, c.rx * 1.05, 0.04, 14);
    geo.scale(1, 1, c.rz / c.rx);
    const mesh = new THREE.Mesh(geo, c.mat);
    placeOnSphere(mesh, 0.992, c.lat, c.lon);
    group.add(mesh);
  }

  // Polar ice caps
  for (const lat of [84, -84]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.04, 18), iceMat);
    placeOnSphere(cap, 0.99, lat, 0);
    group.add(cap);
  }

  // Cloud layer patches
  const clouds = new THREE.Group();
  clouds.name = "earth-clouds";
  const cloudBands = [
    { lat: 20, lon: -40, rx: 0.26, rz: 0.1 },
    { lat: -10, lon: 50, rx: 0.3, rz: 0.11 },
    { lat: 52, lon: 140, rx: 0.24, rz: 0.09 },
    { lat: -42, lon: -120, rx: 0.28, rz: 0.1 },
  ];
  for (const b of cloudBands) {
    const geo = new THREE.CylinderGeometry(b.rx, b.rx, 0.015, 12);
    geo.scale(1, 1, b.rz / b.rx);
    const mesh = new THREE.Mesh(geo, cloudMat);
    placeOnSphere(mesh, 1.045, b.lat, b.lon);
    clouds.add(mesh);
  }
  group.add(clouds);

  // Outer atmospheric rim glow
  group.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 32, 24), atmoMat));

  return group;
}

/**
 * 2. MOON
 * Pale lunar regolith, darker basaltic maria, and 3D ringed impact craters.
 */
export function createMoonModel() {
  const group = new THREE.Group();
  group.name = "planet:moon";

  const regolithMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    emissive: 0x1e293b,
    roughness: 0.92,
    metalness: 0.04,
  });
  const mariaMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.88,
    metalness: 0.06,
  });
  const craterRimMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.85,
    metalness: 0.05,
  });

  // Regolith core
  group.add(new THREE.Mesh(new THREE.SphereGeometry(1.0, 36, 24), regolithMat));

  // Lunar maria (dark basaltic plains)
  const maria = [
    { lat: 26, lon: -20, r: 0.34 },
    { lat: 18, lon: 25, r: 0.28 },
    { lat: -12, lon: -45, r: 0.24 },
    { lat: 35, lon: 60, r: 0.22 },
  ];
  for (const m of maria) {
    const patch = new THREE.Mesh(new THREE.CylinderGeometry(m.r, m.r * 1.05, 0.02, 18), mariaMat);
    placeOnSphere(patch, 0.996, m.lat, m.lon);
    group.add(patch);
  }

  // Impact craters (raised rim torus + dark floor)
  const craters = [
    { lat: -43, lon: -11, r: 0.14 },  // Tycho-like
    { lat: 10, lon: -20, r: 0.12 },   // Copernicus-like
    { lat: -75, lon: 40, r: 0.18 },   // South Pole-Aitken region
    { lat: 48, lon: -110, r: 0.15 },
    { lat: -20, lon: 120, r: 0.13 },
    { lat: 5, lon: 165, r: 0.11 },
  ];
  for (const c of craters) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(c.r, c.r * 0.18, 8, 20), craterRimMat);
    rim.rotation.x = Math.PI / 2;
    const holder = new THREE.Group();
    holder.add(rim);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(c.r * 0.85, c.r * 0.85, 0.015, 16), mariaMat);
    holder.add(floor);
    placeOnSphere(holder, 0.998, c.lat, c.lon);
    group.add(holder);
  }

  return group;
}

/**
 * 3. MARS
 * Rust-red iron-oxide crust, dark basaltic plains, Olympus Mons shield volcano,
 * polar CO2/water-ice caps, and a thin dusty atmosphere.
 */
export function createMarsModel() {
  const group = new THREE.Group();
  group.name = "planet:mars";

  const crustMat = new THREE.MeshStandardMaterial({
    color: 0xc2410c,
    emissive: 0x271005,
    roughness: 0.86,
    metalness: 0.05,
  });
  const basaltMat = new THREE.MeshStandardMaterial({
    color: 0x7c2d12,
    roughness: 0.9,
    metalness: 0.06,
  });
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.6,
    metalness: 0.04,
  });
  const hazeMat = new THREE.MeshBasicMaterial({
    color: 0xfb923c,
    transparent: true,
    opacity: 0.14,
    side: THREE.BackSide,
  });

  // Rust-red core
  group.add(new THREE.Mesh(new THREE.SphereGeometry(1.0, 36, 24), crustMat));

  // Dark volcanic / canyon regions
  const regions = [
    { lat: 10, lon: 70, rx: 0.32, rz: 0.22 },   // Syrtis Major
    { lat: -14, lon: -60, rx: 0.42, rz: 0.12 }, // Valles Marineris band
    { lat: -35, lon: 150, rx: 0.26, rz: 0.22 },
  ];
  for (const reg of regions) {
    const geo = new THREE.CylinderGeometry(reg.rx, reg.rx * 1.04, 0.025, 16);
    geo.scale(1, 1, reg.rz / reg.rx);
    const mesh = new THREE.Mesh(geo, basaltMat);
    placeOnSphere(mesh, 0.995, reg.lat, reg.lon);
    group.add(mesh);
  }

  // Olympus Mons shield volcano
  const volcano = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.07, 16), basaltMat);
  placeOnSphere(volcano, 1.01, 18, -134);
  group.add(volcano);

  // Polar ice caps
  for (const lat of [85, -85]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.03, 18), iceMat);
    placeOnSphere(cap, 0.992, lat, 0);
    group.add(cap);
  }

  // Thin dusty atmospheric haze
  group.add(new THREE.Mesh(new THREE.SphereGeometry(1.07, 32, 24), hazeMat));

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
