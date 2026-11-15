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
  MOON_RADIUS_KM: 1737.4,
  MOON_MU_KM3_S2: 4902.800066,
  MARS_RADIUS_KM: 3389.5,
  MARS_MU_KM3_S2: 42828.375214,
  SPEED_OF_LIGHT_KMS: 299792.458,
  SOLAR_CONSTANT_WM2: 1361,
  AIR_DENSITY_SEA_LEVEL_KGM3: 1.225,
  EARTH_SIDEREAL_OMEGA_RAD_S: 7.2921159e-5,
};

export const ORBIT_IDS = {
  LEO: "LEO",
  MEO: "MEO",
  GEO: "GEO",
  HEO: "HEO",
  LUNAR: "LUNAR",
  MARS: "MARS",
};

export const GAME_PHASES = ["mission", "spacecraft", "launch", "results"];
