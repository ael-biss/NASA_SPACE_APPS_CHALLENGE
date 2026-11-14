/**
 * @file src/modules/spacecraft-design/models/Antenna.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Builds the 3D communications antenna (patch, parabolic high-gain dish, etc.)
 *       mounted to the spacecraft bus.
 */

import * as THREE from "three";

export class Antenna {
  /**
   * Build 3D antenna mesh for the selected antenna component.
   * @param {Object} componentData - Antenna entry from data/components.js
   * @returns {THREE.Group}
   */
  build(componentData) {
    // TODO: Create/load dish or patch antenna 3D geometry
    return new THREE.Group();
  }
}
