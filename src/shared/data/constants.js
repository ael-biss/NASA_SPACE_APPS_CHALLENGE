/**
 * @file src/shared/data/constants.js
 * @owner Shared (All 4 members)
 * @goal Shared physical constants, orbital regime IDs, and game balance defaults
 *       used consistently across Mission, Spacecraft, and Launch calculations.
 */

export const PHYSICS = {
  STANDARD_GRAVITY_MS2: 9.80665,
  EARTH_RADIUS_KM: 6371,
  EARTH_MU_KM3_S2: 398600.4418,
};

export const ORBIT_IDS = {
  LEO: "LEO",
  MEO: "MEO",
  GEO: "GEO",
  LUNAR: "LUNAR",
};

export const GAME_PHASES = ["mission", "spacecraft", "launch", "results"];
// ── Flat named exports used by the Launch & Orbit module ──
// (additive: the PHYSICS object above is unchanged, so other members' code still works)
export const STANDARD_GRAVITY = PHYSICS.STANDARD_GRAVITY_MS2;   // m/s²
export const EARTH_RADIUS_KM = PHYSICS.EARTH_RADIUS_KM;         // km
// OrbitParameters.js works in metres, so convert km³/s² → m³/s² (×1e9)
export const EARTH_MU = PHYSICS.EARTH_MU_KM3_S2 * 1e9;          // m³/s²

