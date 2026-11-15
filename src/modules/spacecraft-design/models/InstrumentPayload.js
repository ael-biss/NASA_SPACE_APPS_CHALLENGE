/**
 * @file src/modules/spacecraft-design/models/InstrumentPayload.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Loads (.glb via AssetLoader) and builds (procedural) scientific payload instruments,
 *       normalizes their scale/origin, and integrates them onto the spacecraft bus with
 *       aerospace bulkhead flanges, triangulated support trusses, retention cradles,
 *       and umbilical cable harnesses.
 */

import * as THREE from "three";
import { AssetLoader } from "../../../shared/utils/AssetLoader.js";
import { getInstrumentById } from "../../mission-science/data/instruments.js";
import {
  createInfraredSpectrometerModel,
  createLaserAltimeterModel,
  createMagnetometerModel,
  createMassSpectrometerModel,
  createOpticalCameraModel,
  createParticleDetectorModel,
  createRadarSounderModel,
  createSeismometerModel,
  createThermalImagerModel,
  createUvSpectrometerModel,
} from "../../mission-science/models/proceduralInstruments.js";

const PROCEDURAL_BUILDERS = {
  "procedural:optical-camera": createOpticalCameraModel,
  "procedural:infrared-spectrometer": createInfraredSpectrometerModel,
  "procedural:radar-sounder": createRadarSounderModel,
  "procedural:magnetometer": createMagnetometerModel,
  "procedural:mass-spectrometer": createMassSpectrometerModel,
  "procedural:laser-altimeter": createLaserAltimeterModel,
  "procedural:uv-spectrometer": createUvSpectrometerModel,
  "procedural:thermal-imager": createThermalImagerModel,
  "procedural:particle-detector": createParticleDetectorModel,
  "procedural:seismometer": createSeismometerModel,
};

const FORWARD_Z = new THREE.Vector3(0, 0, 1);
const UP_Y = new THREE.Vector3(0, 1, 0);

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
    const targetSize = Math.min(0.42, Math.max(0.18, busMinDim * 0.28));
    const standoff = Math.max(0.055, busMinDim * 0.068);

    const materials = this._createMountMaterials();

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
          materials
        );
        if (mounted) group.add(mounted);
        return;
      }

      if (typeof window === "undefined") {
        const raw = this._createFallbackInstrumentModel(instrument);
        const mounted = this._normalizeAndMount(
          raw,
          instrument,
          slot,
          targetSize,
          standoff,
          materials
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
        materials,
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

  _createMountMaterials() {
    return {
      bracket: new THREE.MeshStandardMaterial({
        color: 0x475569,
        metalness: 0.85,
        roughness: 0.32,
      }),
      pad: new THREE.MeshStandardMaterial({
        color: 0x64748b,
        metalness: 0.82,
        roughness: 0.28,
      }),
      isolator: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.3,
        roughness: 0.62,
      }),
      fastener: new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        metalness: 0.92,
        roughness: 0.18,
      }),
      goldTrim: new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.86,
        roughness: 0.24,
      }),
      cable: new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.25,
        roughness: 0.75,
      }),
      accentWire: new THREE.MeshStandardMaterial({
        color: 0xb45309,
        metalness: 0.4,
        roughness: 0.45,
      }),
    };
  }

  async _loadAndMountGlb(
    url,
    instrument,
    slot,
    targetSize,
    standoff,
    materials,
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
        materials
      );
      if (mounted && version === this._buildVersion) {
        group.add(mounted);
      }
    } catch (err) {
      if (version !== this._buildVersion) return;
      console.warn(`Falling back to procedural sensor mesh for ${instrument.id}:`, err);
      const fallback = this._createFallbackInstrumentModel(instrument);
      const mounted = this._normalizeAndMount(
        fallback,
        instrument,
        slot,
        targetSize,
        standoff,
        materials
      );
      if (mounted && version === this._buildVersion) {
        group.add(mounted);
      }
    }
  }

  _createFallbackInstrumentModel(instrument) {
    const pod = new THREE.Group();
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.18, 0.22),
      new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.72,
        roughness: 0.28,
        flatShading: true,
      })
    );
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.08, 0.11, 12),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        emissive: instrument?.id?.includes("RAD") ? 0x19bfff : 0x0284c7,
        emissiveIntensity: 0.35,
        metalness: 0.85,
        roughness: 0.2,
      })
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.13;
    pod.add(housing, lens);
    return pod;
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
    materials
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

    const instW = Math.max(0.06, size.x * scale);
    const instH = Math.max(0.06, size.y * scale);
    const cradleW = Math.min(targetSize * 0.95, Math.max(0.09, instW * 0.78));
    const cradleH = Math.min(targetSize * 0.95, Math.max(0.09, instH * 0.78));
    const plateW = Math.max(0.11, cradleW * 1.12);
    const plateH = Math.max(0.11, cradleH * 1.12);

    // Magnetometers sit on an extended boom to isolate them from bus magnetic interference
    const isBoom = instrument.id === "INS_MAG_01";
    const effectiveStandoff = isBoom ? standoff * 1.85 : standoff;
    const effectiveTargetSize = isBoom ? targetSize * 1.35 : targetSize;
    const modelScale = maxDim > 0 ? effectiveTargetSize / maxDim : 1;

    const mountGroup = new THREE.Group();
    mountGroup.name = `instrument:${instrument.id}`;
    mountGroup.position.copy(slot.position);
    mountGroup.rotation.y = Math.atan2(slot.normal.x, slot.normal.z);

    const busPortPos = this._buildBulkheadInterface(mountGroup, plateW, plateH, materials);
    this._buildSupportTruss(
      mountGroup,
      plateW,
      plateH,
      cradleW,
      cradleH,
      effectiveStandoff,
      isBoom,
      materials
    );
    const instPortPos = this._buildAdapterCradle(
      mountGroup,
      cradleW,
      cradleH,
      effectiveStandoff,
      materials
    );
    this._buildUmbilicalHarness(
      mountGroup,
      busPortPos,
      instPortPos,
      effectiveStandoff,
      materials
    );

    // Lock the instrument's rear (-Z) mounting face flush onto the adapter cradle so all sensors aim +Z outward
    const adapterFrontZ = effectiveStandoff + 0.008;
    const pivot = new THREE.Group();
    rawModel.position.set(-center.x, -center.y, -box.min.z);
    pivot.add(rawModel);
    pivot.scale.setScalar(modelScale);
    pivot.position.z = adapterFrontZ - 0.003;
    mountGroup.add(pivot);

    return mountGroup;
  }

  /**
   * Build the bus-side bulkhead mounting plate, thermal isolator, corner hex bolts,
   * and avionics feedthrough connector. Returns the local cable exit point.
   */
  _buildBulkheadInterface(mountGroup, plateW, plateH, materials) {
    // Dark G10 thermal isolator pad seated slightly into the bus skin to prevent seam gaps
    const isolator = new THREE.Mesh(
      new THREE.BoxGeometry(plateW * 1.08, plateH * 1.08, 0.016),
      materials.isolator
    );
    isolator.position.z = 0.001;
    mountGroup.add(isolator);

    // Machined aluminum/titanium bulkhead flange plate
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(plateW, plateH, 0.012),
      materials.bracket
    );
    plate.position.z = 0.009;
    mountGroup.add(plate);

    // Central structural boss collar
    const bossRadius = Math.min(plateW, plateH) * 0.24;
    const boss = new THREE.Mesh(
      new THREE.CylinderGeometry(bossRadius, bossRadius * 1.15, 0.014, 16),
      materials.pad
    );
    boss.rotation.x = Math.PI / 2;
    boss.position.z = 0.018;
    mountGroup.add(boss);

    // 4 corner socket-head cap screws
    const boltGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.008, 6);
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const bolt = new THREE.Mesh(boltGeo, materials.fastener);
        bolt.rotation.x = Math.PI / 2;
        bolt.position.set(sx * plateW * 0.38, sy * plateH * 0.38, 0.016);
        mountGroup.add(bolt);
      }
    }

    // Avionics bulkhead feedthrough junction box + MIL-spec circular connector collar
    const portX = -plateW * 0.3;
    const portY = -plateH * 0.28;
    const junctionBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.024, 0.016),
      materials.isolator
    );
    junctionBox.position.set(portX, portY, 0.016);
    mountGroup.add(junctionBox);

    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.009, 0.012, 12),
      materials.goldTrim
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.set(portX, portY, 0.024);
    mountGroup.add(collar);

    return new THREE.Vector3(portX, portY, 0.028);
  }

  /**
   * Build a triangulated 4-strut aerospace truss (or 2-bay magnetometer boom)
   * transferring structural loads from the bulkhead plate to the instrument cradle.
   */
  _buildSupportTruss(
    mountGroup,
    plateW,
    plateH,
    cradleW,
    cradleH,
    standoff,
    isBoom,
    materials
  ) {
    const startZ = 0.012;
    const endZ = standoff - 0.006;

    // Central structural spar
    const sparRadius = isBoom ? 0.012 : 0.016;
    this._addStrut(
      mountGroup,
      new THREE.Vector3(0, 0, startZ),
      new THREE.Vector3(0, 0, endZ),
      sparRadius,
      materials.bracket
    );

    if (isBoom) {
      const midZ = (startZ + endZ) * 0.5;
      const midW = (plateW + cradleW) * 0.22;
      const midH = (plateH + cradleH) * 0.22;

      const midRing = new THREE.Mesh(
        new THREE.BoxGeometry(midW * 1.9, midH * 1.9, 0.008),
        materials.pad
      );
      midRing.position.z = midZ;
      mountGroup.add(midRing);

      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          const pBase = new THREE.Vector3(sx * plateW * 0.34, sy * plateH * 0.3, startZ);
          const pMid = new THREE.Vector3(sx * midW * 0.8, sy * midH * 0.8, midZ);
          const pTop = new THREE.Vector3(sx * cradleW * 0.34, sy * cradleH * 0.3, endZ);
          this._addStrut(mountGroup, pBase, pMid, 0.0055, materials.pad);
          this._addStrut(mountGroup, pMid, pTop, 0.0055, materials.pad);
        }
      }
      return;
    }

    // 4-point triangulated bipod/quad-pod truss struts
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const p1 = new THREE.Vector3(sx * plateW * 0.34, sy * plateH * 0.3, startZ);
        const p2 = new THREE.Vector3(sx * cradleW * 0.34, sy * cradleH * 0.3, endZ);
        this._addStrut(mountGroup, p1, p2, 0.0065, materials.pad);
      }
    }

    // Lower lateral shear cross-brace between the bottom struts
    const midZ = (startZ + endZ) * 0.52;
    const braceHalfW = (plateW + cradleW) * 0.17;
    const braceY = -(plateH + cradleH) * 0.15;
    this._addStrut(
      mountGroup,
      new THREE.Vector3(-braceHalfW, braceY, midZ),
      new THREE.Vector3(braceHalfW, braceY, midZ),
      0.005,
      materials.bracket
    );
  }

  /**
   * Build the instrument-side iso-grid adapter cradle, thermal backing trim,
   * corner retention clamp lugs, and instrument umbilical receptacle.
   */
  _buildAdapterCradle(mountGroup, cradleW, cradleH, standoff, materials) {
    // Gold MLI thermal backing frame behind the adapter plate
    const thermalTrim = new THREE.Mesh(
      new THREE.BoxGeometry(cradleW * 0.92, cradleH * 0.92, 0.008),
      materials.goldTrim
    );
    thermalTrim.position.z = standoff - 0.006;
    mountGroup.add(thermalTrim);

    // Main machined adapter plate
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(cradleW, cradleH, 0.016),
      materials.pad
    );
    plate.position.z = standoff;
    mountGroup.add(plate);

    // 4 corner retention clamp brackets gripping the instrument housing
    const clampGeo = new THREE.BoxGeometry(0.016, 0.016, 0.026);
    const pinGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.01, 6);
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const cx = sx * cradleW * 0.44;
        const cy = sy * cradleH * 0.44;

        const clamp = new THREE.Mesh(clampGeo, materials.isolator);
        clamp.position.set(cx, cy, standoff + 0.011);
        mountGroup.add(clamp);

        const pin = new THREE.Mesh(pinGeo, materials.fastener);
        pin.rotation.x = Math.PI / 2;
        pin.position.set(cx, cy, standoff + 0.024);
        mountGroup.add(pin);
      }
    }

    // Instrument-side umbilical connector block
    const instPortX = -cradleW * 0.34;
    const instPortY = -cradleH * 0.24;
    const instConnector = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.02, 0.016),
      materials.isolator
    );
    instConnector.position.set(instPortX, instPortY, standoff + 0.012);
    mountGroup.add(instConnector);

    const instCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.007, 0.01, 12),
      materials.goldTrim
    );
    instCollar.rotation.x = Math.PI / 2;
    instCollar.position.set(instPortX, instPortY, standoff + 0.004);
    mountGroup.add(instCollar);

    return new THREE.Vector3(instPortX, instPortY, standoff + 0.004);
  }

  /**
   * Route braided power/data and telemetry umbilical cables with P-clamps
   * between the bus bulkhead feedthrough and the instrument connector.
   */
  _buildUmbilicalHarness(mountGroup, busPortPos, instPortPos, standoff, materials) {
    const mid1 = new THREE.Vector3(
      busPortPos.x - 0.022,
      busPortPos.y - 0.018,
      standoff * 0.38
    );
    const mid2 = new THREE.Vector3(
      instPortPos.x - 0.024,
      instPortPos.y - 0.015,
      standoff * 0.74
    );

    const mainCurve = new THREE.CatmullRomCurve3([busPortPos, mid1, mid2, instPortPos]);
    const mainCable = new THREE.Mesh(
      new THREE.TubeGeometry(mainCurve, 18, 0.0055, 8, false),
      materials.cable
    );
    mountGroup.add(mainCable);

    // Secondary amber Kapton-wrapped telemetry/heater wire
    const offset = new THREE.Vector3(0.008, 0.006, 0);
    const secCurve = new THREE.CatmullRomCurve3([
      busPortPos.clone().add(offset),
      mid1.clone().add(offset),
      mid2.clone().add(offset),
      instPortPos.clone().add(offset),
    ]);
    const secCable = new THREE.Mesh(
      new THREE.TubeGeometry(secCurve, 16, 0.0032, 6, false),
      materials.accentWire
    );
    mountGroup.add(secCable);

    // Cable tie-down P-clamps along the harness
    const clampGeo = new THREE.TorusGeometry(0.0075, 0.0022, 6, 12);
    for (const t of [0.32, 0.68]) {
      const pt = mainCurve.getPoint(t);
      const tangent = mainCurve.getTangent(t).normalize();
      const pClamp = new THREE.Mesh(clampGeo, materials.fastener);
      pClamp.position.copy(pt);
      pClamp.quaternion.setFromUnitVectors(FORWARD_Z, tangent);
      mountGroup.add(pClamp);
    }
  }

  /** Orient and add a cylindrical structural strut between two 3D points. */
  _addStrut(parent, start, end, radius, material) {
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();
    if (length < 1e-4) return;

    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, length, 8),
      material
    );
    mesh.position.copy(start).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(UP_Y, dir.normalize());
    parent.add(mesh);
  }
}
