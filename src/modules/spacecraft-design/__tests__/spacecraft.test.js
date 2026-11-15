/**
 * @file src/modules/spacecraft-design/__tests__/spacecraft.test.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Automated unit & 3D assembly tests for components, engineering metrics,
 *       compatibility validation, and headless Three.js Spacecraft construction.
 */

import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import {
  DEFAULT_SELECTION,
  SPACECRAFT_COMPONENTS,
  SUBSYSTEM_CATEGORIES,
  getComponentsByCategory,
} from "../data/components.js";
import { SpacecraftConfig } from "../logic/SpacecraftConfig.js";
import { Spacecraft } from "../models/Spacecraft.js";

test("all 6 subsystem categories are populated and DEFAULT_SELECTION is valid", () => {
  assert.equal(SUBSYSTEM_CATEGORIES.length, 6);
  for (const cat of SUBSYSTEM_CATEGORIES) {
    const items = getComponentsByCategory(cat.key);
    assert.ok(items.length >= 3, `Expected >= 3 options in ${cat.key}`);
    const defaultId = DEFAULT_SELECTION[cat.selectionKey];
    assert.ok(
      items.some((i) => i.id === defaultId),
      `DEFAULT_SELECTION.${cat.selectionKey} (${defaultId}) must exist`
    );
  }
});

test("SpacecraftConfig computes accurate mass, power, cost, and delta-v", () => {
  const config = new SpacecraftConfig(DEFAULT_SELECTION);
  config.setInstruments([
    {
      id: "imager",
      name: "Multispectral Imager",
      massKg: 25,
      powerWatts: 60,
      dataRateKbps: 512,
      costMillions: 4.0,
      sciencePoints: 40,
    },
  ]);

  const spec = config.toSpacecraftSpec();
  // smallsat-hex(85) + twin-deployable(32) + li-ion-dual(28) + hydrazine-mono(28 dry) + x-band(14) + redundant-obc(16) + imager(25)
  assert.equal(spec.dryMassKg, 228);
  assert.equal(spec.propellantMassKg, 95);
  assert.equal(spec.totalMassKg, 323);
  assert.equal(spec.powerGeneratedWatts, 650);
  // hydrazine(35) + x-band(65) + redundant-obc(75) + imager(60) = 235
  assert.equal(spec.powerConsumedWatts, 235);
  assert.equal(spec.isValid, true);
  assert.ok(spec.deltaVMs > 700 && spec.deltaVMs < 850, `Unexpected deltaV: ${spec.deltaVMs}`);
});

test("Compatibility catches structural overload, power deficit, and antenna range failures", () => {
  const config = new SpacecraftConfig({
    structureId: "cubesat-6u", // maxPayloadMassKg = 45
    solarPanelId: "fixed-body", // 180 W
    batteryId: "li-ion-compact",
    propulsionId: "xenon-ion", // 950 W draw, 55 dry + 140 fuel = 195 kg
    antennaId: "s-band-patch", // 2,500 km range, 256 kbps
    avionicsId: "basic-obc",
  });

  const lunarMission = {
    missionId: "lunar-mapper",
    title: "Lunar Surface Mapper",
    targetOrbitId: "LUNAR",
    budgetMillions: 20,
    minSciencePoints: 80,
    requiredDataRateKbps: 2000,
    targetDistanceKm: 384400,
    instruments: [],
  };

  const spec = config.toSpacecraftSpec(lunarMission);
  assert.equal(spec.isValid, false);
  assert.ok(spec.errors.some((e) => e.includes("exceeds CubeSat 6U Bus limit")));
  assert.ok(spec.errors.some((e) => e.includes("Power deficit")));
  assert.ok(spec.errors.some((e) => e.includes("Antenna range")));
  assert.ok(spec.errors.some((e) => e.includes("data rate")));
  assert.ok(spec.errors.some((e) => e.includes("exceeds total budget")));
  assert.ok(spec.warnings.some((w) => w.includes("not radiation-hardened")));
});

test("Spacecraft.assemble builds a complete 3D THREE.Group and disposes cleanly", () => {
  const craft = new Spacecraft();
  const group = craft.assemble(DEFAULT_SELECTION);

  assert.ok(group instanceof THREE.Group);
  assert.equal(group.children.length, 5); // structure, solar, propulsion, antenna, battery

  // Swap to heavy bus + dish + bipropellant and verify clean rebuild
  craft.assemble({
    structureId: "heavy-deep-space",
    solarPanelId: "deep-space-mega",
    batteryId: "deep-space-cells",
    propulsionId: "bipropellant",
    antennaId: "ka-band-deep-space",
    avionicsId: "deep-space-core",
  });

  assert.equal(group.children.length, 5);
  craft.setSolarDeployed(false);
  craft.setThrustActive(true);
  craft.update(0.1);

  craft.dispose();
  assert.equal(group.children.length, 0);
});

test("Spacecraft mounts procedural and async .glb instruments and ignores stale async loads", async () => {
  let resolveCam;
  let camDisposed = false;
  const mockLoader = {
    loadModel: (url) =>
      new Promise((resolve) => {
        const g = new THREE.Group();
        const geo = new THREE.BoxGeometry(10, 10, 10);
        geo.dispose = () => {
          camDisposed = true;
        };
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
        mesh.userData.sharedAsset = true;
        g.add(mesh);
        if (url.includes("optical-camera")) {
          resolveCam = () => resolve(g);
        } else {
          resolve(g);
        }
      }),
    dispose: () => {},
  };

  const craft = new Spacecraft({ assetLoader: mockLoader });
  const group = craft.assemble(DEFAULT_SELECTION, [
    { id: "INS_LIDAR_01", name: "Laser Altimeter (LIDAR)" },
    { id: "INS_CAM_01", name: "Optical Camera" },
  ]);

  // 5 base subsystems + payload-instruments group containing synchronous procedural LIDAR
  assert.equal(group.children.length, 6);
  const payloadGroup = group.getObjectByName("payload-instruments");
  assert.ok(payloadGroup);
  assert.ok(payloadGroup.getObjectByName("instrument:INS_LIDAR_01"));

  // Re-assemble with Free Build before optical-camera resolves; stale load must not attach
  craft.assemble(DEFAULT_SELECTION, []);
  assert.equal(group.children.length, 5);
  resolveCam();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(group.children.length, 5);

  // Assemble with .glb instrument and verify normalized mount + sharedAsset protection on rebuild
  craft.assemble(DEFAULT_SELECTION, [{ id: "INS_CAM_01", name: "Optical Camera" }]);
  resolveCam();
  await new Promise((r) => setTimeout(r, 0));
  const mountedCam = group.getObjectByName("instrument:INS_CAM_01");
  assert.ok(mountedCam);
  const box = new THREE.Box3().setFromObject(mountedCam);
  const size = new THREE.Vector3();
  box.getSize(size);
  assert.ok(Math.max(size.x, size.y, size.z) < 0.6, `Expected normalized instrument size, got ${size.toArray()}`);

  craft.dispose();
  assert.equal(camDisposed, false);
});

test("Spacecraft mounts 3D engineering-upgrades and computes thermal/rad/attitude limits", () => {
  const config = new SpacecraftConfig({
    ...DEFAULT_SELECTION,
    thermalId: "active-radiators",
    shieldingId: "tantalum-poly-shield",
    reactionWheelId: "cmg-star-tracker",
  });
  const spec = config.toSpacecraftSpec();
  assert.ok(spec.limits.effectiveRadLimitKrad > 400);
  assert.equal(spec.limits.pointingAccuracyDeg, 0.03);
  assert.ok(spec.limits.tempMinC <= -65);

  const craft = new Spacecraft();
  const group = craft.assemble(spec.selection);
  assert.ok(group.getObjectByName("engineering-upgrades"));
  craft.dispose();
});
