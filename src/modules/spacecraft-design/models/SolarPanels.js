/**
 * @file src/modules/spacecraft-design/models/SolarPanels.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Builds 3D solar array wings attached to the spacecraft structure and supports
 *       stowed vs. deployed animation states for Launch vs. Orbit phases.
 */

import * as THREE from "three";

export class SolarPanels {
  /**
   * Build left/right solar panel meshes for the selected solar array component.
   * @param {Object} componentData - Solar panel entry from data/components.js
   * @returns {THREE.Group}
   */
  build(componentData) {
    // TODO: Create/load solar array 3D meshes
    return new THREE.Group();
  }

  /**
   * Animate or toggle panels between stowed (launch fairing) and deployed (orbit) states.
   * @param {boolean} isDeployed
   */
  setDeployed(isDeployed) {
    // TODO: Rotate/unfold solar panel hinges based on isDeployed
  }
}
