/**
 * @file src/modules/mission-science/__tests__/mission-science.test.js
 * @owner Member 1 (Mission & Science)
 * @goal Automated unit & headless Three.js tests for mission catalog, procedural 3D planet models
 *       (Earth, Moon, Mars), module lifecycle preview swapping, and mission evaluation.
 */

import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { GameState } from "../../../core/GameState.js";
import { MISSIONS, getMissions, getMissionById } from "../data/missions.js";
import {
  PLANET_BUILDERS,
  createEarthModel,
  createMoonModel,
  createMarsModel,
  createPlanetModel,
} from "../models/proceduralPlanets.js";
import { mount, update, unmount, evaluateMission } from "../index.js";

test("all missions define valid procedural planet models and lookup helpers work", () => {
  const missions = getMissions();
  assert.ok(missions.length >= 4);
  assert.equal(missions, MISSIONS);

  for (const mission of missions) {
    assert.ok(mission.model, `Mission ${mission.id} must define a model`);
    assert.ok(
      PLANET_BUILDERS[mission.model],
      `Mission ${mission.id} model "${mission.model}" must exist in PLANET_BUILDERS`
    );
    assert.equal(getMissionById(mission.id), mission);
  }
});

test("procedural planet builders construct Earth, Moon, and Mars THREE.Group models", () => {
  const cases = [
    { fn: createEarthModel, key: "procedural:earth", expectedName: "planet:earth" },
    { fn: createMoonModel, key: "procedural:moon", expectedName: "planet:moon" },
    { fn: createMarsModel, key: "procedural:mars", expectedName: "planet:mars" },
  ];

  for (const { fn, key, expectedName } of cases) {
    const direct = fn();
    assert.ok(direct instanceof THREE.Group);
    assert.equal(direct.name, expectedName);
    assert.ok(direct.children.length >= 2, `Expected multi-part 3D model for ${expectedName}`);

    const viaFactory = createPlanetModel(key);
    assert.equal(viaFactory.name, expectedName);
  }

  // Fallback mapping by destination / orbit ID
  assert.equal(createPlanetModel("LUNAR").name, "planet:moon");
  assert.equal(createPlanetModel("MARS").name, "planet:mars");
  assert.equal(createPlanetModel("GEO").name, "planet:earth");
});

test("mission-science mount/update/unmount swaps 3D planet models on mission change", () => {
  const scene = new THREE.Scene();
  const mockSceneManager = {
    scene,
    addObject: (obj) => scene.add(obj),
    removeObject: (obj) => scene.remove(obj),
    setCamera: () => {},
  };
  const mockUiContainer = {
    innerHTML: "",
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const gameState = new GameState();

  mount(mockSceneManager, gameState, mockUiContainer);

  const preview = scene.getObjectByName("mission-target-preview");
  assert.ok(preview, "Expected mission-target-preview group in scene");
  const holder = preview.getObjectByName("planet-holder");
  assert.ok(holder);
  assert.equal(holder.children[0]?.name, "planet:moon");

  // Switch to Earth Surface Observation -> swaps to Earth 3D model
  gameState.setMission({
    missionId: "MISSION_EARTH_LEO",
    title: "Earth Surface Observation",
    targetOrbitId: "LEO",
    budgetMillions: 130,
    minSciencePoints: 65,
    requiredDataRateKbps: 10,
    targetDistanceKm: 500,
    instruments: [],
  });
  assert.equal(holder.children.length, 1);
  assert.equal(holder.children[0].name, "planet:earth");

  // Switch to Mars Scientific Orbiter -> swaps to Mars 3D model
  gameState.setMission({
    missionId: "MISSION_MARS_ORBIT",
    title: "Mars Scientific Orbiter",
    targetOrbitId: "MARS",
    budgetMillions: 250,
    minSciencePoints: 90,
    requiredDataRateKbps: 5,
    targetDistanceKm: 225000000,
    instruments: [],
  });
  assert.equal(holder.children.length, 1);
  assert.equal(holder.children[0].name, "planet:mars");

  update(0.1);
  assert.ok(holder.rotation.y > 0);

  unmount();
  assert.equal(scene.getObjectByName("mission-target-preview"), undefined);
  assert.equal(mockUiContainer.innerHTML, "");
});

test("evaluateMission scores a valid mission using MissionEvaluator", () => {
  const gameState = new GameState();
  gameState.setMission({
    missionId: "MISSION_EARTH_LEO",
    title: "Earth Surface Observation",
    targetOrbitId: "LEO",
    budgetMillions: 110,
    minSciencePoints: 40,
    requiredDataRateKbps: 10,
    targetDistanceKm: 500,
    instruments: [
      {
        id: "INS_CAM_01",
        name: "Optical Camera",
        massKg: 12,
        powerWatts: 25,
        dataRateKbps: 8000,
        costMillions: 15,
        sciencePoints: 45,
      },
    ],
  });
  gameState.setSpacecraft({
    selection: {},
    dryMassKg: 120,
    propellantMassKg: 40,
    totalMassKg: 160,
    powerGeneratedWatts: 400,
    powerConsumedWatts: 150,
    maxRangeKm: 2000,
    maxDataRateKbps: 5000,
    costMillions: 25,
    deltaVMs: 1200,
    isValid: true,
    errors: [],
    warnings: [],
  });
  gameState.setLaunch({
    rocketId: "small-launcher",
    targetOrbitId: "LEO",
    launchCostMillions: 20,
    success: true,
    achievedDeltaVMs: 9500,
    requiredDeltaVMs: 9300,
  });

  const result = evaluateMission(gameState);
  assert.equal(result.score, 100);
  assert.equal(result.grade, "A");
});
