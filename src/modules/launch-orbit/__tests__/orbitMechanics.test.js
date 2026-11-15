/**
 * @file src/modules/launch-orbit/__tests__/orbitMechanics.test.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Unit tests for rockets catalog, orbits catalog, orbital mechanics (v = sqrt(mu/r),
 *       Hohmann transfers, Tsiolkovsky rocket equation), and launch simulation checks.
 */

import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { ORBIT_IDS, PHYSICS } from "../../../shared/data/constants.js";
import { DEFAULT_SELECTION } from "../../spacecraft-design/data/components.js";
import { SpacecraftConfig } from "../../spacecraft-design/logic/SpacecraftConfig.js";
import { MissionEvaluator } from "../../mission-science/logic/MissionEvaluator.js";
import {
  DEFAULT_LAUNCH_SITE_ID,
  LAUNCH_SITES,
  calculateSiteRotationBonusMs,
  getLaunchSiteById,
} from "../data/launchSites.js";
import { ROCKETS, getRocketById, getRockets } from "../data/rockets.js";
import { ORBITS, getOrbitById, getOrbits } from "../data/orbits.js";
import { OrbitMechanics } from "../logic/OrbitMechanics.js";
import { PlanetScene } from "../models/PlanetScene.js";
import { LaunchAnimation } from "../models/LaunchAnimation.js";

test("ROCKETS catalog is populated with valid launch vehicles and lookup helpers", () => {
  assert.ok(ROCKETS.length >= 4);
  assert.equal(getRockets().length, ROCKETS.length);

  for (const rocket of ROCKETS) {
    assert.ok(rocket.id);
    assert.ok(rocket.name);
    assert.ok(rocket.maxPayloadLeoKg > 0);
    assert.ok(rocket.launcherDeltaVMs >= 9400);
    assert.ok(rocket.fairingDiameterM > 0);
    assert.ok(rocket.costMillions > 0);
  }

  assert.equal(getRocketById("microlaunch")?.name, "MicroLaunch SmallSat");
  assert.equal(getRocketById("nonexistent"), undefined);
});

test("ORBITS catalog covers LEO, MEO, GEO, LUNAR, and MARS with lookup helpers", () => {
  const expectedIds = [ORBIT_IDS.LEO, ORBIT_IDS.MEO, ORBIT_IDS.GEO, ORBIT_IDS.LUNAR, ORBIT_IDS.MARS];
  assert.equal(getOrbits().length, expectedIds.length);

  for (const id of expectedIds) {
    const orbit = getOrbitById(id);
    assert.ok(orbit, `Missing orbit ${id}`);
    assert.ok(orbit.altitudeKm > 0);
    assert.ok(orbit.requiredDeltaVMs >= 9400);
    assert.ok(orbit.orbitalPeriodSec > 0);
    assert.ok(orbit.orbitRadius3D > 0);
    assert.ok(orbit.description.length > 0);
  }

  assert.equal(getOrbitById("JUPITER"), undefined);
});

test("OrbitMechanics computes v = sqrt(mu/r), escape velocity, period, and Hohmann transfer", () => {
  const mechanics = new OrbitMechanics();

  // LEO at 500 km: r = 6871 km -> v = sqrt(398600.4418 / 6871) * 1000 ≈ 7616.72 m/s
  const leoVel = mechanics.calculateOrbitalVelocity(500);
  assert.ok(Math.abs(leoVel - 7616.72) < 0.5, `Expected ~7616.72 m/s, got ${leoVel}`);

  // GEO at 35,786 km: v ≈ 3074.66 m/s and period ≈ 86,164 s (sidereal day)
  const geoVel = mechanics.calculateOrbitalVelocity(35786);
  assert.ok(Math.abs(geoVel - 3074.66) < 0.5, `Expected ~3074.66 m/s, got ${geoVel}`);

  const geoPeriod = mechanics.calculateOrbitalPeriod(35786);
  assert.ok(Math.abs(geoPeriod - 86164) < 60, `Expected ~86164 s, got ${geoPeriod}`);

  // Escape velocity = sqrt(2) * circular orbital velocity
  const leoEsc = mechanics.calculateEscapeVelocity(500);
  assert.ok(Math.abs(leoEsc - leoVel * Math.SQRT2) < 0.1);

  // Hohmann transfer from 500 km LEO to 35,786 km GEO ≈ 3818.61 m/s
  const leoToGeoDv = mechanics.calculateHohmannTransferDeltaV(500, 35786);
  assert.ok(Math.abs(leoToGeoDv - 3818.61) < 0.5, `Expected ~3818.61 m/s, got ${leoToGeoDv}`);
  assert.equal(mechanics.calculateHohmannTransferDeltaV(500, 500), 0);

  // Invalid inputs return 0
  assert.equal(mechanics.calculateOrbitalVelocity(-10), 0);
  assert.equal(mechanics.calculateOrbitalVelocity(NaN), 0);
});

test("OrbitMechanics derives required delta-v for catalog and custom orbits", () => {
  const mechanics = new OrbitMechanics();

  // From KSC LC-39A (28.6°N): Earth spin assist (~408 m/s) reduces 9,400 m/s baseline to 8,992 m/s
  assert.equal(mechanics.calculateRequiredDeltaV("LEO"), 8992);
  // GEO (0° incl): 13,500 - 408 spin + 374 apogee plane-change = 13,466 m/s
  assert.equal(mechanics.calculateRequiredDeltaV(getOrbitById("GEO")), 13466);

  // Custom orbit without explicit requiredDeltaVMs derives from v = sqrt(mu/r) + Hohmann - spin assist
  const customGeo = mechanics.calculateRequiredDeltaV({ altitudeKm: 35786 });
  assert.ok(Math.abs(customGeo - (9400 + 3818.61 - 408)) < 2.0, `Got ${customGeo}`);
  assert.equal(mechanics.calculateRequiredDeltaV(null), 0);
});

test("OrbitMechanics.calculateSpacecraftDeltaV matches Tsiolkovsky equation", () => {
  const mechanics = new OrbitMechanics();
  const config = new SpacecraftConfig(DEFAULT_SELECTION);
  const spec = config.toSpacecraftSpec();

  const expected =
    spec.ispSeconds *
    PHYSICS.STANDARD_GRAVITY_MS2 *
    Math.log(spec.totalMassKg / spec.dryMassKg);

  assert.ok(Math.abs(mechanics.calculateSpacecraftDeltaV(spec) - expected) < 1e-6);
  assert.equal(
    mechanics.calculateSpacecraftDeltaV({ ispSeconds: 0, totalMassKg: 200, dryMassKg: 100 }),
    0
  );
  assert.equal(
    mechanics.calculateSpacecraftDeltaV({ ispSeconds: 230, totalMassKg: 100, dryMassKg: 100 }),
    0
  );
});

test("OrbitMechanics.simulateLaunch succeeds when payload mass and delta-v requirements are met", () => {
  const mechanics = new OrbitMechanics();
  const config = new SpacecraftConfig(DEFAULT_SELECTION);
  const spec = config.toSpacecraftSpec();

  const result = mechanics.simulateLaunch("medium-orbital", spec, "LEO");
  assert.equal(result.success, true);
  assert.equal(result.rocketId, "medium-orbital");
  assert.equal(result.targetOrbitId, "LEO");
  assert.equal(result.achievedAltitudeKm, 500);
  assert.equal(result.launchCostMillions, 28.0);
  assert.equal(result.failureReason, "");
  assert.ok(result.remainingDeltaVMs > 3000);
});

test("OrbitMechanics.simulateLaunch rejects overweight payloads and insufficient delta-v", () => {
  const mechanics = new OrbitMechanics();

  // Overweight for MicroLaunch (maxPayloadLeoKg = 320 kg; biprop medium bus > 700 kg)
  const heavyConfig = new SpacecraftConfig({
    structureId: "medium-oct",
    solarPanelId: "triple-junction",
    batteryId: "li-ion-dual",
    propulsionId: "bipropellant",
    antennaId: "parabolic-high-gain",
    avionicsId: "redundant-obc",
  });
  const heavySpec = heavyConfig.toSpacecraftSpec();

  const overweightResult = mechanics.simulateLaunch("microlaunch", heavySpec, "LEO");
  assert.equal(overweightResult.success, false);
  assert.equal(overweightResult.achievedAltitudeKm, 0);
  assert.equal(overweightResult.remainingDeltaVMs, 0);
  assert.ok(overweightResult.failureReason.includes("exceeds"));

  // Insufficient delta-v: medium-orbital (11800) + cold-gas (~25 m/s) cannot capture GEO (13466)
  const lowDvConfig = new SpacecraftConfig({
    ...DEFAULT_SELECTION,
    structureId: "medium-oct",
    solarPanelId: "twin-deployable",
    batteryId: "li-ion-dual",
    antennaId: "x-band-medium",
    avionicsId: "redundant-obc",
    thermalId: "heaters-mli",
    propulsionId: "cold-gas",
  });
  const lowDvSpec = lowDvConfig.toSpacecraftSpec();

  const lowDvGeoResult = mechanics.simulateLaunch("medium-orbital", lowDvSpec, "GEO");
  assert.equal(lowDvGeoResult.success, false);
  // Cleared LEO parking orbit (and GTO burn), stranded before GEO circularization/capture
  assert.equal(lowDvGeoResult.achievedAltitudeKm, 500);
  assert.equal(lowDvGeoResult.remainingDeltaVMs, 0);
  assert.ok(lowDvGeoResult.failureReason.includes("Insufficient delta-v"));

  // Heavy Lift (12800) + bipropellant (>1600 m/s) reaches LUNAR (14100)
  const lunarResult = mechanics.simulateLaunch("heavy-lift", heavySpec, "LUNAR");
  assert.equal(lunarResult.success, true);
  assert.equal(lunarResult.achievedAltitudeKm, 384400);
  assert.ok(lunarResult.remainingDeltaVMs > 0);
});

test("OrbitMechanics.simulateLaunch integrates with MissionEvaluator and rejects invalid spacecraft", () => {
  const mechanics = new OrbitMechanics();
  const evaluator = new MissionEvaluator();

  const invalidSpec = new SpacecraftConfig({
    structureId: "cubesat-6u",
    solarPanelId: "fixed-body",
    batteryId: "li-ion-compact",
    propulsionId: "xenon-ion",
    antennaId: "s-band-patch",
    avionicsId: "basic-obc",
  }).toSpacecraftSpec();
  assert.equal(invalidSpec.isValid, false);

  const failedLaunch = mechanics.simulateLaunch("medium-orbital", invalidSpec, "LEO");
  assert.equal(failedLaunch.success, false);
  assert.ok(failedLaunch.failureReason.includes("pre-launch"));

  // With allowInvalid: true (used by Launch & Orbit UI), simulator executes flight phases so player sees physical failure & results
  const simulatedInvalidLaunch = mechanics.simulateLaunch("medium-orbital", invalidSpec, "LEO", {
    allowInvalid: true,
  });
  assert.equal(simulatedInvalidLaunch.success, false);
  assert.equal(simulatedInvalidLaunch.failedPhaseId, "max-q");
  assert.equal(simulatedInvalidLaunch.failureMode, "structural-breakup");
  assert.equal(simulatedInvalidLaunch.componentHealth.structure, 0);
  assert.equal(simulatedInvalidLaunch.phases[0].status, "passed");
  assert.equal(simulatedInvalidLaunch.phases[1].status, "failed");
  assert.ok(simulatedInvalidLaunch.failureCause.includes("exceeds bus limit"));

  // Mild CubeSat 6U overload (e.g. 50 kg > 45 kg) on low-MaxQ launcher still fails structurally during ascent
  const mildOverloadSpec = {
    ...new SpacecraftConfig({
      structureId: "cubesat-6u",
      solarPanelId: "fixed-body",
      batteryId: "li-ion-compact",
      propulsionId: "cold-gas",
      antennaId: "s-band-patch",
      avionicsId: "basic-obc",
    }).toSpacecraftSpec(),
    carriedMassKg: 50,
    totalMassKg: 62,
    isValid: false,
    errors: ["Carried mass (50 kg) exceeds CubeSat 6U Bus limit (45 kg)."],
  };
  const mildOverloadLaunch = mechanics.simulateLaunch("super-heavy", mildOverloadSpec, "LEO", {
    allowInvalid: true,
  });
  assert.equal(mildOverloadLaunch.success, false);
  assert.equal(mildOverloadLaunch.failedPhaseId, "ascent");
  assert.equal(mildOverloadLaunch.failureMode, "structural-breakup");
  assert.equal(mildOverloadLaunch.componentHealth.structure, 0);
  assert.ok(mildOverloadLaunch.failureCause.includes("exceeded the bus structural limit"));

  // Valid mission end-to-end
  const missionSpec = {
    missionId: "MISSION_EARTH_LEO",
    title: "Earth Surface Observation",
    targetOrbitId: "LEO",
    budgetMillions: 110,
    minSciencePoints: 65,
    requiredDataRateKbps: 10,
    targetDistanceKm: 500,
    instruments: [
      {
        id: "INS_CAM_01",
        name: "Optical Camera",
        massKg: 20,
        powerWatts: 40,
        dataRateKbps: 200,
        costMillions: 10,
        sciencePoints: 70,
      },
    ],
  };

  const config = new SpacecraftConfig(DEFAULT_SELECTION);
  config.setInstruments(missionSpec.instruments);
  const validSpec = config.toSpacecraftSpec(missionSpec);
  const launchResult = mechanics.simulateLaunch("medium-orbital", validSpec, missionSpec.targetOrbitId);
  assert.equal(launchResult.success, true);

  const evaluation = evaluator.calculateScore(missionSpec, validSpec, launchResult);
  assert.equal(evaluation.score, 100);
  assert.equal(evaluation.grade, "A");
});

test("Phase-by-phase simulator verifies LRO-class Lunar Orbiter and MAVEN-class Mars Orbiter pass all 7 phases", () => {
  const mechanics = new OrbitMechanics();
  const evaluator = new MissionEvaluator();

  // 1. LRO-class Lunar Polar Orbiter
  const lunarMission = {
    missionId: "MISSION_LUNAR_ORBIT",
    title: "Lunar Polar Exploration (LRO-Class)",
    targetOrbitId: "LUNAR",
    budgetMillions: 230,
    minSciencePoints: 85,
    requiredDataRateKbps: 8,
    targetDistanceKm: 384400,
    instruments: [
      { id: "INS_CAM_01", name: "Optical Camera", massKg: 12, powerWatts: 25, dataRateKbps: 8000, costMillions: 15, sciencePoints: 20 },
      { id: "INS_SPEC_01", name: "Infrared Spectrometer", massKg: 18, powerWatts: 35, dataRateKbps: 5000, costMillions: 20, sciencePoints: 25 },
      { id: "INS_LIDAR_01", name: "Laser Altimeter (LIDAR)", massKg: 21.4, powerWatts: 59, dataRateKbps: 4000, costMillions: 28, sciencePoints: 30 },
      { id: "INS_THERMAL_01", name: "Thermal Infrared Imager", massKg: 10, powerWatts: 20, dataRateKbps: 6000, costMillions: 16, sciencePoints: 25 },
    ],
  };

  const lroConfig = new SpacecraftConfig({
    structureId: "medium-oct",
    solarPanelId: "triple-junction",
    batteryId: "li-ion-dual",
    propulsionId: "bipropellant",
    antennaId: "parabolic-high-gain",
    avionicsId: "redundant-obc",
    thermalId: "heaters-mli",
    shieldingId: "aluminum-vault",
    reactionWheelId: "reaction-wheel-triad",
  });
  lroConfig.setInstruments(lunarMission.instruments);
  const lroSpec = lroConfig.toSpacecraftSpec(lunarMission);
  assert.equal(lroSpec.isValid, true);

  const lroLaunch = mechanics.simulateLaunch("heavy-lift", lroSpec, "LUNAR", {
    fairingId: "standard-fairing",
    missionSpec: lunarMission,
  });
  assert.equal(lroLaunch.success, true, lroLaunch.failureReason);
  assert.equal(lroLaunch.phases.length, 7);
  assert.ok(lroLaunch.phases.every((p) => p.status === "passed"));
  assert.equal(evaluator.calculateScore(lunarMission, lroSpec, lroLaunch).grade, "A");

  // 2. MAVEN-class Mars Orbiter
  const marsMission = {
    missionId: "MISSION_MARS_ORBIT",
    title: "Mars Atmospheric & Polar Orbiter (MAVEN-Class)",
    targetOrbitId: "MARS",
    budgetMillions: 330,
    minSciencePoints: 95,
    requiredDataRateKbps: 5,
    targetDistanceKm: 225000000,
    instruments: [
      { id: "INS_UV_01", name: "Ultraviolet Spectrometer", massKg: 12, powerWatts: 22, dataRateKbps: 3000, costMillions: 18, sciencePoints: 25 },
      { id: "INS_MAG_01", name: "Magnetometer", massKg: 5, powerWatts: 10, dataRateKbps: 1000, costMillions: 10, sciencePoints: 25 },
      { id: "INS_PARTICLE_01", name: "Particle Detector", massKg: 6, powerWatts: 15, dataRateKbps: 2000, costMillions: 14, sciencePoints: 25 },
      { id: "INS_MASS_01", name: "Mass Spectrometer", massKg: 8, powerWatts: 30, dataRateKbps: 2000, costMillions: 25, sciencePoints: 30 },
      { id: "INS_CAM_01", name: "Optical Camera", massKg: 12, powerWatts: 25, dataRateKbps: 8000, costMillions: 15, sciencePoints: 20 },
    ],
  };

  const mavenConfig = new SpacecraftConfig({
    structureId: "heavy-deep-space",
    solarPanelId: "deep-space-mega",
    batteryId: "deep-space-cells",
    propulsionId: "bipropellant",
    antennaId: "ka-band-deep-space",
    avionicsId: "deep-space-core",
    thermalId: "active-radiators",
    shieldingId: "tantalum-poly-shield",
    reactionWheelId: "cmg-star-tracker",
  });
  mavenConfig.setInstruments(marsMission.instruments);
  const mavenSpec = mavenConfig.toSpacecraftSpec(marsMission);
  assert.equal(mavenSpec.isValid, true);

  const mavenLaunch = mechanics.simulateLaunch("super-heavy", mavenSpec, "MARS", {
    fairingId: "reinforced-fairing",
    missionSpec: marsMission,
  });
  assert.equal(mavenLaunch.success, true, mavenLaunch.failureReason);
  assert.equal(mavenLaunch.phases.length, 7);
  assert.ok(mavenLaunch.phases.every((p) => p.status === "passed"));
  assert.ok(mavenLaunch.missionStats.commsDelaySec > 700);
  assert.equal(evaluator.calculateScore(marsMission, mavenSpec, mavenLaunch).grade, "A");
});

test("Phase-by-phase simulator fails at exact expected phase with cause and fix", () => {
  const mechanics = new OrbitMechanics();

  // Phase 2 (Max-Q): Unfaired deployable solar panels fail aerodynamic load
  const leoSpec = new SpacecraftConfig(DEFAULT_SELECTION).toSpacecraftSpec();
  const maxQFail = mechanics.simulateLaunch("medium-orbital", leoSpec, "LEO", {
    fairingId: "no-fairing",
  });
  assert.equal(maxQFail.success, false);
  assert.equal(maxQFail.failedPhaseId, "max-q");
  assert.equal(maxQFail.failureMode, "structural-breakup");
  assert.ok(maxQFail.failureCause.includes("Max-Q"));
  assert.ok(maxQFail.failureFix.includes("fairing"));

  // Phase 3a (Ascent - G-load): High-g solid rocket (9.0g) exceeds smallsat-hex 8.5g limit
  const gFail = mechanics.simulateLaunch("solid-sprint", leoSpec, "LEO");
  assert.equal(gFail.success, false);
  assert.equal(gFail.failedPhaseId, "ascent");
  assert.ok(gFail.failureCause.includes("9.0 g"));

  // Phase 3b (Ascent - Vibration): High-vibration solid rocket with fragile instruments without acoustic fairing
  const fragConfig = new SpacecraftConfig({ ...DEFAULT_SELECTION, structureId: "medium-oct" });
  fragConfig.setInstruments([
    { id: "INS_CAM_01", name: "Optical Camera", massKg: 12, powerWatts: 25, dataRateKbps: 8000, costMillions: 15, sciencePoints: 20 },
  ]);
  const fragSpec = fragConfig.toSpacecraftSpec();
  const vibFail = mechanics.simulateLaunch("solid-sprint", fragSpec, "LEO", {
    fairingId: "standard-fairing",
  });
  assert.equal(vibFail.success, false);
  assert.equal(vibFail.failedPhaseId, "ascent");
  assert.ok(vibFail.failureFix.includes("Acoustic-Damped"));

  // Using reinforced fairing damps vibration so solid-sprint succeeds
  const vibFixed = mechanics.simulateLaunch("solid-sprint", fragSpec, "LEO", {
    fairingId: "reinforced-fairing",
  });
  assert.equal(vibFixed.success, true, vibFixed.failureReason);

  // Phase 6 (Cruise - Thermal): Baseline MLI freezes on Mars without heaters/radiators
  const coldMarsSpec = new SpacecraftConfig({
    structureId: "heavy-deep-space",
    solarPanelId: "deep-space-mega",
    batteryId: "deep-space-cells",
    propulsionId: "bipropellant",
    antennaId: "ka-band-deep-space",
    avionicsId: "deep-space-core",
    thermalId: "baseline-mli",
    shieldingId: "tantalum-poly-shield",
    reactionWheelId: "cmg-star-tracker",
  }).toSpacecraftSpec();
  const thermalFail = mechanics.simulateLaunch("super-heavy", coldMarsSpec, "MARS");
  assert.equal(thermalFail.success, false);
  assert.equal(thermalFail.failedPhaseId, "cruise");
  assert.equal(thermalFail.failureMode, "thermal-failure");
  assert.ok(thermalFail.failureFix.includes("MLI"));

  // Phase 6 (Cruise - Radiation): Unshielded basic-obc fries in MEO Van Allen belts
  const unshieldedMeoSpec = new SpacecraftConfig({
    ...DEFAULT_SELECTION,
    avionicsId: "basic-obc",
    propulsionId: "bipropellant",
    structureId: "medium-oct",
    thermalId: "heaters-mli",
    shieldingId: "none-shield",
  }).toSpacecraftSpec();
  const radFail = mechanics.simulateLaunch("medium-orbital", unshieldedMeoSpec, "MEO");
  assert.equal(radFail.success, false);
  assert.equal(radFail.failedPhaseId, "cruise");
  assert.equal(radFail.failureMode, "radiation-fried");
  assert.ok(radFail.failureCause.includes("radiation"));
  assert.ok(radFail.failureFix.includes("Radiation-Hardened"));

  // Phase 6 (Cruise - Solar Flux): Twin deployable (650 W @ 1 AU = 279 W @ Mars) fails power deficit at Mars
  const lowSolarMarsSpec = new SpacecraftConfig({
    structureId: "heavy-deep-space",
    solarPanelId: "twin-deployable",
    batteryId: "deep-space-cells",
    propulsionId: "bipropellant",
    antennaId: "ka-band-deep-space", // 240W + 110W + 60W + 48W = 458W load > 279W
    avionicsId: "deep-space-core",
    thermalId: "active-radiators",
    shieldingId: "tantalum-poly-shield",
    reactionWheelId: "cmg-star-tracker",
  }).toSpacecraftSpec();
  const solarFail = mechanics.simulateLaunch("super-heavy", lowSolarMarsSpec, "MARS");
  assert.equal(solarFail.success, false);
  assert.equal(solarFail.failedPhaseId, "cruise");
  assert.equal(solarFail.failureMode, "power-loss");
  assert.ok(solarFail.failureCause.includes("1.524 AU"));

  // Phase 1 (Liftoff): Overweight stack fails at liftoff with explosion
  const liftoffFail = mechanics.simulateLaunch("microlaunch", lowSolarMarsSpec, "LEO");
  assert.equal(liftoffFail.success, false);
  assert.equal(liftoffFail.failedPhaseId, "liftoff");
  assert.equal(liftoffFail.failureMode, "explosion");

  // Phase 4 (Deployment): Under-sized battery fails LEO eclipse
  const weakBatteryConfig = new SpacecraftConfig({
    ...DEFAULT_SELECTION,
    structureId: "medium-oct",
    solarPanelId: "deep-space-mega",
    batteryId: "li-ion-compact", // 400 Wh
    propulsionId: "xenon-ion", // 950 W draw -> ~445 Wh needed in 35-min eclipse
  });
  const weakBatterySpec = weakBatteryConfig.toSpacecraftSpec();
  const deployFail = mechanics.simulateLaunch("medium-orbital", weakBatterySpec, "LEO");
  assert.equal(deployFail.success, false);
  assert.equal(deployFail.failedPhaseId, "deployment");
  assert.equal(deployFail.failureMode, "power-loss");

  // Phase 6 (Cruise - Pointing): Coarse RCS pointing loses Ka-band lock on Mars
  const coarseMarsSpec = new SpacecraftConfig({
    structureId: "heavy-deep-space",
    solarPanelId: "deep-space-mega",
    batteryId: "deep-space-cells",
    propulsionId: "bipropellant",
    antennaId: "ka-band-deep-space",
    avionicsId: "deep-space-core",
    thermalId: "active-radiators",
    shieldingId: "tantalum-poly-shield",
    reactionWheelId: "baseline-rcs",
  }).toSpacecraftSpec();
  const pointingFail = mechanics.simulateLaunch("super-heavy", coarseMarsSpec, "MARS");
  assert.equal(pointingFail.success, false);
  assert.equal(pointingFail.failedPhaseId, "cruise");
  assert.equal(pointingFail.failureMode, "signal-lost");
  assert.ok(pointingFail.failureFix.includes("Reaction Wheel"));

  // Phase 7 (Orbit Insertion): Super-Heavy (13,800) + Hydrazine (~190 m/s) = 13,990 >= 13,250 TMI
  // so it clears Phase 5 TMI burn & Phase 6 Cruise, then misses Mars capture (14,650 required) at Phase 7!
  const shortCaptureMarsSpec = new SpacecraftConfig({
    structureId: "heavy-deep-space",
    solarPanelId: "deep-space-mega",
    batteryId: "deep-space-cells",
    propulsionId: "hydrazine-mono",
    antennaId: "ka-band-deep-space",
    avionicsId: "deep-space-core",
    thermalId: "active-radiators",
    shieldingId: "tantalum-poly-shield",
    reactionWheelId: "cmg-star-tracker",
  }).toSpacecraftSpec();
  const captureFail = mechanics.simulateLaunch("super-heavy", shortCaptureMarsSpec, "MARS");
  assert.equal(captureFail.success, false);
  assert.equal(captureFail.failedPhaseId, "orbit-insertion");
  assert.equal(captureFail.failureMode, "missed-capture");
});

test("KSC LC-39A launch site applies Earth-rotation bonus and inclination plane-change / azimuth costs", () => {
  const mechanics = new OrbitMechanics();
  const ksc = getLaunchSiteById(DEFAULT_LAUNCH_SITE_ID);

  assert.ok(LAUNCH_SITES.length >= 1);
  assert.equal(ksc.id, "ksc-lc39a");
  assert.equal(ksc.latitudeDeg, 28.6);
  assert.equal(ksc.longitudeDeg, -80.6);

  // v_rot = omega * R * cos(28.6°) ≈ 407.9 m/s (~408 m/s)
  const kscRot = calculateSiteRotationBonusMs(ksc);
  assert.ok(Math.abs(kscRot - 408) < 1.0, `Expected ~408 m/s, got ${kscRot}`);

  // LEO (28.6°): due east azimuth 90°, zero plane-change cost
  const leoBreakdown = mechanics.calculateSiteDeltaVBreakdown("LEO", ksc);
  assert.equal(leoBreakdown.rotationBonusMs, 408);
  assert.equal(leoBreakdown.inclinationPenaltyMs, 0);
  assert.equal(leoBreakdown.azimuthDeg, 90);
  assert.equal(leoBreakdown.penaltyKind, "none");
  assert.equal(leoBreakdown.effectiveDeltaVMs, 8992);

  // GEO (0°): combined apogee plane-change Δv (+360 m/s) from 28.6° parking orbit
  const geoBreakdown = mechanics.calculateSiteDeltaVBreakdown("GEO", ksc);
  assert.equal(geoBreakdown.rotationBonusMs, 408);
  assert.ok(geoBreakdown.planeChangeDeltaVMs > 300, `Expected GEO plane-change > 300, got ${geoBreakdown.planeChangeDeltaVMs}`);
  assert.equal(geoBreakdown.penaltyKind, "plane-change");
  assert.equal(geoBreakdown.effectiveDeltaVMs, 13500 - 408 + geoBreakdown.planeChangeDeltaVMs);

  // MEO (55°): northeast launch azimuth (~40.8°) loses part of Earth spin bonus
  const meoBreakdown = mechanics.calculateSiteDeltaVBreakdown("MEO", ksc);
  assert.ok(meoBreakdown.azimuthDeg < 45 && meoBreakdown.azimuthDeg > 35, `Got az ${meoBreakdown.azimuthDeg}`);
  assert.ok(meoBreakdown.azimuthPenaltyMs > 100, `Expected azimuth penalty > 100, got ${meoBreakdown.azimuthPenaltyMs}`);
  assert.equal(meoBreakdown.penaltyKind, "azimuth");

  // Equatorial site (0° lat): higher rotation bonus (~465 m/s) and zero GEO plane-change penalty
  const kourouLike = { id: "equatorial", name: "Equatorial Pad", latitudeDeg: 0, longitudeDeg: -52.8 };
  const eqGeoBreakdown = mechanics.calculateSiteDeltaVBreakdown("GEO", kourouLike);
  assert.ok(Math.abs(eqGeoBreakdown.rotationBonusMs - 465) <= 1);
  assert.equal(eqGeoBreakdown.planeChangeDeltaVMs, 0);

  // Launch result carries launchSiteId and site stats
  const leoSpec = new SpacecraftConfig(DEFAULT_SELECTION).toSpacecraftSpec();
  const launchRes = mechanics.simulateLaunch("medium-orbital", leoSpec, "LEO");
  assert.equal(launchRes.launchSiteId, "ksc-lc39a");
  assert.equal(launchRes.missionStats.rotationBonusMs, 408);
  assert.equal(launchRes.missionStats.launchAzimuthDeg, 90);
});

test("PlanetScene latLonToVector3 and LaunchAnimation anchor liftoff to KSC LC-39A surface normal", () => {
  const scene = new PlanetScene();
  scene.buildEarth("ksc-lc39a");

  const r = scene.getEarthRadius();
  const kscPos = scene.latLonToVector3(28.6, -80.6, r);
  assert.ok(Math.abs(kscPos.length() - r) < 1e-6);
  // 28.6°N -> +Y; -80.6°W -> +Z facing toward camera and slight +X
  assert.ok(kscPos.x > 0 && kscPos.y > 0 && kscPos.z > 0);

  const frame = scene.getLaunchSiteFrame("ksc-lc39a", 90);
  // Up (surface normal) and East (azimuth 90° heading) must be orthogonal unit vectors
  assert.ok(Math.abs(frame.up.length() - 1) < 1e-6);
  assert.ok(Math.abs(frame.heading.length() - 1) < 1e-6);
  assert.ok(Math.abs(frame.up.dot(frame.heading)) < 1e-6);
  // East from -80.6°W points predominantly along +X (over the Atlantic)
  assert.ok(frame.east.x > 0.9);

  // LaunchAnimation mounts stack on KSC pad along local surface normal
  const mechanics = new OrbitMechanics();
  const leoSpec = new SpacecraftConfig(DEFAULT_SELECTION).toSpacecraftSpec();
  const launchRes = mechanics.simulateLaunch("medium-orbital", leoSpec, "LEO");
  const anim = new LaunchAnimation();
  anim.start({ id: "medium-orbital" }, null, getOrbitById("LEO"), launchRes, { siteFrame: frame });

  const stack = anim.getGroup().getObjectByName("launch-vehicle-stack");
  assert.ok(stack);
  const stackDir = stack.position.clone().normalize();
  assert.ok(stackDir.distanceTo(frame.up) < 1e-5, "Rocket must stand directly above KSC LC-39A normal");

  anim.dispose?.();
  anim.reset();
  scene.dispose();
});

test("LaunchAnimation completely destroys spacecraft and vehicle stack on explosive failures and restores on replay", () => {
  const mechanics = new OrbitMechanics();
  const overloadedSpec = new SpacecraftConfig({
    structureId: "cubesat-6u",
    solarPanelId: "fixed-body",
    batteryId: "li-ion-compact",
    propulsionId: "xenon-ion",
    antennaId: "s-band-patch",
    avionicsId: "basic-obc",
  }).toSpacecraftSpec();
  const breakupResult = mechanics.simulateLaunch("medium-orbital", overloadedSpec, "LEO", {
    allowInvalid: true,
  });
  assert.equal(breakupResult.failureMode, "structural-breakup");

  const scGroup = new THREE.Group();
  scGroup.name = "assembled-spacecraft";
  const anim = new LaunchAnimation();

  const scenarios = [
    { mode: "structural-breakup", result: breakupResult },
    {
      mode: "explosion",
      result: {
        success: false,
        failureMode: "explosion",
        phases: [{ id: "liftoff", status: "failed" }],
      },
    },
    {
      mode: "suborbital-fall",
      result: {
        success: false,
        failureMode: "suborbital-fall",
        phases: [
          { id: "liftoff", status: "passed" },
          { id: "max-q", status: "passed" },
          { id: "ascent", status: "passed" },
          { id: "stage-sep", status: "passed" },
          { id: "orbit-insertion", status: "failed" },
        ],
      },
    },
  ];

  for (const { mode, result } of scenarios) {
    let failedInfo = null;
    let completed = false;
    anim.setSpeed(4);
    anim.start(
      { id: "medium-orbital" },
      { group: scGroup },
      getOrbitById("LEO"),
      result,
      {
        onPhaseUpdate: (_idx, _phase, meta) => {
          if (meta?.failed) failedInfo = meta;
        },
        onComplete: () => {
          completed = true;
        },
      }
    );

    const stack = anim.getGroup().getObjectByName("launch-vehicle-stack");
    assert.ok(stack, `${mode}: stack must exist at liftoff`);
    assert.equal(stack.visible, true, `${mode}: stack visible at liftoff`);
    assert.equal(scGroup.visible, true, `${mode}: spacecraft visible at liftoff`);

    for (let i = 0; i < 120 && !failedInfo; i++) {
      anim.update(0.08);
    }
    assert.ok(failedInfo, `${mode}: failure event must trigger`);
    assert.equal(failedInfo.failureMode, mode);
    assert.equal(stack.visible, false, `${mode}: vehicle stack must be hidden on destruction`);
    assert.equal(scGroup.visible, false, `${mode}: spacecraft must be completely hidden on destruction`);
    assert.ok(anim._fireballs.length > 0, `${mode}: explosion fireballs must spawn`);
    assert.ok(anim._debris.length > 0, `${mode}: shattered debris fragments must spawn`);

    const rotXAtBlast = stack.rotation.x;
    const rotZAtBlast = stack.rotation.z;
    for (let i = 0; i < 100; i++) {
      anim.update(0.08);
    }
    assert.equal(completed, true, `${mode}: onComplete must fire after hold window`);
    assert.equal(stack.visible, false, `${mode}: stack stays gone after explosion fades`);
    assert.equal(scGroup.visible, false, `${mode}: spacecraft stays gone after explosion fades`);
    assert.equal(stack.rotation.x, rotXAtBlast, `${mode}: hidden stack should not keep tumbling`);
    assert.equal(stack.rotation.z, rotZAtBlast, `${mode}: hidden stack should not keep tumbling`);
    assert.equal(anim._fireballs.length, 0, `${mode}: fireballs must clear cleanly`);
    assert.equal(anim._debris.length, 0, `${mode}: debris fragments must clear cleanly`);
  }

  // Replaying with the same spacecraft handle must restore visibility
  const okSpec = new SpacecraftConfig(DEFAULT_SELECTION).toSpacecraftSpec();
  const okResult = mechanics.simulateLaunch("medium-orbital", okSpec, "LEO");
  anim.start({ id: "medium-orbital" }, { group: scGroup }, getOrbitById("LEO"), okResult);
  assert.equal(scGroup.visible, true, "replaying launch must restore spacecraft visibility");

  anim.dispose?.();
  anim.reset();
});

test("LaunchAnimation breaks multi-part spacecraft into disappearing parts on explosion and skips explosion on insufficient-science", () => {
  const scGroup = new THREE.Group();
  scGroup.name = "assembled-spacecraft";
  const bus = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial());
  const solar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.4), new THREE.MeshStandardMaterial());
  scGroup.add(bus, solar);

  const anim = new LaunchAnimation();
  let warnMeta = null;
  anim.setSpeed(4);
  anim.start(
    { id: "medium-orbital" },
    { group: scGroup },
    getOrbitById("LEO"),
    {
      success: false,
      failureMode: "insufficient-science",
      phases: [{ id: "liftoff", status: "failed" }],
    },
    {
      onPhaseUpdate: (_idx, _phase, meta) => {
        if (meta?.warning) warnMeta = meta;
      },
    }
  );

  for (let i = 0; i < 120 && !warnMeta; i++) {
    anim.update(0.08);
  }
  assert.ok(warnMeta, "insufficient-science must emit warning telemetry");
  assert.equal(warnMeta.failed, false);
  assert.equal(anim._fireballs.length, 0, "insufficient-science must not spawn explosion fireballs");
  assert.equal(scGroup.visible, true, "insufficient-science must keep spacecraft visible");

  anim.dispose?.();
  anim.reset();
});
