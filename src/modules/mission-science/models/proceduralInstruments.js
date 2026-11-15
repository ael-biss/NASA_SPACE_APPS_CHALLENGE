
import * as THREE from "three";

/**
 * Helpers
 */

function createMaterial(color, metalness = 0.5, roughness = 0.45) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
  });
}

function addMesh(group, geometry, material, position, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(...position);
  mesh.rotation.set(...rotation);

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  group.add(mesh);
  return mesh;
}

/**
 * 1. LASER ALTIMETER (LIDAR)
 *
 * A spacecraft-mounted optical instrument.
 * Uses laser pulses to measure distance and elevation.
 */
export function createLaserAltimeterModel() {
  const group = new THREE.Group();
  group.name = "Laser Altimeter";

  const gold = createMaterial(0xc49a45, 0.75);
  const dark = createMaterial(0x252c35, 0.8);
  const silver = createMaterial(0xb7c1ca, 0.85);
  const glass = new THREE.MeshStandardMaterial({
    color: 0x36a9e1,
    metalness: 0.7,
    roughness: 0.15,
    emissive: 0x075078,
  });

  // Main instrument body
  addMesh(
    group,
    new THREE.BoxGeometry(1.5, 0.8, 1.2),
    gold,
    [0, 0, 0]
  );

  // Optical telescope barrel
  addMesh(
    group,
    new THREE.CylinderGeometry(0.32, 0.4, 0.8, 32),
    dark,
    [0, 0.55, 0.15],
    [Math.PI / 2, 0, 0]
  );

  // Laser aperture
  addMesh(
    group,
    new THREE.CylinderGeometry(0.25, 0.25, 0.06, 32),
    glass,
    [0, 0.55, 0.58],
    [Math.PI / 2, 0, 0]
  );

  // Aperture rim
  addMesh(
    group,
    new THREE.TorusGeometry(0.29, 0.045, 12, 32),
    silver,
    [0, 0.55, 0.62],
    [Math.PI / 2, 0, 0]
  );

  // Mounting plate
  addMesh(
    group,
    new THREE.BoxGeometry(1.8, 0.12, 1.5),
    silver,
    [0, -0.48, 0]
  );

  // Four mounting supports
  for (const x of [-0.65, 0.65]) {
    for (const z of [-0.5, 0.5]) {
      addMesh(
        group,
        new THREE.CylinderGeometry(0.07, 0.07, 0.25, 12),
        dark,
        [x, -0.65, z]
      );
    }
  }

  // Small electronic connectors
  addMesh(
    group,
    new THREE.BoxGeometry(0.3, 0.25, 0.2),
    dark,
    [0.8, 0, 0]
  );

  // Circular umbilical connector port
  addMesh(
    group,
    new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12),
    silver,
    [0.96, 0, 0],
    [0, 0, Math.PI / 2]
  );

  // Corner mounting bolts on optical bench plate
  for (const x of [-0.78, 0.78]) {
    for (const z of [-0.62, 0.62]) {
      addMesh(
        group,
        new THREE.CylinderGeometry(0.04, 0.04, 0.16, 6),
        silver,
        [x, -0.47, z]
      );
    }
  }

  return group;
}


/**
 * 2. PARTICLE DETECTOR
 *
 * A compact scientific detector with an exposed
 * sensing aperture and electronic housing.
 */
export function createParticleDetectorModel() {
  const group = new THREE.Group();
  group.name = "Particle Detector";

  const bodyMaterial = createMaterial(0x687783, 0.75);
  const dark = createMaterial(0x202a33, 0.7);
  const gold = createMaterial(0xc49a45, 0.7);
  const sensorMaterial = createMaterial(0x35a9c9, 0.5, 0.25);

  // Main detector housing
  addMesh(
    group,
    new THREE.BoxGeometry(1.3, 1, 1.1),
    bodyMaterial,
    [0, 0, 0]
  );

  // Front sensing chamber
  addMesh(
    group,
    new THREE.CylinderGeometry(0.38, 0.42, 0.4, 32),
    dark,
    [0, 0, 0.65],
    [Math.PI / 2, 0, 0]
  );

  // Sensor aperture
  addMesh(
    group,
    new THREE.CircleGeometry(0.29, 32),
    sensorMaterial,
    [0, 0, 0.87]
  );

  // Protective aperture ring
  addMesh(
    group,
    new THREE.TorusGeometry(0.35, 0.045, 12, 32),
    gold,
    [0, 0, 0.9]
  );

  // Detector side panels
  for (const side of [-1, 1]) {
    addMesh(
      group,
      new THREE.BoxGeometry(0.12, 0.75, 0.8),
      dark,
      [side * 0.7, 0, 0]
    );

    // Cooling fins
    for (let i = 0; i < 4; i++) {
      addMesh(
        group,
        new THREE.BoxGeometry(0.06, 0.7, 0.04),
        gold,
        [side * 0.79, 0, -0.25 + i * 0.16]
      );
    }
  }

  // Rear electronics connector & mounting flange
  addMesh(
    group,
    new THREE.BoxGeometry(0.35, 0.35, 0.25),
    dark,
    [0, 0, -0.65]
  );

  addMesh(
    group,
    new THREE.CylinderGeometry(0.28, 0.3, 0.08, 16),
    gold,
    [0, 0, -0.57],
    [Math.PI / 2, 0, 0]
  );

  // Inner collimator ring on front aperture
  addMesh(
    group,
    new THREE.TorusGeometry(0.18, 0.02, 8, 24),
    dark,
    [0, 0, 0.88]
  );

  // Top electronics module
  addMesh(
    group,
    new THREE.BoxGeometry(0.65, 0.15, 0.5),
    gold,
    [0, 0.58, 0]
  );

  return group;
}


/**
 * 3. SEISMOMETER
 *
 * A planetary surface-deployed instrument.
 * Designed to sit on the surface and measure vibrations.
 */
export function createSeismometerModel() {
  const group = new THREE.Group();
  group.name = "Seismometer";

  const bodyMaterial = createMaterial(0xc5cbd0, 0.65);
  const dark = createMaterial(0x303940, 0.75);
  const gold = createMaterial(0xc49a45, 0.7);
  const glass = createMaterial(0x263e55, 0.5, 0.2);

  // Main circular base
  addMesh(
    group,
    new THREE.CylinderGeometry(0.85, 0.95, 0.18, 48),
    dark,
    [0, -0.25, 0]
  );

  // Main sensor enclosure
  addMesh(
    group,
    new THREE.CylinderGeometry(0.62, 0.7, 0.65, 40),
    bodyMaterial,
    [0, 0.15, 0]
  );

  // Top dome
  addMesh(
    group,
    new THREE.SphereGeometry(
      0.55,
      32,
      24,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2
    ),
    gold,
    [0, 0.47, 0]
  );

  // Central protective cap
  addMesh(
    group,
    new THREE.CylinderGeometry(0.2, 0.2, 0.12, 32),
    glass,
    [0, 0.95, 0]
  );

  // Three surface contact feet
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;

    const x = Math.cos(angle) * 0.72;
    const z = Math.sin(angle) * 0.72;

    addMesh(
      group,
      new THREE.CylinderGeometry(0.09, 0.12, 0.35, 12),
      dark,
      [x, -0.5, z]
    );

    addMesh(
      group,
      new THREE.CylinderGeometry(0.17, 0.17, 0.08, 16),
      gold,
      [x, -0.7, z]
    );
  }

  // Small cable connector & umbilical collar
  addMesh(
    group,
    new THREE.BoxGeometry(0.25, 0.2, 0.2),
    dark,
    [0.55, 0.1, 0]
  );

  addMesh(
    group,
    new THREE.CylinderGeometry(0.07, 0.07, 0.08, 12),
    gold,
    [0.69, 0.1, 0],
    [0, 0, Math.PI / 2]
  );

  return group;
}
