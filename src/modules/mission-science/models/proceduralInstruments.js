/**
 * @file src/modules/mission-science/models/proceduralInstruments.js
 * @owner Member 1 (Mission & Science)
 * @goal Unified, spacecraft-matched procedural 3D models for all 10 scientific instruments.
 *       Canonical orientation for every instrument:
 *         - Rear mounting baseplate at minimum Z (-Z) locks onto the bus adapter cradle
 *         - Primary optical lens, aperture, spectrometer slit, or boom points cleanly outward (+Z)
 *         - Aerospace PBR palette matches Structure, Antenna, and SolarPanels modules.
 */

import * as THREE from "three";

function createMaterial(color, metalness = 0.5, roughness = 0.45, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    flatShading: true,
    ...extra,
  });
}

function addMesh(group, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function createSharedPalette() {
  return {
    hullWhite: createMaterial(0xf1f5f9, 0.22, 0.44),
    frameDark: createMaterial(0x2b3444, 0.72, 0.34),
    slateTrim: createMaterial(0x475569, 0.78, 0.3),
    titanium: createMaterial(0xcbd5e1, 0.88, 0.22),
    kaptonGold: createMaterial(0xf59e0b, 0.62, 0.28),
    foilAmber: createMaterial(0xd4af37, 0.78, 0.26),
    opticBlue: createMaterial(0x0b162c, 0.9, 0.12, {
      emissive: 0x0284c7,
      emissiveIntensity: 0.4,
    }),
    opticCyan: createMaterial(0x19bfff, 0.65, 0.16, {
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
    }),
    irGlass: createMaterial(0x7c2d12, 0.82, 0.18, {
      emissive: 0xea580c,
      emissiveIntensity: 0.35,
    }),
  };
}

function addRearMountingFlange(group, width, height, rearZ, mat) {
  addMesh(group, new THREE.BoxGeometry(width, height, 0.08), mat, [0, 0, rearZ]);
}

/**
 * 1. OPTICAL CAMERA
 * Compact high-resolution electro-optical telescope with sunshade hood and blue coated lens (+Z).
 */
export function createOpticalCameraModel() {
  const group = new THREE.Group();
  group.name = "Optical Camera";
  const p = createSharedPalette();

  addRearMountingFlange(group, 0.92, 0.82, -0.44, p.frameDark);
  // Kapton-wrapped sensor electronics housing
  addMesh(group, new THREE.BoxGeometry(0.84, 0.74, 0.56), p.kaptonGold, [0, 0, -0.14]);
  addMesh(group, new THREE.BoxGeometry(0.88, 0.56, 0.44), p.hullWhite, [0, 0, -0.12]);
  // Stepped telescope barrel pointing +Z
  addMesh(
    group,
    new THREE.CylinderGeometry(0.28, 0.32, 0.48, 12),
    p.frameDark,
    [0, 0, 0.34],
    [Math.PI / 2, 0, 0]
  );
  // Flared titanium aperture baffle + deep-blue glass lens facing +Z
  addMesh(
    group,
    new THREE.CylinderGeometry(0.32, 0.27, 0.16, 12),
    p.titanium,
    [0, 0, 0.64],
    [Math.PI / 2, 0, 0]
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.24, 0.24, 0.04, 16),
    p.opticBlue,
    [0, 0, 0.71],
    [Math.PI / 2, 0, 0]
  );
  return group;
}

/**
 * 2. INFRARED SPECTROMETER
 * Cryogenic push-broom spectrometer with gold sun-radiator wings and IR aperture slit (+Z).
 */
export function createInfraredSpectrometerModel() {
  const group = new THREE.Group();
  group.name = "Infrared Spectrometer";
  const p = createSharedPalette();

  addRearMountingFlange(group, 0.98, 0.78, -0.42, p.frameDark);
  addMesh(group, new THREE.BoxGeometry(0.92, 0.7, 0.54), p.hullWhite, [0, 0, -0.12]);
  // Gold radiator louvers on flanks
  for (const sx of [-1, 1]) {
    addMesh(group, new THREE.BoxGeometry(0.1, 0.62, 0.46), p.foilAmber, [sx * 0.5, 0, -0.08]);
  }
  // Forward IR spectrometer hood + glowing amber-cyan aperture facing +Z
  addMesh(group, new THREE.BoxGeometry(0.64, 0.48, 0.36), p.frameDark, [0, 0, 0.31]);
  addMesh(
    group,
    new THREE.CylinderGeometry(0.18, 0.21, 0.14, 12),
    p.titanium,
    [0, 0, 0.54],
    [Math.PI / 2, 0, 0]
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.14, 0.14, 0.04, 16),
    p.irGlass,
    [0, 0, 0.61],
    [Math.PI / 2, 0, 0]
  );
  return group;
}

/**
 * 3. RADAR SOUNDER
 * RF transceiver housing with forward phased feed block and clean lateral dipole whips.
 */
export function createRadarSounderModel() {
  const group = new THREE.Group();
  group.name = "Radar Sounder";
  const p = createSharedPalette();

  addRearMountingFlange(group, 0.9, 0.76, -0.36, p.frameDark);
  addMesh(group, new THREE.BoxGeometry(0.82, 0.68, 0.48), p.kaptonGold, [0, 0, -0.1]);
  addMesh(group, new THREE.BoxGeometry(0.7, 0.52, 0.22), p.hullWhite, [0, 0, 0.22]);
  // Central RF hub & feed cone pointing +Z
  addMesh(
    group,
    new THREE.CylinderGeometry(0.14, 0.22, 0.2, 8),
    p.slateTrim,
    [0, 0, 0.41],
    [Math.PI / 2, 0, 0]
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.06, 0.06, 0.28, 8),
    p.titanium,
    [0, 0, 0.58],
    [Math.PI / 2, 0, 0]
  );
  // Symmetric crossed dipole booms extending laterally outward
  addMesh(
    group,
    new THREE.CylinderGeometry(0.025, 0.025, 1.55, 8),
    p.titanium,
    [0, 0, 0.48],
    [0, 0, Math.PI / 2]
  );
  for (const sx of [-1, 1]) {
    addMesh(group, new THREE.SphereGeometry(0.045, 8, 6), p.foilAmber, [sx * 0.78, 0, 0.48]);
  }
  return group;
}

/**
 * 4. MAGNETOMETER
 * Extended carbon-composite truss boom projecting outward along +Z with tri-axial fluxgate head.
 */
export function createMagnetometerModel() {
  const group = new THREE.Group();
  group.name = "Magnetometer";
  const p = createSharedPalette();

  addRearMountingFlange(group, 0.62, 0.62, -0.68, p.frameDark);
  addMesh(group, new THREE.BoxGeometry(0.52, 0.52, 0.28), p.slateTrim, [0, 0, -0.5]);
  // Deployable telescoping mast projecting outward (+Z) away from bus magnetic field
  addMesh(
    group,
    new THREE.CylinderGeometry(0.08, 0.11, 0.95, 8),
    p.titanium,
    [0, 0, 0.08],
    [Math.PI / 2, 0, 0]
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.05, 0.07, 0.5, 8),
    p.frameDark,
    [0, 0, 0.72],
    [Math.PI / 2, 0, 0]
  );
  // Gold ring-core fluxgate sensor pod at the outer tip (+Z)
  addMesh(group, new THREE.BoxGeometry(0.32, 0.26, 0.26), p.foilAmber, [0, 0, 1.04]);
  addMesh(
    group,
    new THREE.TorusGeometry(0.11, 0.025, 8, 16),
    p.opticCyan,
    [0, 0, 1.18]
  );
  return group;
}

/**
 * 5. MASS SPECTROMETER (MASPEX-Class)
 * Cylindrical stainless time-of-flight chamber with tapered ion inlet horn facing +Z.
 */
export function createMassSpectrometerModel() {
  const group = new THREE.Group();
  group.name = "Mass Spectrometer";
  const p = createSharedPalette();

  addRearMountingFlange(group, 0.86, 0.86, -0.45, p.frameDark);
  addMesh(
    group,
    new THREE.CylinderGeometry(0.36, 0.38, 0.6, 12),
    p.titanium,
    [0, 0, -0.11],
    [Math.PI / 2, 0, 0]
  );
  addMesh(group, new THREE.BoxGeometry(0.76, 0.36, 0.42), p.kaptonGold, [0, -0.06, -0.15]);
  // Tapered ion-collection skimmer cone pointing +Z
  addMesh(
    group,
    new THREE.CylinderGeometry(0.28, 0.14, 0.34, 12),
    p.slateTrim,
    [0, 0, 0.34],
    [Math.PI / 2, 0, 0]
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.11, 0.11, 0.05, 12),
    p.opticCyan,
    [0, 0, 0.52],
    [Math.PI / 2, 0, 0]
  );
  return group;
}

/**
 * 6. LASER ALTIMETER (LIDAR)
 * Rear mounting plate at -Z; transmitter/receiver telescope optics point outward (+Z).
 */
export function createLaserAltimeterModel() {
  const group = new THREE.Group();
  group.name = "Laser Altimeter (LIDAR)";
  const p = createSharedPalette();

  addRearMountingFlange(group, 0.94, 0.84, -0.42, p.frameDark);
  addMesh(group, new THREE.BoxGeometry(0.86, 0.74, 0.52), p.kaptonGold, [0, 0, -0.12]);
  // Twin lidar optics (main receiver barrel + side laser emitter) pointing +Z
  addMesh(
    group,
    new THREE.CylinderGeometry(0.24, 0.28, 0.42, 16),
    p.slateTrim,
    [-0.1, 0.05, 0.33],
    [Math.PI / 2, 0, 0]
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.19, 0.19, 0.04, 16),
    p.opticBlue,
    [-0.1, 0.05, 0.55],
    [Math.PI / 2, 0, 0]
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.1, 0.12, 0.34, 12),
    p.titanium,
    [0.24, -0.06, 0.31],
    [Math.PI / 2, 0, 0]
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.075, 0.075, 0.04, 12),
    p.opticCyan,
    [0.24, -0.06, 0.49],
    [Math.PI / 2, 0, 0]
  );
  return group;
}

/**
 * 7. ULTRAVIOLET SPECTROMETER
 * White anodized enclosure with stepped light baffle cowl and UV grating aperture (+Z).
 */
export function createUvSpectrometerModel() {
  const group = new THREE.Group();
  group.name = "Ultraviolet Spectrometer";
  const p = createSharedPalette();

  addRearMountingFlange(group, 0.88, 0.76, -0.4, p.frameDark);
  addMesh(group, new THREE.BoxGeometry(0.8, 0.68, 0.54), p.hullWhite, [0, 0, -0.1]);
  addMesh(group, new THREE.BoxGeometry(0.56, 0.46, 0.34), p.slateTrim, [0, 0, 0.3]);
  // Slanted sun baffle & glowing UV slit facing +Z
  addMesh(group, new THREE.BoxGeometry(0.42, 0.22, 0.08), p.opticCyan, [0, 0, 0.48]);
  addMesh(group, new THREE.BoxGeometry(0.62, 0.08, 0.22), p.kaptonGold, [0, 0.27, 0.36]);
  return group;
}

/**
 * 8. THERMAL INFRARED IMAGER
 * Compact multi-band bolometer optics with Kapton sun collar and germanium IR lens (+Z).
 */
export function createThermalImagerModel() {
  const group = new THREE.Group();
  group.name = "Thermal Infrared Imager";
  const p = createSharedPalette();

  addRearMountingFlange(group, 0.82, 0.78, -0.38, p.frameDark);
  addMesh(group, new THREE.BoxGeometry(0.76, 0.7, 0.48), p.hullWhite, [0, 0, -0.11]);
  addMesh(
    group,
    new THREE.CylinderGeometry(0.24, 0.29, 0.32, 12),
    p.foilAmber,
    [0, 0, 0.26],
    [Math.PI / 2, 0, 0]
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.18, 0.18, 0.05, 14),
    p.irGlass,
    [0, 0, 0.44],
    [Math.PI / 2, 0, 0]
  );
  return group;
}

/**
 * 9. PARTICLE DETECTOR
 * Electrostatic plasma analyzer with armored cooling fins and wide ion aperture (+Z).
 */
export function createParticleDetectorModel() {
  const group = new THREE.Group();
  group.name = "Particle Detector";
  const p = createSharedPalette();

  addRearMountingFlange(group, 0.9, 0.82, -0.4, p.frameDark);
  addMesh(group, new THREE.BoxGeometry(0.84, 0.72, 0.5), p.slateTrim, [0, 0, -0.12]);
  for (const sx of [-1, 1]) {
    addMesh(group, new THREE.BoxGeometry(0.08, 0.64, 0.44), p.foilAmber, [sx * 0.45, 0, -0.1]);
  }
  addMesh(
    group,
    new THREE.CylinderGeometry(0.28, 0.31, 0.28, 16),
    p.frameDark,
    [0, 0, 0.26],
    [Math.PI / 2, 0, 0]
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.21, 0.21, 0.04, 16),
    p.opticCyan,
    [0, 0, 0.41],
    [Math.PI / 2, 0, 0]
  );
  addMesh(group, new THREE.TorusGeometry(0.25, 0.035, 8, 16), p.foilAmber, [0, 0, 0.42]);
  return group;
}

/**
 * 10. SEISMOMETER
 * Compact wind/thermal-shielded spherical seismic pod mounted with baseplate at -Z and dome outward (+Z).
 */
export function createSeismometerModel() {
  const group = new THREE.Group();
  group.name = "Seismometer";
  const p = createSharedPalette();

  addRearMountingFlange(group, 0.92, 0.92, -0.34, p.frameDark);
  addMesh(
    group,
    new THREE.CylinderGeometry(0.42, 0.45, 0.32, 16),
    p.hullWhite,
    [0, 0, -0.14],
    [Math.PI / 2, 0, 0]
  );
  // Kapton thermal dome facing outward (+Z)
  addMesh(
    group,
    new THREE.SphereGeometry(0.38, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    p.foilAmber,
    [0, 0, 0.02],
    [Math.PI / 2, 0, 0]
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.13, 0.15, 0.08, 12),
    p.opticBlue,
    [0, 0, 0.4],
    [Math.PI / 2, 0, 0]
  );
  return group;
}
