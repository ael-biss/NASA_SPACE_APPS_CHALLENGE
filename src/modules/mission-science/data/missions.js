/**
 * @file src/modules/mission-science/data/missions.js
 * @owner Member 1 (Mission & Science)
 * @goal Catalog of realistic NASA-inspired space mission scenarios with target orbits,
 *       real physical environments (distance, solar flux, radiation, thermal bounds),
 *       budget caps, and science targets.
 */

export const MISSIONS = [
  // --------------------------------------------------
  // 1. LUNAR POLAR EXPLORATION (LRO-like — Featured First Mission)
  // --------------------------------------------------
  {
    id: "MISSION_LUNAR_ORBIT",
    name: "Lunar Polar Exploration (LRO-Class)",
    destination: "Moon",
    model: "procedural:moon",
    difficulty: "Medium · Featured NASA Mission",
    nasaReference: "Inspired by NASA Lunar Reconnaissance Orbiter (2009)",
    description:
      "Enter a 50 km lunar polar orbit to map topography, search permanently shadowed craters for water ice, and measure thermal & radiation conditions. Requires ~3.13 km/s Trans-Lunar Injection + ~0.89 km/s Lunar Orbit Insertion.",
    targetOrbit: "Low Lunar Polar Orbit",
    targetOrbitId: "LUNAR",
    objectives: [
      "OBJ_GEOLOGICAL_MAPPING",
      "OBJ_ICE_DETECTION",
      "OBJ_MINERAL_ANALYSIS",
      "OBJ_SUBSURFACE_MAPPING",
      "OBJ_SURFACE_TOPOGRAPHY",
      "OBJ_THERMAL_MAPPING",
    ],
    recommendedInstrumentIds: [
      "INS_CAM_01",
      "INS_SPEC_01",
      "INS_LIDAR_01",
      "INS_THERMAL_01",
    ],
    budgetCap: 230,
    minScienceScore: 85,
    requiredDownlinkDataRate: 8,
    missionDistance: 384400,
    realReferenceMassKg: 1916,
    realReference: {
      name: "NASA LRO (2009)",
      massKg: 1916,
      orbitLabel: "50 km Lunar Polar Orbit",
      costMillions: 504,
      launcher: "Atlas V 401",
    },
  },

  // --------------------------------------------------
  // 2. MARS SCIENTIFIC ORBITER (MAVEN-like — Deep Space Hard Mission)
  // --------------------------------------------------
  {
    id: "MISSION_MARS_ORBIT",
    name: "Mars Atmospheric & Polar Orbiter (MAVEN-Class)",
    destination: "Mars",
    model: "procedural:mars",
    difficulty: "Hard · Deep Space",
    nasaReference: "Inspired by NASA MAVEN Mars Orbiter (2013)",
    description:
      "Cruise 225 million km to Mars (12.5-minute one-way signal delay, 43% solar flux) and capture into Mars polar orbit to study atmospheric escape, magnetic fields, and subsurface ice.",
    targetOrbit: "Mars Polar Orbit",
    targetOrbitId: "MARS",
    objectives: [
      "OBJ_GEOLOGICAL_MAPPING",
      "OBJ_ICE_DETECTION",
      "OBJ_MINERAL_ANALYSIS",
      "OBJ_MAGNETIC_FIELD",
      "OBJ_SURFACE_TOPOGRAPHY",
      "OBJ_ATMOSPHERIC_STUDY",
      "OBJ_SOLAR_WIND_INTERACTION",
      "OBJ_RADIATION_ENVIRONMENT",
      "OBJ_CHEMICAL_COMPOSITION",
    ],
    recommendedInstrumentIds: [
      "INS_UV_01",
      "INS_MAG_01",
      "INS_PARTICLE_01",
      "INS_MASS_01",
      "INS_CAM_01",
    ],
    budgetCap: 330,
    minScienceScore: 95,
    requiredDownlinkDataRate: 5,
    missionDistance: 225000000,
    realReferenceMassKg: 2454,
    realReference: {
      name: "NASA MAVEN (2013)",
      massKg: 2454,
      orbitLabel: "Mars Elliptical Polar",
      costMillions: 671,
      launcher: "Atlas V 401",
    },
  },

  // --------------------------------------------------
  // 3. EARTH SURFACE OBSERVATION (Landsat-like — Easy)
  // --------------------------------------------------
  {
    id: "MISSION_EARTH_LEO",
    name: "Earth Surface Observation (Landsat-Class)",
    destination: "Earth",
    model: "procedural:earth",
    difficulty: "Easy · LEO",
    nasaReference: "Inspired by NASA/USGS Landsat Earth Observers",
    description:
      "Observe Earth's surface from 500 km Low Earth Orbit to monitor land cover, thermal anomalies, and geological change with high-rate downlink.",
    targetOrbit: "Low Earth Orbit (LEO)",
    targetOrbitId: "LEO",
    objectives: [
      "OBJ_SURFACE_IMAGING",
      "OBJ_GEOLOGICAL_MAPPING",
      "OBJ_SURFACE_COMPOSITION",
      "OBJ_SURFACE_TOPOGRAPHY",
      "OBJ_THERMAL_MAPPING",
    ],
    recommendedInstrumentIds: [
      "INS_CAM_01",
      "INS_SPEC_01",
      "INS_THERMAL_01",
    ],
    budgetCap: 130,
    minScienceScore: 65,
    requiredDownlinkDataRate: 10,
    missionDistance: 500,
    realReferenceMassKg: 950,
    realReference: {
      name: "Landsat 1 (1972)",
      massKg: 953,
      orbitLabel: "900 km Polar LEO",
      costMillions: 120,
      launcher: "Delta 0900",
    },
  },

  // --------------------------------------------------
  // 4. WEATHER AND CLIMATE OBSERVATION (GOES-like — Medium)
  // --------------------------------------------------
  {
    id: "MISSION_WEATHER_GEO",
    name: "Geostationary Weather Relay (GOES-Class)",
    destination: "Earth",
    model: "procedural:earth",
    difficulty: "Medium · GEO",
    nasaReference: "Inspired by NOAA/NASA GOES Weather Satellites",
    description:
      "Climb to 35,786 km Geostationary Orbit to continuously track storms, cloud cover, and atmospheric chemistry over a fixed hemisphere.",
    targetOrbit: "Geostationary Orbit (GEO)",
    targetOrbitId: "GEO",
    objectives: [
      "OBJ_CLOUD_OBSERVATION",
      "OBJ_ATMOSPHERIC_STUDY",
      "OBJ_THERMAL_MAPPING",
      "OBJ_CHEMICAL_COMPOSITION",
    ],
    recommendedInstrumentIds: [
      "INS_CAM_01",
      "INS_THERMAL_01",
      "INS_UV_01",
    ],
    budgetCap: 175,
    minScienceScore: 65,
    requiredDownlinkDataRate: 15,
    missionDistance: 35786,
    realReferenceMassKg: 1450,
    realReference: {
      name: "GOES-16 / NOAA (2016)",
      massKg: 2857,
      orbitLabel: "35,786 km Geostationary",
      costMillions: 540,
      launcher: "Atlas V 541",
    },
  },

  // --------------------------------------------------
  // 5. EARTH SPACE WEATHER (Van Allen Probes-like — Medium)
  // --------------------------------------------------
  {
    id: "MISSION_EARTH_SPACE_WEATHER",
    name: "Magnetosphere & Radiation Probe (Van Allen-Class)",
    destination: "Earth",
    model: "procedural:earth",
    difficulty: "Medium · High Radiation",
    nasaReference: "Inspired by NASA Van Allen Probes",
    description:
      "Operate in high-radiation elliptical orbits traversing the Van Allen belts to measure solar wind coupling and energetic particle hazards.",
    targetOrbit: "Medium / High Radiation Orbit (MEO)",
    targetOrbitId: "MEO",
    objectives: [
      "OBJ_MAGNETIC_FIELD",
      "OBJ_SOLAR_WIND_INTERACTION",
      "OBJ_SPACE_ENVIRONMENT",
      "OBJ_RADIATION_ENVIRONMENT",
    ],
    recommendedInstrumentIds: [
      "INS_MAG_01",
      "INS_PARTICLE_01",
      "INS_UV_01",
    ],
    budgetCap: 155,
    minScienceScore: 60,
    requiredDownlinkDataRate: 5,
    missionDistance: 20200,
    realReferenceMassKg: 660,
    realReference: {
      name: "Van Allen Probes (2012)",
      massKg: 662,
      orbitLabel: "600×30,600 km MEO",
      costMillions: 343,
      launcher: "Atlas V 401",
    },
  },
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
