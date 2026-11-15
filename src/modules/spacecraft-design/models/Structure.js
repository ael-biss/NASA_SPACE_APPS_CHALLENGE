/**
 * @file src/modules/spacecraft-design/models/Structure.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Builds a low-poly modular 3D spacecraft bus with satin hull panels, dark structural
 *       frames, amber-gold corner brackets, front optical camera module, solar gimbal hubs,
 *       and exact attachment socket coordinates for subsystems.
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

    const materials = this._createMaterials(color);
    const collarH = 0.08;
    const coreH = Math.max(0.3, height - collarH * 2);
    const halfCoreH = coreH / 2;

    const isBox = shape === "box";
    const radialSides = isBox ? 4 : shape === "hex" ? 6 : 8;
    const rotY = isBox ? 0 : Math.PI / radialSides;
    const apothem = isBox ? halfD : halfW * Math.cos(Math.PI / radialSides);

    // Core dark structural chassis & outer light-grey hull shell (no overlapping cap faces)
    const coreGeo = isBox
      ? new THREE.BoxGeometry(width * 0.94, coreH, depth * 0.94)
      : new THREE.CylinderGeometry(halfW * 0.94, halfW * 0.94, coreH, radialSides);
    const coreMesh = new THREE.Mesh(coreGeo, materials.frame);
    coreMesh.rotation.y = rotY;
    group.add(coreMesh);

    const hullGeo = isBox
      ? new THREE.BoxGeometry(width, coreH * 0.9, depth)
      : new THREE.CylinderGeometry(halfW, halfW, coreH * 0.9, radialSides);
    const hullMesh = new THREE.Mesh(hullGeo, materials.hull);
    hullMesh.rotation.y = rotY;
    group.add(hullMesh);

    // Top & bottom stepped structural adapter collars cleanly stacked outside coreH
    const collarR = isBox ? Math.min(halfW, halfD) * 0.92 : halfW * 0.98;
    const collarGeo = isBox
      ? new THREE.BoxGeometry(width * 1.02, collarH, depth * 1.02)
      : new THREE.CylinderGeometry(collarR, collarR, collarH, radialSides);

    const topCollar = new THREE.Mesh(collarGeo, materials.frame);
    topCollar.rotation.y = rotY;
    topCollar.position.y = halfCoreH + collarH / 2;
    group.add(topCollar);

    const bottomCollar = new THREE.Mesh(collarGeo, materials.frame);
    bottomCollar.rotation.y = rotY;
    bottomCollar.position.y = -halfCoreH - collarH / 2;
    group.add(bottomCollar);

    // Stepped top antenna turret ring & bottom propulsion adapter flange
    const turretR = Math.min(halfW, halfD) * 0.42;
    const topTurret = new THREE.Mesh(
      new THREE.CylinderGeometry(turretR * 0.85, turretR, 0.06, 8),
      materials.trim
    );
    topTurret.position.y = halfH + 0.03;
    group.add(topTurret);

    const bottomFlange = new THREE.Mesh(
      new THREE.CylinderGeometry(turretR * 1.05, turretR * 0.9, 0.06, 8),
      materials.trim
    );
    bottomFlange.position.y = -halfH - 0.03;
    group.add(bottomFlange);

    // Raised modular face plates & amber-gold corner brackets
    this._addFacePanels(group, shape, halfW, halfCoreH, halfD, apothem, materials);
    this._addCornerBrackets(group, shape, halfW, halfCoreH, halfD, radialSides, rotY, materials);

    // Front (+Z) square camera housing & optical lens module
    const faceOffsetZ = isBox ? halfD : apothem;
    this._addCameraModule(group, width, coreH, faceOffsetZ, materials);

    // Side (+/-X) articulated solar drive hubs & C-yoke mounts
    const sideOffsetX = isBox ? halfW : shape === "hex" ? halfW : apothem;
    const hubOuterX = this._addSolarHubs(group, sideOffsetX, materials);

    this._attachmentPoints = {
      solarLeft: new THREE.Vector3(-hubOuterX, 0, 0),
      solarRight: new THREE.Vector3(hubOuterX, 0, 0),
      propulsion: new THREE.Vector3(0, -halfH - 0.05, 0),
      antenna: new THREE.Vector3(0, halfH + 0.05, 0),
      batteryFront: new THREE.Vector3(0, -halfH * 0.25, faceOffsetZ + 0.04),
      batteryBack: new THREE.Vector3(0, -halfH * 0.25, -faceOffsetZ - 0.03),
      payloadSlots: this._buildPayloadSlots(shape, halfW, halfH, halfD),
      busWidth: width,
      busHeight: height,
      busDepth: depth,
    };

    return group;
  }

  _createMaterials(hullColor) {
    return {
      hull: new THREE.MeshStandardMaterial({
        color: hullColor ?? 0xe5e9f0,
        metalness: 0.24,
        roughness: 0.5,
        flatShading: true,
      }),
      panel: new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        metalness: 0.18,
        roughness: 0.55,
        flatShading: true,
      }),
      frame: new THREE.MeshStandardMaterial({
        color: 0x2b3444,
        metalness: 0.65,
        roughness: 0.4,
        flatShading: true,
      }),
      trim: new THREE.MeshStandardMaterial({
        color: 0x475569,
        metalness: 0.72,
        roughness: 0.34,
        flatShading: true,
      }),
      bracket: new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.35,
        roughness: 0.36,
        flatShading: true,
      }),
      sensorGlass: new THREE.MeshStandardMaterial({
        color: 0x0b162c,
        emissive: 0x0284c7,
        emissiveIntensity: 0.28,
        metalness: 0.9,
        roughness: 0.12,
      }),
    };
  }

  _addFacePanels(group, shape, halfW, halfCoreH, halfD, apothem, materials) {
    const panelH = halfCoreH * 1.48;
    const ribH = halfCoreH * 0.12;
    const panelThick = 0.035;

    if (shape === "box" || shape === "oct") {
      const span = shape === "box" ? halfW * 1.38 : apothem * 0.72;
      const zDist = shape === "box" ? halfD : apothem;
      const xDist = shape === "box" ? halfW : apothem;

      // Front & back armor panels + horizontal recessed trim bar
      for (const dir of [-1, 1]) {
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(span, panelH, panelThick),
          materials.panel
        );
        panel.position.set(0, 0, dir * (zDist + panelThick * 0.35));
        group.add(panel);

        const trimBar = new THREE.Mesh(
          new THREE.BoxGeometry(span * 0.92, ribH, panelThick * 0.6),
          materials.trim
        );
        trimBar.position.set(0, -halfCoreH * 0.56, dir * (zDist + panelThick * 0.65));
        group.add(trimBar);
      }

      // Left & right side armor panels
      const sideSpan = shape === "box" ? halfD * 1.38 : apothem * 0.72;
      for (const dir of [-1, 1]) {
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(panelThick, panelH, sideSpan),
          materials.panel
        );
        panel.position.set(dir * (xDist + panelThick * 0.35), 0, 0);
        group.add(panel);
      }
      return;
    }

    // Hexagonal bus: raised modular plates on all 6 flat faces (front +Z, back -Z, and 4 angled sides)
    const hexFaceWidth = halfW * 0.82;
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const nx = Math.sin(angle);
      const nz = Math.cos(angle);
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(hexFaceWidth, panelH, panelThick),
        materials.panel
      );
      plate.position.set(nx * (apothem + panelThick * 0.25), 0, nz * (apothem + panelThick * 0.25));
      plate.rotation.y = angle;
      group.add(plate);
    }
  }

  _addCornerBrackets(group, shape, halfW, halfCoreH, halfD, radialSides, rotY, materials) {
    const bracketSize = Math.min(halfW, halfD) * 0.24;
    const bracketH = Math.max(0.11, halfCoreH * 0.26);
    const yOffset = halfCoreH - bracketH * 0.38;

    const addLug = (x, y, z, angleY) => {
      const lugGroup = new THREE.Group();
      lugGroup.position.set(x, y, z);
      lugGroup.rotation.y = angleY;

      const block = new THREE.Mesh(
        new THREE.BoxGeometry(bracketSize, bracketH, bracketSize * 0.88),
        materials.bracket
      );
      lugGroup.add(block);

      const bolt = new THREE.Mesh(
        new THREE.BoxGeometry(bracketSize * 0.34, bracketH * 0.38, bracketSize * 0.96),
        materials.frame
      );
      lugGroup.add(bolt);

      group.add(lugGroup);
    };

    if (shape === "box") {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const angleY = Math.atan2(sx, sz);
          for (const sy of [-1, 1]) {
            addLug(sx * (halfW - bracketSize * 0.15), sy * yOffset, sz * (halfD - bracketSize * 0.15), angleY);
          }
        }
      }
      return;
    }

    if (shape === "oct") {
      // 4 chamfered corner facets at 45, 135, 225, 315 deg
      const cornerRadius = halfW * Math.cos(Math.PI / 8) * 1.02;
      for (let i = 0; i < 4; i++) {
        const angle = Math.PI / 4 + (i * Math.PI) / 2;
        const cx = Math.sin(angle) * cornerRadius;
        const cz = Math.cos(angle) * cornerRadius;
        for (const sy of [-1, 1]) {
          addLug(cx, sy * yOffset, cz, angle);
        }
      }
      return;
    }

    // Hexagonal corners at the 6 prism vertices (rotated by rotY = PI/6)
    const vertexRadius = halfW * 0.95;
    for (let i = 0; i < radialSides; i++) {
      const angle = rotY + (i * Math.PI * 2) / radialSides;
      const vx = Math.sin(angle) * vertexRadius;
      const vz = Math.cos(angle) * vertexRadius;
      for (const sy of [-1, 1]) {
        addLug(vx, sy * yOffset, vz, angle);
      }
    }
  }

  _addCameraModule(group, width, coreH, faceOffsetZ, materials) {
    const camGroup = new THREE.Group();
    const camScale = Math.min(width, coreH);
    const boxSize = camScale * 0.34;
    camGroup.position.set(0, coreH * 0.04, faceOffsetZ + 0.02);

    // Recessed mounting plate + square camera housing
    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(boxSize * 1.24, boxSize * 1.24, 0.03),
      materials.trim
    );
    backing.position.z = 0.01;
    camGroup.add(backing);

    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(boxSize, boxSize, 0.1),
      materials.frame
    );
    housing.position.z = 0.06;
    camGroup.add(housing);

    // Stepped circular lens barrel & reflective optical glass
    const bezel = new THREE.Mesh(
      new THREE.CylinderGeometry(boxSize * 0.34, boxSize * 0.38, 0.05, 12),
      materials.trim
    );
    bezel.rotation.x = Math.PI / 2;
    bezel.position.z = 0.12;
    camGroup.add(bezel);

    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(boxSize * 0.25, boxSize * 0.25, 0.03, 12),
      materials.sensorGlass
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.14;
    camGroup.add(lens);

    group.add(camGroup);
  }

  _addSolarHubs(group, sideOffsetX, materials) {
    const hubRadius = 0.09;
    const hubLen = 0.1;

    for (const side of [-1, 1]) {
      const hubGroup = new THREE.Group();
      hubGroup.position.set(side * sideOffsetX, 0, 0);

      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(hubRadius * 1.2, hubRadius * 1.25, 0.05, 8),
        materials.trim
      );
      collar.rotation.z = Math.PI / 2;
      collar.position.x = side * 0.02;
      hubGroup.add(collar);

      const axle = new THREE.Mesh(
        new THREE.CylinderGeometry(hubRadius * 0.72, hubRadius * 0.72, hubLen, 8),
        materials.frame
      );
      axle.rotation.z = Math.PI / 2;
      axle.position.x = side * (0.02 + hubLen * 0.5);
      hubGroup.add(axle);

      group.add(hubGroup);
    }

    return sideOffsetX + 0.02 + hubLen;
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
    const upperY = halfH * 0.36;
    const lowerY = -halfH * 0.34;
    const armorThick = 0.032;

    if (shape === "box") {
      const zFront = halfD + armorThick;
      const flankX = halfW * 0.44;
      const specs = [
        { pos: [flankX, upperY, zFront], norm: [0, 0, 1] },
        { pos: [-flankX, upperY, zFront], norm: [0, 0, 1] },
        { pos: [flankX, lowerY, zFront], norm: [0, 0, 1] },
        { pos: [-flankX, lowerY, zFront], norm: [0, 0, 1] },
        { pos: [flankX, upperY, -zFront], norm: [0, 0, -1] },
        { pos: [-flankX, upperY, -zFront], norm: [0, 0, -1] },
        { pos: [flankX, lowerY, -zFront], norm: [0, 0, -1] },
        { pos: [-flankX, lowerY, -zFront], norm: [0, 0, -1] },
      ];
      return specs.map(({ pos, norm }) => ({
        position: new THREE.Vector3(...pos),
        normal: new THREE.Vector3(...norm).normalize(),
      }));
    }

    // Align hex (30 deg) and oct (22.5 deg) slots flush outside the outer hull armor along radial normals
    const sides = shape === "hex" ? 6 : 8;
    const facetAngle = Math.PI / sides;
    const faceR = halfW * Math.cos(facetAngle) + armorThick;
    const sinA = Math.sin(facetAngle);
    const cosA = Math.cos(facetAngle);

    const specs = [
      { pos: [faceR * sinA, upperY, faceR * cosA], norm: [sinA, 0, cosA] },
      { pos: [-faceR * sinA, upperY, faceR * cosA], norm: [-sinA, 0, cosA] },
      { pos: [faceR * sinA, lowerY, faceR * cosA], norm: [sinA, 0, cosA] },
      { pos: [-faceR * sinA, lowerY, faceR * cosA], norm: [-sinA, 0, cosA] },
      { pos: [faceR * sinA, upperY, -faceR * cosA], norm: [sinA, 0, -cosA] },
      { pos: [-faceR * sinA, upperY, -faceR * cosA], norm: [-sinA, 0, -cosA] },
      { pos: [faceR * sinA, lowerY, -faceR * cosA], norm: [sinA, 0, -cosA] },
      { pos: [-faceR * sinA, lowerY, -faceR * cosA], norm: [-sinA, 0, -cosA] },
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
