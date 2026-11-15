
/**
 * @file src/modules/mission-science/data/missions.js
 * @owner Member 1 (Mission & Science)
 * @goal Catalog of selectable space mission scenarios.
 *
 * NOTE:
 * Budget caps and science scores are game-balancing values.
 * Mission distances are representative approximations, not fixed
 * distances for actual spacecraft trajectories.
 */

export const MISSIONS = [

  // --------------------------------------------------
  // 1. EARTH SURFACE OBSERVATION
  // --------------------------------------------------

  {
    id: "MISSION_EARTH_LEO",
    name: "Earth Surface Observation",
    destination: "Earth",
    model: "procedural:earth",

    description:
      "Observe Earth's surface to investigate geological features, environmental changes and land conditions.",

    targetOrbit: "Low Earth Orbit (LEO)",

    objectives: [
      "OBJ_SURFACE_IMAGING",
      "OBJ_GEOLOGICAL_MAPPING",
      "OBJ_SURFACE_COMPOSITION",
      "OBJ_SURFACE_TOPOGRAPHY",
      "OBJ_THERMAL_MAPPING"
    ],

    recommendedInstrumentIds: [
      "INS_CAM_01",
      "INS_SPEC_01",
      "INS_RAD_01",
      "INS_LIDAR_01",
      "INS_THERMAL_01"
    ],

    budgetCap: 110,
    minScienceScore: 65,
    requiredDownlinkDataRate: 10,
    missionDistance: 500
  },


  // --------------------------------------------------
  // 2. WEATHER AND CLIMATE OBSERVATION
  // --------------------------------------------------

  {
    id: "MISSION_WEATHER_GEO",
    name: "Weather and Climate Observation",
    destination: "Earth",
    model: "procedural:earth",

    description:
      "Monitor atmospheric conditions, cloud formations, temperature variations and atmospheric chemical composition from geostationary orbit.",

    targetOrbit: "Geostationary Orbit (GEO)",

    objectives: [
      "OBJ_CLOUD_OBSERVATION",
      "OBJ_ATMOSPHERIC_STUDY",
      "OBJ_THERMAL_MAPPING",
      "OBJ_CHEMICAL_COMPOSITION"
    ],

    recommendedInstrumentIds: [
      "INS_CAM_01",
      "INS_SPEC_01",
      "INS_UV_01",
      "INS_THERMAL_01",
      "INS_MASS_01"
    ],

    budgetCap: 130,
    minScienceScore: 65,
    requiredDownlinkDataRate: 15,
    missionDistance: 35786
  },


  // --------------------------------------------------
  // 3. EARTH SPACE WEATHER
  // --------------------------------------------------

  {
    id: "MISSION_EARTH_SPACE_WEATHER",
    name: "Earth Space Weather Monitoring",
    destination: "Earth",
    model: "procedural:earth",

    description:
      "Investigate Earth's magnetosphere, solar wind interactions and energetic particle radiation to understand space weather hazards.",

    targetOrbit: "Highly Elliptical Orbit (HEO)",

    objectives: [
      "OBJ_MAGNETIC_FIELD",
      "OBJ_SOLAR_WIND_INTERACTION",
      "OBJ_SPACE_ENVIRONMENT",
      "OBJ_RADIATION_ENVIRONMENT"
    ],

    recommendedInstrumentIds: [
      "INS_MAG_01",
      "INS_PARTICLE_01",
      "INS_UV_01"
    ],

    budgetCap: 125,
    minScienceScore: 60,
    requiredDownlinkDataRate: 5,
    missionDistance: 40000
  },


  // --------------------------------------------------
  // 4. LUNAR POLAR EXPLORATION
  // --------------------------------------------------

  {
    id: "MISSION_LUNAR_ORBIT",
    name: "Lunar Polar Exploration",
    destination: "Moon",
    model: "procedural:moon",

    description:
      "Investigate lunar polar regions, search for water ice deposits and map surface composition, topography and thermal conditions.",

    targetOrbit: "Low Lunar Polar Orbit",

    objectives: [
      "OBJ_GEOLOGICAL_MAPPING",
      "OBJ_ICE_DETECTION",
      "OBJ_MINERAL_ANALYSIS",
      "OBJ_SUBSURFACE_MAPPING",
      "OBJ_SURFACE_TOPOGRAPHY",
      "OBJ_THERMAL_MAPPING"
    ],

    recommendedInstrumentIds: [
      "INS_CAM_01",
      "INS_SPEC_01",
      "INS_RAD_01",
      "INS_LIDAR_01",
      "INS_THERMAL_01",
      "INS_MASS_01"
    ],

    budgetCap: 190,
    minScienceScore: 85,
    requiredDownlinkDataRate: 8,
    missionDistance: 384400
  },


  // --------------------------------------------------
  // 5. LUNAR SURFACE GEOPHYSICS
  // --------------------------------------------------

  {
    id: "MISSION_LUNAR_GEOPHYSICS",
    name: "Lunar Surface Geophysics",
    destination: "Moon",
    model: "procedural:moon",

    description:
      "Deploy scientific instruments on the lunar surface to investigate seismic activity, internal structure and local chemical composition.",

    targetOrbit: "Lunar Surface",

    objectives: [
      "OBJ_SEISMIC_ACTIVITY",
      "OBJ_INTERIOR_STRUCTURE",
      "OBJ_CHEMICAL_COMPOSITION",
      "OBJ_THERMAL_MAPPING",
      "OBJ_SURFACE_IMAGING"
    ],

    recommendedInstrumentIds: [
      "INS_SEISM_01",
      "INS_MASS_01",
      "INS_CAM_01",
      "INS_THERMAL_01"
    ],

    budgetCap: 160,
    minScienceScore: 75,
    requiredDownlinkDataRate: 2,
    missionDistance: 384400
  },


  // --------------------------------------------------
  // 6. MARS SCIENTIFIC ORBITER
  // --------------------------------------------------

  {
    id: "MISSION_MARS_ORBIT",
    name: "Mars Scientific Orbiter",
    destination: "Mars",
    model: "procedural:mars",

    description:
      "Study the Martian surface, investigate possible subsurface ice deposits and analyze the planet's geological and magnetic environment.",

    targetOrbit: "Mars Polar Orbit",

    objectives: [
      "OBJ_GEOLOGICAL_MAPPING",
      "OBJ_ICE_DETECTION",
      "OBJ_MINERAL_ANALYSIS",
      "OBJ_MAGNETIC_FIELD",
      "OBJ_SURFACE_TOPOGRAPHY",
      "OBJ_ATMOSPHERIC_STUDY"
    ],

    recommendedInstrumentIds: [
      "INS_CAM_01",
      "INS_SPEC_01",
      "INS_RAD_01",
      "INS_MAG_01",
      "INS_LIDAR_01",
      "INS_UV_01"
    ],

    budgetCap: 250,
    minScienceScore: 90,
    requiredDownlinkDataRate: 5,
    missionDistance: 225000000
  },


  // --------------------------------------------------
  // 7. MARS SURFACE EXPLORATION
  // --------------------------------------------------

  {
    id: "MISSION_MARS_SURFACE",
    name: "Mars Surface Exploration",
    destination: "Mars",
    model: "procedural:mars",

    description:
      "Deploy a scientific lander to investigate Martian surface geology, chemical composition, thermal properties and seismic activity.",

    targetOrbit: "Mars Surface",

    objectives: [
      "OBJ_SURFACE_IMAGING",
      "OBJ_CHEMICAL_COMPOSITION",
      "OBJ_SEISMIC_ACTIVITY",
      "OBJ_INTERIOR_STRUCTURE",
      "OBJ_THERMAL_MAPPING",
      "OBJ_SURFACE_TOPOGRAPHY"
    ],

    recommendedInstrumentIds: [
      "INS_CAM_01",
      "INS_MASS_01",
      "INS_SEISM_01",
      "INS_THERMAL_01",
      "INS_LIDAR_01",
      "INS_PARTICLE_01"
    ],

    budgetCap: 220,
    minScienceScore: 85,
    requiredDownlinkDataRate: 3,
    missionDistance: 225000000
  }

];


/**
 * Return all available mission scenarios.
 * @returns {Array<Object>}
 */
export function getMissions() {
  return MISSIONS;
}


/**
 * Find a mission scenario by ID.
 * @param {string} missionId
 * @returns {Object | undefined}
 */
export function getMissionById(missionId) {
  return MISSIONS.find((m) => m.id === missionId);
}

