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
import { SpacecraftConfig, computeCheapestAutoFix } from "../logic/SpacecraftConfig.js";
import { KennedyHangarScene } from "../models/KennedyHangarScene.js";
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

test("Spacecraft.assemble renders chosen 3D instruments, antenna type, shielding, and radiators", () => {
  const craft = new Spacecraft();
  const group = craft.assemble(
    {
      ...DEFAULT_SELECTION,
      antennaId: "ka-band-deep-space",
      thermalId: "active-radiators",
      shieldingId: "tantalum-poly-shield",
    },
    [
      { id: "INS_LIDAR_01", name: "Laser Altimeter (LIDAR)" },
      { id: "INS_CAM_01", name: "Optical Camera" },
    ]
  );

  const payloadGroup = group.getObjectByName("payload-instruments");
  assert.ok(payloadGroup, "payload-instruments group should be mounted");
  assert.ok(payloadGroup.getObjectByName("instrument:INS_LIDAR_01"));
  assert.ok(payloadGroup.getObjectByName("instrument:INS_CAM_01"));
  assert.ok(group.getObjectByName("antenna:ka-band-deep-space"));
  assert.ok(group.getObjectByName("thermal:active-radiators"));
  assert.ok(group.getObjectByName("shielding:tantalum-poly-shield"));

  craft.dispose();
});

test("All 10 instruments mount synchronously facing outward away from the spacecraft bus", async () => {
  const { getInstruments } = await import("../../mission-science/data/instruments.js");
  const allInstruments = getInstruments();
  assert.equal(allInstruments.length, 10);

  const craft = new Spacecraft();
  const group = craft.assemble(DEFAULT_SELECTION, allInstruments);
  const payloadGroup = group.getObjectByName("payload-instruments");
  assert.ok(payloadGroup);

  for (const inst of allInstruments) {
    const mount = payloadGroup.getObjectByName(`instrument:${inst.id}`);
    assert.ok(mount, `expected synchronous mount for ${inst.id}`);
    mount.updateMatrixWorld(true);
    // Outward mount Z axis must point away from bus center (dot(mountPos, mountForwardZ) > 0)
    const forwardZ = new THREE.Vector3(0, 0, 1).applyQuaternion(mount.quaternion);
    const radialOut = new THREE.Vector3(mount.position.x, 0, mount.position.z).normalize();
    assert.ok(
      forwardZ.dot(radialOut) > 0.5,
      `${inst.id} sensor Z must point outward away from spacecraft bus`
    );
  }

  craft.dispose();
});

test("computeCheapestAutoFix resolves errors & warnings at lowest cost delta", () => {
  const lunarMission = {
    missionId: "MISSION_LUNAR_ORBIT",
    title: "Lunar Polar Exploration",
    targetOrbitId: "LUNAR",
    budgetMillions: 230,
    minSciencePoints: 85,
    requiredDataRateKbps: 8,
    targetDistanceKm: 384400,
    instruments: [
      { id: "INS_CAM_01", name: "Optical Camera", massKg: 12, powerWatts: 25, dataRateKbps: 8000, costMillions: 15, sciencePoints: 20 },
      { id: "INS_SPEC_01", name: "IR Spectrometer", massKg: 18, powerWatts: 35, dataRateKbps: 5000, costMillions: 20, sciencePoints: 25 },
      { id: "INS_LIDAR_01", name: "Laser Altimeter", massKg: 20, powerWatts: 40, dataRateKbps: 4000, costMillions: 22, sciencePoints: 25 },
      { id: "INS_THERMAL_01", name: "Thermal Mapper", massKg: 10, powerWatts: 20, dataRateKbps: 6000, costMillions: 16, sciencePoints: 25 },
    ],
  };

  const fix = computeCheapestAutoFix(DEFAULT_SELECTION, lunarMission.instruments, lunarMission);
  assert.ok(fix, "expected non-null auto-fix suggestion");
  assert.ok(fix.changes.length > 0);
  assert.equal(fix.remainingErrors, 0);
  assert.equal(fix.remainingWarnings, 0);

  const applied = new SpacecraftConfig(fix.selection);
  applied.setInstruments(lunarMission.instruments);
  const spec = applied.toSpacecraftSpec(lunarMission);
  assert.equal(spec.isValid, true);
  assert.equal(spec.errors.length, 0);
  assert.equal(spec.warnings.length, 0);
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

test("KennedyHangarScene builds KSC integration bay, fits pedestal to spacecraft, and disposes cleanly", () => {
  const hangar = new KennedyHangarScene();
  const bay = hangar.build();
  assert.ok(bay instanceof THREE.Group);
  assert.ok(bay.getObjectByName("ksc-outdoor-pad-39a"));

  const craft = new Spacecraft();
  const group = craft.assemble(DEFAULT_SELECTION);
  hangar.fitPedestalToSpacecraft(group);
  hangar.update(0.016, 1.0);

  craft.dispose();
  hangar.dispose();
  assert.equal(bay.children.length, 0);
});
