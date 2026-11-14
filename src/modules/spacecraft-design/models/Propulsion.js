/**
 * @file src/modules/spacecraft-design/models/Propulsion.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Builds the 3D propulsion tank, engine bell or ion grid, and animated exhaust plume
 *       used in both the Assembly Bay burn test and Launch & Orbit orbital insertion.
 */

import * as THREE from "three";

export class Propulsion {
  constructor() {
    this._plumeGroup = null;
    this._thrustActive = false;
    this._elapsed = 0;
  }

  /**
   * Build 3D thruster/engine assembly for the selected propulsion component.
   * @param {Object} componentData - Propulsion entry from data/components.js
   * @returns {THREE.Group}
   */
  build(componentData) {
    const group = new THREE.Group();
    group.name = `propulsion:${componentData.id}`;

    const metalMaterial = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.88,
      roughness: 0.3,
    });
    const tankMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.7,
      roughness: 0.25,
    });

    const isIon = componentData.style === "ion";
    const isLarge = componentData.style === "biprop";
    const tankRadius = isLarge ? 0.34 : isIon ? 0.24 : 0.2;
    const tankHeight = isLarge ? 0.38 : 0.24;

    // Adapter / propellant tank collar
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(tankRadius, tankRadius * 0.9, tankHeight, 16),
      tankMaterial
    );
    tank.position.y = -tankHeight / 2;
    group.add(tank);

    let nozzleBottomY = -tankHeight;

    if (isIon) {
      // Hall-effect thruster glowing discharge ring
      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.28, 0.14, 24),
        metalMaterial
      );
      housing.position.y = -tankHeight - 0.07;
      group.add(housing);

      const ionGrid = new THREE.Mesh(
        new THREE.TorusGeometry(0.16, 0.035, 10, 24),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.9,
        })
      );
      ionGrid.rotation.x = Math.PI / 2;
      ionGrid.position.y = -tankHeight - 0.14;
      group.add(ionGrid);

      nozzleBottomY = -tankHeight - 0.14;
    } else {
      // Chemical nozzle bell
      const bellTop = isLarge ? 0.14 : 0.09;
      const bellBottom = isLarge ? 0.3 : 0.18;
      const bellHeight = isLarge ? 0.42 : 0.28;

      const nozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(bellTop, bellBottom, bellHeight, 20, 1, false),
        metalMaterial
      );
      nozzle.position.y = -tankHeight - bellHeight / 2;
      group.add(nozzle);

      nozzleBottomY = -tankHeight - bellHeight;
    }

    // Exhaust plume cones (hidden unless thrust is active)
    this._plumeGroup = new THREE.Group();
    this._plumeGroup.position.y = nozzleBottomY;
    this._plumeGroup.visible = this._thrustActive;

    const plumeLength = isLarge ? 1.45 : isIon ? 1.15 : 0.85;
    const plumeRadius = isLarge ? 0.28 : 0.18;
    const plumeColor = componentData.plumeColor ?? 0xf97316;

    const innerPlume = new THREE.Mesh(
      new THREE.ConeGeometry(plumeRadius * 0.55, plumeLength * 0.75, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
      })
    );
    innerPlume.rotation.x = Math.PI;
    innerPlume.position.y = -(plumeLength * 0.75) / 2;
    this._plumeGroup.add(innerPlume);

    const outerPlume = new THREE.Mesh(
      new THREE.ConeGeometry(plumeRadius, plumeLength, 16),
      new THREE.MeshBasicMaterial({
        color: plumeColor,
        transparent: true,
        opacity: 0.48,
      })
    );
    outerPlume.rotation.x = Math.PI;
    outerPlume.position.y = -plumeLength / 2;
    this._plumeGroup.add(outerPlume);

    group.add(this._plumeGroup);
    return group;
  }

  /**
   * Toggle engine burn plume visibility.
   * @param {boolean} active
   */
  setThrustActive(active) {
    this._thrustActive = Boolean(active);
    if (this._plumeGroup) {
      this._plumeGroup.visible = this._thrustActive;
    }
  }

  /** @returns {boolean} */
  isThrustActive() {
    return this._thrustActive;
  }

  /** Subtle flicker animation for the active engine plume. */
  update(deltaTime) {
    if (!this._thrustActive || !this._plumeGroup) return;
    this._elapsed += deltaTime;
    const pulse = 0.92 + Math.sin(this._elapsed * 28) * 0.08;
    this._plumeGroup.scale.set(1, pulse, 1);
  }
}
