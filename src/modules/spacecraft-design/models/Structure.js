/**
 * @file src/modules/spacecraft-design/models/Structure.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Builds the 3D spacecraft bus/chassis mesh (or loads its GLB) and exposes
 *       attachment socket coordinates where solar panels, propulsion, and antennas mount.
 */

import * as THREE from "three";

export class Structure {
  /**
   * Build a 3D Group for the selected structure component.
   * @param {Object} componentData - Structure entry from data/components.js
   * @returns {THREE.Group}
   */
  build(componentData) {
    // TODO: Create/load structure 3D mesh and record attachment sockets
    return new THREE.Group();
  }

  /**
   * Return mounting anchor positions/rotations for subsystems.
   * @returns {{ solarLeft: THREE.Vector3, solarRight: THREE.Vector3, propulsion: THREE.Vector3, antenna: THREE.Vector3 }}
   */
  getAttachmentPoints() {
    return {
      solarLeft: new THREE.Vector3(-1, 0, 0),
      solarRight: new THREE.Vector3(1, 0, 0),
      propulsion: new THREE.Vector3(0, -1, 0),
      antenna: new THREE.Vector3(0, 1, 0),
    };
  }
}
