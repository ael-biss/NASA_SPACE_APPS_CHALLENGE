/**
 * @file src/modules/spacecraft-design/models/Spacecraft.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Composite 3D spacecraft assembler combining Structure, SolarPanels, Propulsion,
 *       and Antenna into a single THREE.Group reusable in both Design and Launch/Orbit scenes.
 */

import * as THREE from "three";

export class Spacecraft {
  constructor() {
    this.group = new THREE.Group();
  }

  /**
   * Assemble or rebuild the full 3D spacecraft from a SpacecraftSelection object.
   * @param {import('../../../shared/interfaces/SpacecraftSpec.js').SpacecraftSelection} selection
   * @returns {THREE.Group}
   */
  assemble(selection) {
    // TODO: Clear existing children, instantiate subsystem models, snap to Structure attachment points
    return this.group;
  }

  /** @returns {THREE.Group} */
  getGroup() {
    return this.group;
  }

  /** Dispose geometries and materials when removing spacecraft from scene. */
  dispose() {
    // TODO: Traverse this.group and dispose geometries/materials cleanly
  }
}
