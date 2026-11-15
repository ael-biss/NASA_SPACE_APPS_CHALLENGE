/**
 * @file src/modules/spacecraft-design/models/Structure.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Builds the 3D spacecraft bus/chassis mesh with thermal MLI foil, structural collars,
 *       and computes exact attachment socket coordinates for subsystems.
 */

import * as THREE from "three";

export class Structure {
  constructor() {
    this._attachmentPoints = {
      solarLeft: new THREE.Vector3(-0.6, 0, 0),
      solarRight: new THREE.Vector3(0.6, 0, 0),
      propulsion: new THREE.Vector3(0, -0.65, 0),
      antenna: new THREE.Vector3(0, 0.65, 0),
      batteryFront: new THREE.Vector3(0, -0.1, 0.6),
      batteryBack: new THREE.Vector3(0, -0.1, -0.6),
      busWidth: 1.15,
      busHeight: 1.25,
    };
  }

  /**
   * Build a 3D Group for the selected structure component.
   * @param {Object} componentData - Structure entry from data/components.js
   * @returns {THREE.Group}
   */
  build(componentData) {
    const group = new THREE.Group();
    group.name = `structure:${componentData.id}`;

    const { width, height, depth, shape, color } = componentData;
    const halfW = width / 2;
    const halfH = height / 2;
    const halfD = depth / 2;

    const foilMaterial = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.78,
      roughness: 0.32,
    });
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.35,
    });
    const sensorMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.35,
      metalness: 0.9,
      roughness: 0.15,
    });

    let bodyGeo;
    let radialSides = 4;
    if (shape === "box") {
      bodyGeo = new THREE.BoxGeometry(width, height, depth);
    } else {
      radialSides = shape === "hex" ? 6 : 8;
      bodyGeo = new THREE.CylinderGeometry(halfW, halfW, height, radialSides);
    }

    const bodyMesh = new THREE.Mesh(bodyGeo, foilMaterial);
    group.add(bodyMesh);

    // Top and bottom structural adapter rings
    const collarRadius = shape === "box" ? Math.min(halfW, halfD) * 0.85 : halfW * 1.03;
    const collarGeo =
      shape === "box"
        ? new THREE.BoxGeometry(width * 1.04, 0.08, depth * 1.04)
        : new THREE.CylinderGeometry(collarRadius, collarRadius, 0.08, radialSides);

    const topCollar = new THREE.Mesh(collarGeo, frameMaterial);
    topCollar.position.y = halfH - 0.04;
    group.add(topCollar);

    const bottomCollar = new THREE.Mesh(collarGeo, frameMaterial);
    bottomCollar.position.y = -halfH + 0.04;
    group.add(bottomCollar);

    // Optical payload / star-tracker viewport on front (+Z) face
    const faceOffsetZ = shape === "box" ? halfD : halfW * 0.92;
    const sensorHousing = new THREE.Mesh(
      new THREE.CylinderGeometry(width * 0.14, width * 0.17, 0.12, 16),
      frameMaterial
    );
    sensorHousing.rotation.x = Math.PI / 2;
    sensorHousing.position.set(0, halfH * 0.32, faceOffsetZ + 0.03);
    group.add(sensorHousing);

    const sensorLens = new THREE.Mesh(
      new THREE.CylinderGeometry(width * 0.1, width * 0.1, 0.04, 16),
      sensorMaterial
    );
    sensorLens.rotation.x = Math.PI / 2;
    sensorLens.position.set(0, halfH * 0.32, faceOffsetZ + 0.08);
    group.add(sensorLens);

    // Side solar mount hubs
    const hubOffsetX = shape === "box" ? halfW : halfW * 0.96;
    const hubGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.1, 12);
    const leftHub = new THREE.Mesh(hubGeo, frameMaterial);
    leftHub.rotation.z = Math.PI / 2;
    leftHub.position.set(-hubOffsetX - 0.02, 0, 0);
    group.add(leftHub);

    const rightHub = new THREE.Mesh(hubGeo, frameMaterial);
    rightHub.rotation.z = Math.PI / 2;
    rightHub.position.set(hubOffsetX + 0.02, 0, 0);
    group.add(rightHub);

    this._attachmentPoints = {
      solarLeft: new THREE.Vector3(-hubOffsetX - 0.06, 0, 0),
      solarRight: new THREE.Vector3(hubOffsetX + 0.06, 0, 0),
      propulsion: new THREE.Vector3(0, -halfH, 0),
      antenna: new THREE.Vector3(0, halfH, 0),
      batteryFront: new THREE.Vector3(0, -halfH * 0.25, faceOffsetZ + 0.04),
      batteryBack: new THREE.Vector3(0, -halfH * 0.25, -faceOffsetZ - 0.04),
      payloadSlots: this._buildPayloadSlots(shape, halfW, halfH, halfD),
      busWidth: width,
      busHeight: height,
      busDepth: depth,
    };

    return group;
  }

  /**
   * Compute distributed payload mounting anchors flush against the bus panels,
   * kept within front/back sectors clear of solar wings, star-tracker, and battery.
   * @param {string} shape
   * @param {number} halfW
   * @param {number} halfH
   * @param {number} halfD
   * @returns {Array<{ position: THREE.Vector3, normal: THREE.Vector3 }>}
   */
  _buildPayloadSlots(shape, halfW, halfH, halfD) {
    const upperY = halfH * 0.34;
    const lowerY = -halfH * 0.34;

    if (shape === "box") {
      const zFront = halfD;
      const flankX = halfW * 0.58;
      const specs = [
        { pos: [0, lowerY, zFront], norm: [0, 0, 1] },
        { pos: [flankX, upperY, zFront], norm: [0, 0, 1] },
        { pos: [-flankX, upperY, zFront], norm: [0, 0, 1] },
        { pos: [0, upperY, -zFront], norm: [0, 0, -1] },
        { pos: [flankX, upperY, -zFront], norm: [0, 0, -1] },
        { pos: [-flankX, upperY, -zFront], norm: [0, 0, -1] },
        { pos: [flankX, lowerY, zFront], norm: [0, 0, 1] },
        { pos: [-flankX, lowerY, zFront], norm: [0, 0, 1] },
      ];
      return specs.map(({ pos, norm }) => ({
        position: new THREE.Vector3(...pos),
        normal: new THREE.Vector3(...norm).normalize(),
      }));
    }

    // Align hex (30 deg) and oct (22.5 deg) slots flush on the flat facets using the exact apothem
    const sides = shape === "hex" ? 6 : 8;
    const facetAngle = Math.PI / sides;
    const apothem = halfW * Math.cos(facetAngle);
    const sinA = Math.sin(facetAngle);
    const cosA = Math.cos(facetAngle);

    const specs = [
      { pos: [apothem * sinA, lowerY, apothem * cosA], norm: [sinA, 0, cosA] },
      { pos: [-apothem * sinA, lowerY, apothem * cosA], norm: [-sinA, 0, cosA] },
      { pos: [apothem * sinA, upperY, apothem * cosA], norm: [sinA, 0, cosA] },
      { pos: [-apothem * sinA, upperY, apothem * cosA], norm: [-sinA, 0, cosA] },
      { pos: [apothem * sinA, upperY, -apothem * cosA], norm: [sinA, 0, -cosA] },
      { pos: [-apothem * sinA, upperY, -apothem * cosA], norm: [-sinA, 0, -cosA] },
      { pos: [apothem * sinA, lowerY, -apothem * cosA], norm: [sinA, 0, -cosA] },
      { pos: [-apothem * sinA, lowerY, -apothem * cosA], norm: [-sinA, 0, -cosA] },
    ];

    return specs.map(({ pos, norm }) => ({
      position: new THREE.Vector3(...pos),
      normal: new THREE.Vector3(...norm).normalize(),
    }));
  }

  /**
   * Return mounting anchor positions for subsystems based on the built bus.
   * @returns {{ solarLeft: THREE.Vector3, solarRight: THREE.Vector3, propulsion: THREE.Vector3, antenna: THREE.Vector3, batteryFront: THREE.Vector3, batteryBack: THREE.Vector3, payloadSlots?: Array<{ position: THREE.Vector3, normal: THREE.Vector3 }>, busWidth: number, busHeight: number, busDepth?: number }}
   */
  getAttachmentPoints() {
    return this._attachmentPoints;
  }
}
