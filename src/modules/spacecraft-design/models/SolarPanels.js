/**
 * @file src/modules/spacecraft-design/models/SolarPanels.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Builds symmetric low-poly 3D solar array wings with white/silver outer frames,
 *       gridded blue photovoltaic cells, and articulated yoke brackets; animates stowed
 *       (launch fairing) vs. deployed (orbital operation) wing states.
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
      color: 0xe2e8f0,
      metalness: 0.3,
      roughness: 0.44,
      flatShading: true,
    });
    const armMaterial = new THREE.MeshStandardMaterial({
      color: 0x2b3444,
      metalness: 0.68,
      roughness: 0.38,
      flatShading: true,
    });
    const cellMaterial = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.24,
      metalness: 0.42,
      roughness: 0.22,
    });
    const gridMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.25,
      roughness: 0.4,
    });
    const hingeMaterial = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.85,
      roughness: 0.25,
    });

    if (!this._deployable) {
      // Body-mounted compact side wings flush near the hubs
      const pHeight = componentData.span * 0.72;
      const pChord = componentData.chord;
      const frameGeo = new THREE.BoxGeometry(0.055, pHeight, pChord);
      const cellGeo = new THREE.BoxGeometry(0.062, pHeight * 0.86, pChord * 0.84);

      [-1, 1].forEach((side) => {
        const anchor = side < 0 ? attachmentPoints.solarLeft : attachmentPoints.solarRight;
        const wing = new THREE.Group();
        wing.position.copy(anchor);
        wing.add(new THREE.Mesh(frameGeo, frameMaterial));
        wing.add(new THREE.Mesh(cellGeo, cellMaterial));
        this._addVerticalGrid(wing, 0.066, pHeight * 0.86, pChord * 0.84, gridMaterial);
        group.add(wing);
      });

      this._leftPivot = null;
      this._rightPivot = null;
      return group;
    }

    const buildWing = (direction) => {
      const pivot = new THREE.Group();
      const tiltGroup = new THREE.Group();
      // Subtle sun-tracking cant toward +Z so gridded blue cells read clearly in 3/4 view
      tiltGroup.rotation.x = 0.24;
      pivot.add(tiltGroup);

      const { span, chord, segments } = componentData;
      const yokeLength = 0.26;
      const usableSpan = Math.max(span - yokeLength, 0.5);
      const segLength = usableSpan / segments;
      const gap = 0.045;

      // Chunky articulated dark-slate yoke boom & C-bracket root clamp
      const boom = new THREE.Mesh(
        new THREE.BoxGeometry(yokeLength * 0.78, 0.065, 0.075),
        armMaterial
      );
      boom.position.x = direction * (yokeLength * 0.39);
      tiltGroup.add(boom);

      const cSpine = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.065, chord * 0.52),
        armMaterial
      );
      cSpine.position.x = direction * (yokeLength - 0.04);
      tiltGroup.add(cSpine);

      for (const zSide of [-1, 1]) {
        const cArm = new THREE.Mesh(
          new THREE.BoxGeometry(0.075, 0.065, 0.055),
          armMaterial
        );
        cArm.position.set(direction * (yokeLength - 0.005), 0, zSide * chord * 0.23);
        tiltGroup.add(cArm);
      }

      for (let i = 0; i < segments; i++) {
        const panelWidth = segLength - gap;
        const centerX = direction * (yokeLength + i * segLength + panelWidth / 2);

        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(panelWidth, 0.045, chord),
          frameMaterial
        );
        frame.position.x = centerX;
        tiltGroup.add(frame);

        const cellW = panelWidth * 0.88;
        const cellD = chord * 0.86;
        const cells = new THREE.Mesh(
          new THREE.BoxGeometry(cellW, 0.052, cellD),
          cellMaterial
        );
        cells.position.x = centerX;
        tiltGroup.add(cells);

        // Crisp 3x3 or 2x3 photovoltaic sub-cell divider grid
        this._addPanelGrid(tiltGroup, centerX, cellW, cellD, 0.056, gridMaterial);

        // Articulated hinge knuckles between segments
        if (i > 0) {
          const hingeX = direction * (yokeLength + i * segLength - gap / 2);
          for (const zFrac of [-0.28, 0.28]) {
            const knuckle = new THREE.Mesh(
              new THREE.BoxGeometry(gap * 1.45, 0.04, 0.06),
              armMaterial
            );
            knuckle.position.set(hingeX, 0, zFrac * chord);
            tiltGroup.add(knuckle);

            const pin = new THREE.Mesh(
              new THREE.CylinderGeometry(0.014, 0.014, 0.08, 6),
              hingeMaterial
            );
            pin.rotation.x = Math.PI / 2;
            pin.position.set(hingeX, 0, zFrac * chord);
            tiltGroup.add(pin);
          }
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

  _addPanelGrid(parent, centerX, cellW, cellD, barHeight, material) {
    const barThick = 0.016;
    // 2 longitudinal ribs -> 3 cell rows along chord
    for (const frac of [-1 / 6, 1 / 6]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(cellW, barHeight, barThick), material);
      bar.position.set(centerX, 0, frac * cellD);
      parent.add(bar);
    }
    // 2 transverse ribs -> 3 cell columns along width (or 1 if very narrow)
    const cols = cellW > 0.72 ? [-1 / 6, 1 / 6] : [0];
    for (const frac of cols) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(barThick, barHeight, cellD), material);
      bar.position.set(centerX + frac * cellW, 0, 0);
      parent.add(bar);
    }
  }

  _addVerticalGrid(parent, barWidth, cellH, cellD, material) {
    const barThick = 0.014;
    for (const frac of [-1 / 6, 1 / 6]) {
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(barWidth, barThick, cellD), material);
      hBar.position.y = frac * cellH;
      parent.add(hBar);
    }
    const vBar = new THREE.Mesh(new THREE.BoxGeometry(barWidth, cellH, barThick), material);
    parent.add(vBar);
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
