/**
 * @file src/shared/interfaces/__tests__/SpacecraftSpec.test.js
 * @owner Shared (Produced by Member 2: Spacecraft Design; consumed by Members 1, 3, 4)
 * @goal Unit tests for SpacecraftSpec default construction and contract validation.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  createDefaultSpacecraftSpec,
  validateSpacecraftSpec,
} from "../SpacecraftSpec.js";
import { DEFAULT_SELECTION } from "../../../modules/spacecraft-design/data/components.js";
import { SpacecraftConfig } from "../../../modules/spacecraft-design/logic/SpacecraftConfig.js";

test("createDefaultSpacecraftSpec initializes all contract fields", () => {
  const spec = createDefaultSpacecraftSpec();

  assert.equal(spec.isValid, false);
  assert.deepEqual(spec.errors, ["Spacecraft not configured yet."]);
  assert.deepEqual(spec.warnings, []);
  assert.equal(spec.carriedMassKg, 0);
  assert.equal(spec.maxPayloadMassKg, 0);
  assert.equal(spec.batteryCapacityWh, 0);
  assert.equal(spec.deltaVMs, 0);
  assert.equal(spec.selection.structureId, "");
  assert.equal(spec.selection.avionicsId, "");
});

test("validateSpacecraftSpec rejects null, default, and incomplete specs", () => {
  const nullResult = validateSpacecraftSpec(null);
  assert.equal(nullResult.valid, false);
  assert.ok(nullResult.errors.length > 0);

  const defaultResult = validateSpacecraftSpec(createDefaultSpacecraftSpec());
  assert.equal(defaultResult.valid, false);
  assert.deepEqual(defaultResult.errors, ["Spacecraft not configured yet."]);

  const partial = createDefaultSpacecraftSpec();
  partial.selection.structureId = "smallsat-hex";
  partial.errors = [];
  partial.isValid = true;
  const partialResult = validateSpacecraftSpec(partial);
  assert.equal(partialResult.valid, false);
  assert.ok(partialResult.errors.some((e) => e.includes("Missing required subsystem")));
});

test("validateSpacecraftSpec accepts valid SpacecraftConfig output and legacy 13-field mocks", () => {
  const config = new SpacecraftConfig(DEFAULT_SELECTION);
  const spec = config.toSpacecraftSpec();
  const result = validateSpacecraftSpec(spec);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);

  // Legacy mock omitting carriedMassKg, maxPayloadMassKg, batteryCapacityWh, deltaVMs
  const legacySpec = {
    selection: { ...DEFAULT_SELECTION },
    dryMassKg: 200,
    propellantMassKg: 80,
    totalMassKg: 280,
    powerGeneratedWatts: 600,
    powerConsumedWatts: 250,
    ispSeconds: 230,
    maxDataRateKbps: 2048,
    maxRangeKm: 50000,
    costMillions: 25,
    isValid: true,
    errors: [],
    warnings: [],
  };
  const legacyResult = validateSpacecraftSpec(legacySpec);
  assert.equal(legacyResult.valid, true);
  assert.deepEqual(legacyResult.errors, []);
});

test("validateSpacecraftSpec catches numeric, mass, and power bound violations", () => {
  const config = new SpacecraftConfig(DEFAULT_SELECTION);
  const spec = config.toSpacecraftSpec();
  spec.totalMassKg = spec.dryMassKg - 10;
  spec.powerGeneratedWatts = 100;
  spec.powerConsumedWatts = 300;
  spec.costMillions = -5;

  const result = validateSpacecraftSpec(spec);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("wet mass")));
  assert.ok(result.errors.some((e) => e.includes("Power generated")));
  assert.ok(result.errors.some((e) => e.includes("costMillions")));
});
