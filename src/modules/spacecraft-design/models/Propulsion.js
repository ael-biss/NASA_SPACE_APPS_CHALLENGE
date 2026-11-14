/**
 * @file src/modules/spacecraft-design/models/Propulsion.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Builds the 3D propulsion engine/thruster nozzle and optional thruster plume effect
 *       used during orbital insertion burns.
 */

import * as THREE from "three";

export class Propulsion {
  /**
   * Build 3D thruster/engine assembly for the selected propulsion component.
   * @param {Object} componentData - Propulsion entry from data/components.js
   * @returns {THREE.Group}
   */
  build(componentData) {
    // TODO: Create/load nozzle, propellant tank, and plume mesh
    return new THREE.Group();
  }

  /**
   * Toggle engine burn plume visibility for Launch & Orbit simulations.
   * @param {boolean} active
   */
  setThrustActive(active) {
    // TODO: Show/hide or animate exhaust plume mesh
  }
}
