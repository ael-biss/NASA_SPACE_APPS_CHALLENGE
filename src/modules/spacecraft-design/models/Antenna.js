/**
 * @file src/modules/spacecraft-design/models/Antenna.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Builds the 3D communications antenna (patch array, helical mast, or parabolic
 *       high-gain dish with feed horn and tripod struts) mounted on top of the bus.
 */

import * as THREE from "three";

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
      color: 0x64748b,
      metalness: 0.85,
      roughness: 0.3,
    });
    const dishMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.35,
      roughness: 0.35,
      side: THREE.DoubleSide,
    });
    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.82,
      roughness: 0.25,
    });

    const { style, radius = 0.5 } = componentData;

    // Base gimbal pedestal
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 0.14, 12),
      metalMaterial
    );
    pedestal.position.y = 0.07;
    group.add(pedestal);

    if (style === "patch") {
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(radius * 1.4, 0.05, radius * 1.4),
        dishMaterial
      );
      tile.position.y = 0.15;
      group.add(tile);

      const patch = new THREE.Mesh(
        new THREE.BoxGeometry(radius, 0.06, radius),
        goldMaterial
      );
      patch.position.y = 0.16;
      group.add(patch);
      return group;
    }

    if (style === "helical") {
      const groundPlane = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.7, radius * 0.7, 0.04, 18),
        metalMaterial
      );
      groundPlane.position.y = 0.16;
      group.add(groundPlane);

      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.52, 10),
        metalMaterial
      );
      mast.position.y = 0.42;
      group.add(mast);

      // Helical antenna rings
      for (let i = 0; i < 5; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.11, 0.014, 8, 18),
          goldMaterial
        );
        ring.rotation.x = Math.PI / 2 + 0.15;
        ring.position.y = 0.24 + i * 0.095;
        group.add(ring);
      }
      return group;
    }

    // Parabolic high-gain / deep-space dish built with LatheGeometry
    const points = [];
    const depth = radius * 0.34;
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const r = t * radius;
      const y = (t * t) * depth;
      points.push(new THREE.Vector2(r, y));
    }

    const dishGroup = new THREE.Group();
    dishGroup.position.y = 0.22;
    // Tilt dish slightly toward Earth/Sun angle for dynamic silhouette
    dishGroup.rotation.x = 0.25;

    const dishMesh = new THREE.Mesh(new THREE.LatheGeometry(points, 28), dishMaterial);
    dishGroup.add(dishMesh);

    // Feed horn & tripod struts
    const feedHeight = radius * 0.68;
    const feedHorn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.065, 0.14, 12),
      goldMaterial
    );
    feedHorn.position.y = feedHeight;
    dishGroup.add(feedHorn);

    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const start = new THREE.Vector3(
        Math.cos(angle) * radius * 0.78,
        depth * 0.62,
        Math.sin(angle) * radius * 0.78
      );
      const end = new THREE.Vector3(0, feedHeight, 0);
      const strutVec = new THREE.Vector3().subVectors(end, start);
      const strut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, strutVec.length(), 6),
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
