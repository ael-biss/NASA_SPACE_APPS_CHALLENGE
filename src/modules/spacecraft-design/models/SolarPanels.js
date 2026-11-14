/**
 * @file src/modules/spacecraft-design/models/SolarPanels.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Builds symmetric 3D solar array wings attached to the spacecraft structure and
 *       animates stowed (launch fairing) vs. deployed (orbital operation) wing states.
 */

import * as THREE from "three";

export class SolarPanels {
  constructor() {
    this._leftPivot = null;
    this._rightPivot = null;
    this._deployable = true;
    this._currentDeploy = 1; // 1 = deployed, 0 = stowed
    this._targetDeploy = 1;
  }

  /**
   * Build left/right solar array meshes positioned at the bus solar attachment hubs.
   * @param {Object} componentData - Solar panel entry from data/components.js
   * @param {{ solarLeft: THREE.Vector3, solarRight: THREE.Vector3, busHeight?: number }} attachmentPoints
   * @returns {THREE.Group}
   */
  build(componentData, attachmentPoints) {
    const group = new THREE.Group();
    group.name = `solar:${componentData.id}`;
    this._deployable = Boolean(componentData.deployable);

    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.8,
      roughness: 0.35,
    });
    const cellMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.18,
      metalness: 0.65,
      roughness: 0.2,
    });
    const busbarMaterial = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.9,
      roughness: 0.25,
    });

    if (!this._deployable) {
      // Body-mounted compact side wings flush near the hubs
      const panelGeo = new THREE.BoxGeometry(0.05, componentData.span * 0.7, componentData.chord);
      const cellGeo = new THREE.BoxGeometry(0.055, componentData.span * 0.62, componentData.chord * 0.88);

      [-1, 1].forEach((side) => {
        const anchor = side < 0 ? attachmentPoints.solarLeft : attachmentPoints.solarRight;
        const wing = new THREE.Group();
        wing.position.copy(anchor);
        wing.add(new THREE.Mesh(panelGeo, frameMaterial));
        wing.add(new THREE.Mesh(cellGeo, cellMaterial));
        group.add(wing);
      });

      this._leftPivot = null;
      this._rightPivot = null;
      return group;
    }

    const buildWing = (direction) => {
      const pivot = new THREE.Group();
      const { span, chord, segments } = componentData;
      const yokeLength = 0.22;
      const usableSpan = Math.max(span - yokeLength, 0.5);
      const segLength = usableSpan / segments;
      const gap = 0.04;

      // Deployment yoke strut connecting hub to first panel
      const yoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, yokeLength, 8),
        frameMaterial
      );
      yoke.rotation.z = Math.PI / 2;
      yoke.position.x = direction * (yokeLength / 2);
      pivot.add(yoke);

      for (let i = 0; i < segments; i++) {
        const panelWidth = segLength - gap;
        const centerX = direction * (yokeLength + i * segLength + panelWidth / 2);

        const backing = new THREE.Mesh(
          new THREE.BoxGeometry(panelWidth, 0.035, chord),
          frameMaterial
        );
        backing.position.x = centerX;
        pivot.add(backing);

        const cells = new THREE.Mesh(
          new THREE.BoxGeometry(panelWidth * 0.92, 0.042, chord * 0.9),
          cellMaterial
        );
        cells.position.x = centerX;
        pivot.add(cells);

        // Hinge bar between segments
        if (i > 0) {
          const hinge = new THREE.Mesh(
            new THREE.CylinderGeometry(0.018, 0.018, chord * 0.7, 8),
            busbarMaterial
          );
          hinge.rotation.x = Math.PI / 2;
          hinge.position.x = direction * (yokeLength + i * segLength - gap / 2);
          pivot.add(hinge);
        }
      }

      return pivot;
    };

    this._leftPivot = buildWing(-1);
    this._leftPivot.position.copy(attachmentPoints.solarLeft);
    group.add(this._leftPivot);

    this._rightPivot = buildWing(1);
    this._rightPivot.position.copy(attachmentPoints.solarRight);
    group.add(this._rightPivot);

    this._applyRotation();
    return group;
  }

  /**
   * Set target solar wing state: deployed (extended) or stowed (folded for launch fairing).
   * @param {boolean} isDeployed
   */
  setDeployed(isDeployed) {
    this._targetDeploy = isDeployed ? 1 : 0;
  }

  /** @returns {boolean} */
  isDeployed() {
    return this._targetDeploy >= 0.5;
  }

  /** Smoothly animate wing hinges toward target state. */
  update(deltaTime) {
    if (!this._deployable || !this._leftPivot || !this._rightPivot) return;
    const diff = this._targetDeploy - this._currentDeploy;
    if (Math.abs(diff) < 0.001) {
      this._currentDeploy = this._targetDeploy;
    } else {
      this._currentDeploy += diff * Math.min(1, deltaTime * 5);
    }
    this._applyRotation();
  }

  _applyRotation() {
    if (!this._leftPivot || !this._rightPivot) return;
    // When stowed (_currentDeploy = 0), wings fold upward (+Y) along the bus sides
    const stowAngle = (1 - this._currentDeploy) * (Math.PI / 2 - 0.05);
    this._leftPivot.rotation.z = -stowAngle;
    this._rightPivot.rotation.z = stowAngle;
  }
}
