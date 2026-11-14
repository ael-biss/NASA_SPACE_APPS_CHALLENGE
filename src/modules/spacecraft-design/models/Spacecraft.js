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
    this._instrumentBuilder = new InstrumentPayload(options.assetLoader ?? null);
  }

  /**
   * Assemble or rebuild the full 3D spacecraft from a SpacecraftSelection and optional instruments.
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
      this.group.add(this._instrumentBuilder.build(instruments, anchors));
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
    this._instrumentBuilder.dispose();
  }

  _buildBatteryAccent(batteryData) {
    const scale = batteryData.id === "deep-space-cells" ? 1.35 : batteryData.id === "li-ion-dual" ? 1.05 : 0.75;
    const pack = new THREE.Mesh(
      new THREE.BoxGeometry(0.32 * scale, 0.24 * scale, 0.14),
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.65,
        roughness: 0.35,
      })
    );
    pack.name = `battery:${batteryData.id}`;
    return pack;
  }

  _clearChildren() {
    this._instrumentBuilder.cancelPending();

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
