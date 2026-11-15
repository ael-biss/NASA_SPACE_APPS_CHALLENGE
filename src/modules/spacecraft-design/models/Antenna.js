/**
 * @file src/modules/spacecraft-design/models/Antenna.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Builds the low-poly 3D communications antenna (patch array, continuous helical mast,
 *       or faceted parabolic high-gain dish with tripod struts and amber-gold feed cap).
 */

import * as THREE from "three";

class HelixCurve extends THREE.Curve {
  constructor(radius, height, turns) {
    super();
    this.radius = radius;
    this.height = height;
    this.turns = turns;
  }

  getPoint(t) {
    const angle = t * Math.PI * 2 * this.turns;
    return new THREE.Vector3(
      Math.cos(angle) * this.radius,
      t * this.height,
      Math.sin(angle) * this.radius
    );
  }
}

export class Antenna {
  /**
   * Build 3D antenna mesh for the selected antenna component.
   * @param {Object} componentData - Antenna entry from data/components.js
   * @returns {THREE.Group}
   */
  build(componentData) {
    const group = new THREE.Group();
    group.name = `antenna:${componentData.id}`;

    const metalMaterial = new THREE.MeshStandardMaterial({
      color: 0x2b3444,
      metalness: 0.72,
      roughness: 0.34,
      flatShading: true,
    });
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.76,
      roughness: 0.3,
      flatShading: true,
    });
    const dishMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.22,
      roughness: 0.45,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.55,
      roughness: 0.3,
      flatShading: true,
    });

    const { style, radius = 0.5 } = componentData;

    // Stepped octagonal gimbal pedestal & neck collar
    const baseFoot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.14, 0.08, 8),
      metalMaterial
    );
    baseFoot.position.y = 0.04;
    group.add(baseFoot);

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.08, 0.09, 8),
      trimMaterial
    );
    neck.position.y = 0.125;
    group.add(neck);

    if (style === "patch") {
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(radius * 1.45, 0.055, radius * 1.45),
        dishMaterial
      );
      tile.position.y = 0.19;
      group.add(tile);

      const patch = new THREE.Mesh(
        new THREE.BoxGeometry(radius, 0.068, radius),
        goldMaterial
      );
      patch.position.y = 0.2;
      group.add(patch);
      return group;
    }

    if (style === "helical") {
      const groundRim = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, 0.045, 8),
        metalMaterial
      );
      groundRim.position.y = 0.18;
      group.add(groundRim);

      const groundTop = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, 0.052, 8),
        dishMaterial
      );
      groundTop.position.y = 0.185;
      group.add(groundTop);

      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.036, 0.52, 8),
        trimMaterial
      );
      mast.position.y = 0.45;
      group.add(mast);

      const helixCurve = new HelixCurve(0.105, 0.44, 5.2);
      const coil = new THREE.Mesh(
        new THREE.TubeGeometry(helixCurve, 72, 0.014, 6, false),
        goldMaterial
      );
      coil.position.y = 0.22;
      group.add(coil);

      const tipCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.032, 0.045, 8),
        goldMaterial
      );
      tipCap.position.y = 0.71;
      group.add(tipCap);
      return group;
    }

    // Faceted low-poly parabolic dish (dish / deep-dish) with tripod & amber-gold feed tip
    const points = [];
    const depth = radius * 0.36;
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const r = t * radius;
      const y = t * t * depth;
      points.push(new THREE.Vector2(r, y));
    }

    const dishGroup = new THREE.Group();
    dishGroup.position.y = 0.19;
    dishGroup.rotation.set(0.34, 0, -0.14);

    const rearHub = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.22, radius * 0.18, 0.08, 8),
      metalMaterial
    );
    rearHub.position.y = -0.02;
    dishGroup.add(rearHub);

    const dishMesh = new THREE.Mesh(new THREE.LatheGeometry(points, 16), dishMaterial);
    dishGroup.add(dishMesh);

    const rimRing = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.022, 6, 16),
      dishMaterial
    );
    rimRing.rotation.x = Math.PI / 2;
    rimRing.position.y = depth;
    dishGroup.add(rimRing);

    // Central feed stalk + 3 tripod struts converging on amber-gold feed horn cap
    const feedHeight = radius * 0.74;
    const centerStalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.042, feedHeight * 0.48, 8),
      metalMaterial
    );
    centerStalk.position.y = feedHeight * 0.24;
    dishGroup.add(centerStalk);

    const feedCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.04, 0.065, 8),
      goldMaterial
    );
    feedCap.position.y = feedHeight;
    dishGroup.add(feedCap);

    const strutEnd = new THREE.Vector3(0, feedHeight - 0.02, 0);
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3 + 0.3;
      const start = new THREE.Vector3(
        Math.cos(angle) * radius * 0.72,
        depth * 0.52,
        Math.sin(angle) * radius * 0.72
      );
      const strutVec = new THREE.Vector3().subVectors(strutEnd, start);
      const strut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, strutVec.length(), 6),
        metalMaterial
      );
      strut.position.copy(start).addScaledVector(strutVec, 0.5);
      strut.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        strutVec.clone().normalize()
      );
      dishGroup.add(strut);
    }

    group.add(dishGroup);
    return group;
  }
}
