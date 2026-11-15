/**
 * @file src/modules/spacecraft-design/models/Propulsion.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Builds the low-poly 3D propulsion tank, faceted thruster bell or ion grid with
 *       warm amber-gold inner chamber lining, and animated exhaust plume.
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
      metalness: 0.78,
      roughness: 0.34,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    const darkCollarMaterial = new THREE.MeshStandardMaterial({
      color: 0x2b3444,
      metalness: 0.72,
      roughness: 0.38,
      flatShading: true,
    });
    const tankMaterial = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.55,
      roughness: 0.32,
      flatShading: true,
    });
    const throatGlowMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.65,
      metalness: 0.3,
      roughness: 0.25,
      side: THREE.DoubleSide,
    });

    const isIon = componentData.style === "ion";
    const isLarge = componentData.style === "biprop";
    const tankRadius = isLarge ? 0.32 : isIon ? 0.24 : 0.2;
    const tankHeight = isLarge ? 0.26 : 0.16;

    // Stepped adapter collar & propellant housing
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(tankRadius, tankRadius * 0.86, tankHeight, 8),
      isLarge ? tankMaterial : darkCollarMaterial
    );
    tank.position.y = -tankHeight / 2;
    group.add(tank);

    let nozzleBottomY = -tankHeight;

    if (isIon) {
      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.27, 0.14, 12),
        metalMaterial
      );
      housing.position.y = -tankHeight - 0.07;
      group.add(housing);

      const ionGrid = new THREE.Mesh(
        new THREE.TorusGeometry(0.16, 0.035, 8, 16),
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
      // Faceted low-poly thruster bell with warm golden-amber inner chamber & stiffener lip
      const bellTop = isLarge ? 0.14 : 0.1;
      const bellBottom = isLarge ? 0.31 : 0.21;
      const bellHeight = isLarge ? 0.42 : 0.28;

      const throatCollar = new THREE.Mesh(
        new THREE.CylinderGeometry(bellTop * 1.35, bellTop * 1.15, 0.06, 10),
        darkCollarMaterial
      );
      throatCollar.position.y = -tankHeight - 0.03;
      group.add(throatCollar);

      const nozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(bellTop, bellBottom, bellHeight, 12, 1, true),
        metalMaterial
      );
      nozzle.position.y = -tankHeight - 0.04 - bellHeight / 2;
      group.add(nozzle);

      const innerLiner = new THREE.Mesh(
        new THREE.CylinderGeometry(bellTop * 0.82, bellBottom * 0.88, bellHeight * 0.86, 12, 1, true),
        throatGlowMaterial
      );
      innerLiner.position.y = -tankHeight - 0.05 - bellHeight / 2;
      group.add(innerLiner);

      const throatGlowDisc = new THREE.Mesh(
        new THREE.CircleGeometry(bellBottom * 0.82, 12),
        throatGlowMaterial
      );
      throatGlowDisc.rotation.x = Math.PI / 2;
      throatGlowDisc.position.y = -tankHeight - 0.12;
      group.add(throatGlowDisc);

      const rimRing = new THREE.Mesh(
        new THREE.TorusGeometry(bellBottom, 0.018, 6, 12),
        darkCollarMaterial
      );
      rimRing.rotation.x = Math.PI / 2;
      rimRing.position.y = -tankHeight - 0.04 - bellHeight;
      group.add(rimRing);

      nozzleBottomY = -tankHeight - 0.04 - bellHeight;
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
