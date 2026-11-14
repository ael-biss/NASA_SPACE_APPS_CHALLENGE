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
