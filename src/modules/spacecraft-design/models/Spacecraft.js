/**
 * @file src/modules/spacecraft-design/models/Spacecraft.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Composite 3D spacecraft assembler combining Structure, SolarPanels, Propulsion,
 *       Battery pack accents, and Antenna into one THREE.Group reusable across phases.
 */

import * as THREE from "three";
import { getComponentById } from "../data/components.js";
import { Structure } from "./Structure.js";
import { SolarPanels } from "./SolarPanels.js";
import { Propulsion } from "./Propulsion.js";
import { Antenna } from "./Antenna.js";
import { InstrumentPayload } from "./InstrumentPayload.js";

export class Spacecraft {
  /** @param {{ assetLoader?: import('../../../shared/utils/AssetLoader.js').AssetLoader | null }} [options] */
  constructor(options = {}) {
    this.group = new THREE.Group();
    this.group.name = "assembled-spacecraft";
    this._structureBuilder = new Structure();
    this._solarBuilder = new SolarPanels();
    this._propulsionBuilder = new Propulsion();
    this._antennaBuilder = new Antenna();
    this._assetLoader = options.assetLoader ?? null;
    this._instrumentBuilder = new InstrumentPayload(this._assetLoader);
  }

  /**
   * Assemble or rebuild the full 3D spacecraft from a SpacecraftSelection and payload instruments.
   * @param {import('../../../shared/interfaces/SpacecraftSpec.js').SpacecraftSelection} selection
   * @param {Array<Object>} [instruments=[]]
   * @returns {THREE.Group}
   */
  assemble(selection, instruments = []) {
    this._clearChildren();

    const structureData = getComponentById("structures", selection.structureId);
    const solarData = getComponentById("solarPanels", selection.solarPanelId);
    const batteryData = getComponentById("batteries", selection.batteryId);
    const propulsionData = getComponentById("propulsion", selection.propulsionId);
    const antennaData = getComponentById("antennas", selection.antennaId);

    if (structureData) {
      this.group.add(this._structureBuilder.build(structureData));
    }

    const anchors = this._structureBuilder.getAttachmentPoints();

    if (solarData) {
      this.group.add(this._solarBuilder.build(solarData, anchors));
    }

    if (propulsionData) {
      const propGroup = this._propulsionBuilder.build(propulsionData);
      propGroup.position.copy(anchors.propulsion);
      this.group.add(propGroup);
    }

    if (antennaData) {
      const antGroup = this._antennaBuilder.build(antennaData);
      antGroup.position.copy(anchors.antenna);
      this.group.add(antGroup);
    }

    if (batteryData) {
      const batteryPack = this._buildBatteryAccent(batteryData);
      batteryPack.position.copy(anchors.batteryBack);
      this.group.add(batteryPack);
    }

    if (Array.isArray(instruments) && instruments.length > 0) {
      const payloadGroup = this._instrumentBuilder.build(instruments, anchors);
      if (payloadGroup) {
        this.group.add(payloadGroup);
      }
    }

    const extraGroup = this._buildEngineeringUpgrades(selection, anchors);
    if (extraGroup) {
      this.group.add(extraGroup);
    }

    return this.group;
  }

  /** @param {boolean} deployed */
  setSolarDeployed(deployed) {
    this._solarBuilder.setDeployed(deployed);
  }

  /** @param {boolean} active */
  setThrustActive(active) {
    this._propulsionBuilder.setThrustActive(active);
  }

  /** Advance solar wing hinge & thruster plume animations. */
  update(deltaTime) {
    this._solarBuilder.update(deltaTime);
    this._propulsionBuilder.update(deltaTime);
  }

  /** @returns {THREE.Group} */
  getGroup() {
    return this.group;
  }

  /** Dispose geometries and materials when removing spacecraft from scene. */
  dispose() {
    this._clearChildren();
    this._instrumentBuilder?.dispose();
  }

  _buildBatteryAccent(batteryData) {
    const scale = batteryData.id === "deep-space-cells" ? 1.35 : batteryData.id === "li-ion-dual" ? 1.05 : 0.75;
    const pack = new THREE.Group();
    pack.name = `battery:${batteryData.id}`;

    const cradle = new THREE.Mesh(
      new THREE.BoxGeometry(0.36 * scale, 0.28 * scale, 0.12),
      new THREE.MeshStandardMaterial({
        color: 0x2b3444,
        metalness: 0.7,
        roughness: 0.36,
        flatShading: true,
      })
    );
    pack.add(cradle);

    const cells = new THREE.Mesh(
      new THREE.BoxGeometry(0.28 * scale, 0.21 * scale, 0.14),
      new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        metalness: 0.38,
        roughness: 0.42,
        flatShading: true,
      })
    );
    cells.position.z = -0.02;
    pack.add(cells);

    const busbar = new THREE.Mesh(
      new THREE.BoxGeometry(0.3 * scale, 0.045 * scale, 0.15),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.45,
        roughness: 0.32,
        flatShading: true,
      })
    );
    busbar.position.z = -0.025;
    pack.add(busbar);

    return pack;
  }

  _buildEngineeringUpgrades(selection, anchors) {
    const thermalId = selection.thermalId || "baseline-mli";
    const shieldingId = selection.shieldingId || "none-shield";
    const wheelId = selection.reactionWheelId || "baseline-rcs";

    const hasThermal = thermalId !== "baseline-mli";
    const hasShield = shieldingId !== "none-shield";
    const hasWheel = wheelId !== "baseline-rcs";
    if (!hasThermal && !hasShield && !hasWheel) return null;

    const extras = new THREE.Group();
    extras.name = "engineering-upgrades";
    const halfW = (anchors.busWidth ?? 1.15) / 2;
    const halfH = (anchors.busHeight ?? 1.25) / 2;

    if (hasThermal) {
      const thermalGroup = new THREE.Group();
      thermalGroup.name = `thermal:${thermalId}`;

      if (thermalId === "active-radiators") {
        // Deployable white louvered heat-rejection radiator wings + heat-pipe manifolds
        const radiatorMat = new THREE.MeshStandardMaterial({
          color: 0xf8fafc,
          metalness: 0.42,
          roughness: 0.24,
        });
        const pipeMat = new THREE.MeshStandardMaterial({
          color: 0x334155,
          metalness: 0.78,
          roughness: 0.3,
        });
        const wingGeo = new THREE.BoxGeometry(0.045, halfH * 1.18, 0.58);
        const manifoldGeo = new THREE.CylinderGeometry(0.025, 0.025, halfH * 1.22, 8);
        [-1, 1].forEach((side) => {
          const fin = new THREE.Mesh(wingGeo, radiatorMat);
          fin.position.set(side * (halfW * 0.88), 0.05, -halfW * 0.72);
          fin.rotation.y = side * 0.42;
          thermalGroup.add(fin);

          const pipe = new THREE.Mesh(manifoldGeo, pipeMat);
          pipe.position.set(side * (halfW * 0.85), 0.05, -halfW * 0.5);
          thermalGroup.add(pipe);
        });
      } else {
        // Quilted gold Kapton MLI blanket collar + survival heater box
        const kaptonMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          metalness: 0.65,
          roughness: 0.28,
          flatShading: true,
        });
        const collar = new THREE.Mesh(
          new THREE.BoxGeometry(halfW * 2.04, halfH * 0.32, halfW * 1.98),
          kaptonMat
        );
        collar.position.set(0, -halfH * 0.52, 0);
        thermalGroup.add(collar);

        const heaterMat = new THREE.MeshStandardMaterial({
          color: 0x19bfff,
          emissive: 0x0284c7,
          emissiveIntensity: 0.4,
          metalness: 0.5,
          roughness: 0.3,
        });
        [-1, 1].forEach((side) => {
          const fin = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, halfH * 0.6, 0.24),
            kaptonMat
          );
          fin.position.set(side * (halfW * 0.82), -halfH * 0.1, -halfW * 0.65);
          fin.rotation.y = side * 0.35;
          thermalGroup.add(fin);

          const pod = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.12), heaterMat);
          pod.position.set(side * (halfW * 0.92), -halfH * 0.52, halfW * 0.4);
          thermalGroup.add(pod);
        });
      }

      extras.add(thermalGroup);
    }

    if (hasShield) {
      const shieldGroup = new THREE.Group();
      shieldGroup.name = `shielding:${shieldingId}`;
      const isTantalum = shieldingId === "tantalum-poly-shield";
      const shieldMat = new THREE.MeshStandardMaterial({
        color: isTantalum ? 0x475569 : 0x94a3b8,
        metalness: 0.88,
        roughness: 0.26,
      });
      const trimMat = new THREE.MeshStandardMaterial({
        color: isTantalum ? 0x38bdf8 : 0x64748b,
        metalness: 0.65,
        roughness: 0.3,
      });

      const plateThickness = isTantalum ? 0.09 : 0.055;
      [-1, 1].forEach((zSign) => {
        const plate = new THREE.Mesh(
          new THREE.BoxGeometry(halfW * 1.18, halfH * 0.62, plateThickness),
          shieldMat
        );
        plate.position.set(0, -halfH * 0.12, zSign * (halfW * 0.98));
        shieldGroup.add(plate);
      });

      if (isTantalum) {
        // Polyethylene outer neutron-moderation wrap skirt around the avionics waist
        const wrap = new THREE.Mesh(
          new THREE.BoxGeometry(halfW * 1.98, halfH * 0.22, halfW * 2.04),
          trimMat
        );
        wrap.position.set(0, -halfH * 0.12, 0);
        shieldGroup.add(wrap);
      }

      extras.add(shieldGroup);
    }

    if (hasWheel) {
      const attitudeGroup = new THREE.Group();
      attitudeGroup.name = `attitude:${wheelId}`;
      const wheelMat = new THREE.MeshStandardMaterial({
        color: wheelId === "cmg-star-tracker" ? 0x38bdf8 : 0x475569,
        metalness: 0.85,
        roughness: 0.2,
      });
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 0.12, 16),
        wheelMat
      );
      wheel.position.set(0, halfH * 0.65, -halfW * 0.72);
      attitudeGroup.add(wheel);

      if (wheelId === "cmg-star-tracker") {
        // Dual optical star-tracker baffles angled upward
        [-0.24, 0.24].forEach((xOff) => {
          const baffle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.055, 0.04, 0.14, 8),
            wheelMat
          );
          baffle.position.set(xOff, halfH * 0.72, -halfW * 0.74);
          baffle.rotation.x = -0.45;
          attitudeGroup.add(baffle);
        });
      }

      extras.add(attitudeGroup);
    }

    return extras;
  }

  _clearChildren() {
    this._instrumentBuilder?.cancelPending();
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      child.traverse((obj) => {
        if (obj.userData?.sharedAsset) return;
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((mat) => mat.dispose());
        }
      });
    }
  }
}
