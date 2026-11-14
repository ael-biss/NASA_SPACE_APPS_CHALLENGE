/**
 * @file src/modules/spacecraft-design/models/InstrumentPayload.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Loads (.glb via AssetLoader) and builds (procedural) scientific payload instruments,
 *       normalizes their scale/origin, and mounts them onto the spacecraft bus payload slots.
 */

import * as THREE from "three";
import { AssetLoader } from "../../../shared/utils/AssetLoader.js";
import { getInstrumentById } from "../../mission-science/data/instruments.js";
import {
  createLaserAltimeterModel,
  createParticleDetectorModel,
  createSeismometerModel,
} from "../../mission-science/models/proceduralInstruments.js";

const PROCEDURAL_BUILDERS = {
  "procedural:laser-altimeter": createLaserAltimeterModel,
  "procedural:particle-detector": createParticleDetectorModel,
  "procedural:seismometer": createSeismometerModel,
};

const FORWARD_Z = new THREE.Vector3(0, 0, 1);

export class InstrumentPayload {
  /** @param {AssetLoader | null} [assetLoader] */
  constructor(assetLoader = null) {
    this._assetLoader = assetLoader;
    this._ownsLoader = false;
    this._buildVersion = 0;
  }

  /**
   * Build a THREE.Group holding all mission payload instruments attached to bus slots.
   * Procedural instruments attach synchronously; .glb instruments attach as they resolve
   * unless a newer build or clear invalidates the current version token.
   *
   * @param {Array<Object>} instruments
   * @param {Object} attachmentPoints
   * @returns {THREE.Group}
   */
  build(instruments = [], attachmentPoints = {}) {
    const version = ++this._buildVersion;
    const group = new THREE.Group();
    group.name = "payload-instruments";

    if (!Array.isArray(instruments) || instruments.length === 0) {
      return group;
    }

    const slots = attachmentPoints.payloadSlots?.length
      ? attachmentPoints.payloadSlots
      : [{ position: new THREE.Vector3(0, -0.25, 0.55), normal: FORWARD_Z.clone() }];

    const busMinDim = Math.min(
      attachmentPoints.busWidth || 1.15,
      attachmentPoints.busHeight || 1.25,
      attachmentPoints.busDepth || attachmentPoints.busWidth || 1.15
    );
    const targetSize = Math.min(0.4, Math.max(0.16, busMinDim * 0.25));
    const standoff = Math.max(0.1, busMinDim * 0.12);

    const bracketMaterial = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.85,
      roughness: 0.35,
    });
    const padMaterial = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.8,
      roughness: 0.3,
    });

    instruments.forEach((instrument, index) => {
      if (!instrument) return;

      const modelSpec = instrument.model ?? getInstrumentById(instrument.id)?.model;
      if (!modelSpec) return;

      const slot = this._resolveSlot(slots, index, targetSize);

      const proceduralBuilder = PROCEDURAL_BUILDERS[modelSpec];
      if (proceduralBuilder) {
        const raw = proceduralBuilder();
        const mounted = this._normalizeAndMount(
          raw,
          instrument,
          slot,
          targetSize,
          standoff,
          bracketMaterial,
          padMaterial
        );
        if (mounted) group.add(mounted);
        return;
      }

      this._loadAndMountGlb(
        modelSpec,
        instrument,
        slot,
        targetSize,
        standoff,
        bracketMaterial,
        padMaterial,
        group,
        version
      );
    });

    return group;
  }

  /** Invalidate any in-flight async .glb instrument mounts. */
  cancelPending() {
    this._buildVersion++;
  }

  /** Release internally owned AssetLoader if one was lazily constructed. */
  dispose() {
    this.cancelPending();
    if (this._ownsLoader && this._assetLoader) {
      this._assetLoader.dispose();
      this._assetLoader = null;
      this._ownsLoader = false;
    }
  }

  _getLoader() {
    if (!this._assetLoader) {
      this._assetLoader = new AssetLoader();
      this._ownsLoader = true;
    }
    return this._assetLoader;
  }

  async _loadAndMountGlb(
    url,
    instrument,
    slot,
    targetSize,
    standoff,
    bracketMaterial,
    padMaterial,
    group,
    version
  ) {
    try {
      const raw = await this._getLoader().loadModel(url);
      if (version !== this._buildVersion) return;

      const mounted = this._normalizeAndMount(
        raw,
        instrument,
        slot,
        targetSize,
        standoff,
        bracketMaterial,
        padMaterial
      );
      if (mounted && version === this._buildVersion) {
        group.add(mounted);
      }
    } catch (err) {
      console.warn(`Failed to load instrument model "${url}" for ${instrument.id}:`, err);
    }
  }

  _resolveSlot(slots, index, targetSize) {
    const baseSlot = slots[index % slots.length];
    const layer = Math.floor(index / slots.length);
    if (layer === 0) return baseSlot;

    // Offset extra instruments vertically if payload count exceeds primary slot count
    const offsetPos = baseSlot.position.clone();
    offsetPos.y += (layer % 2 === 0 ? 1 : -1) * targetSize * 0.9;
    return { position: offsetPos, normal: baseSlot.normal };
  }

  _normalizeAndMount(
    rawModel,
    instrument,
    slot,
    targetSize,
    standoff,
    bracketMaterial,
    padMaterial
  ) {
    rawModel.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rawModel);
    if (box.isEmpty()) return null;

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? targetSize / maxDim : 1;

    const mountGroup = new THREE.Group();
    mountGroup.name = `instrument:${instrument.id}`;
    mountGroup.position.copy(slot.position);
    mountGroup.rotation.y = Math.atan2(slot.normal.x, slot.normal.z);

    // Structural arm extending from slightly inside bus surface to mounting adapter pad
    const armEmbed = 0.08;
    const armLength = standoff + armEmbed;
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.03, armLength, 10),
      bracketMaterial
    );
    arm.rotation.x = Math.PI / 2;
    arm.position.z = standoff - armLength / 2;
    mountGroup.add(arm);

    const padRadius = Math.max(0.06, Math.min(size.x, size.y) * scale * 0.35);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(padRadius, padRadius * 1.1, 0.022, 16),
      padMaterial
    );
    pad.rotation.x = Math.PI / 2;
    pad.position.z = standoff;
    mountGroup.add(pad);

    const pivot = new THREE.Group();
    rawModel.position.sub(center);
    pivot.add(rawModel);
    pivot.scale.setScalar(scale);
    pivot.position.z = standoff + 0.014 + (size.z * scale) * 0.5;
    mountGroup.add(pivot);

    return mountGroup;
  }
}
