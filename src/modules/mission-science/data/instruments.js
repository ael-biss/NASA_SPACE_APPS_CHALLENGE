
/**
 * @file src/modules/mission-science/data/instruments.js
 * @owner Member 1 (Mission & Science)
 * @goal Database of scientific instruments with their scientific
 *       capabilities and engineering trade-offs.
 */

export const INSTRUMENTS = [
  {
    id: "INS_CAM_01",
    name: "Optical Camera",
    category: "Imaging",
    description:
      "Captures visible-light images to observe planetary surfaces, geological formations and atmospheric features.",
    measurement: "Visible-light images",
    scientificPurpose: "Surface imaging and geological mapping",
    compatibleObjectives: [
      "OBJ_SURFACE_IMAGING",
      "OBJ_GEOLOGICAL_MAPPING",
      "OBJ_CLOUD_OBSERVATION"
    ],
    applicableTargets: ["Earth", "Moon", "Mars"],
    isActive: false,

    massKg: 12,
    powerWatts: 25,
    dataRateKbps: 8000,
    costMillions: 15,
    sciencePoints: 20,

    model: "procedural:optical-camera",
    resolution: "High spatial resolution",
    sensitivity: "Visible-light detection",
    measurementRange: "Visible spectrum (approximately 400–700 nm)",
    limitations: [
      "Requires suitable illumination for reflected-light imaging.",
      "Cannot directly observe beneath opaque surfaces.",
      "Image quality depends on observation distance and conditions."
    ]
  },

  {
    id: "INS_SPEC_01",
    name: "Infrared Spectrometer",
    category: "Spectroscopy",
    description:
      "Measures infrared radiation at different wavelengths to help identify minerals, surface materials and atmospheric properties.",
    measurement: "Infrared spectral signatures",
    scientificPurpose: "Surface composition and atmospheric analysis",
    compatibleObjectives: [
      "OBJ_MINERAL_ANALYSIS",
      "OBJ_SURFACE_COMPOSITION",
      "OBJ_ATMOSPHERIC_STUDY"
    ],
    applicableTargets: ["Earth", "Moon", "Mars"],
    isActive: false,

    massKg: 18,
    powerWatts: 35,
    dataRateKbps: 5000,
    costMillions: 20,
    sciencePoints: 25,

    model: "procedural:infrared-spectrometer",
    resolution: "Spectral resolution depends on instrument design",
    sensitivity: "Infrared radiation detection",
    measurementRange: "Infrared wavelengths (instrument-dependent)",
    limitations: [
      "Atmospheric and thermal interference may affect measurements.",
      "Different materials can produce overlapping spectral signatures.",
      "Measurements require calibration and scientific interpretation."
    ]
  },

  {
    id: "INS_RAD_01",
    name: "Radar Sounder",
    category: "Radar",
    description:
      "Transmits radio waves and analyzes their echoes to investigate surface properties and possible subsurface structures.",
    measurement: "Radio-wave reflections",
    scientificPurpose: "Surface structure and subsurface investigation",
    compatibleObjectives: [
      "OBJ_SUBSURFACE_MAPPING",
      "OBJ_ICE_DETECTION",
      "OBJ_SURFACE_STRUCTURE"
    ],
    applicableTargets: ["Earth", "Moon", "Mars"],
    isActive: true,

    massKg: 35,
    powerWatts: 90,
    dataRateKbps: 12000,
    costMillions: 30,
    sciencePoints: 30,

    model: "procedural:radar-sounder",
    resolution: "Depends on radar frequency and system design",
    sensitivity: "Reflected radio-wave detection",
    measurementRange: "Radio-frequency range (instrument-dependent)",
    limitations: [
      "Subsurface penetration depends on material properties and frequency.",
      "Interpretation of radar echoes can be ambiguous.",
      "Requires additional power to transmit radar signals."
    ]
  },

  {
    id: "INS_MAG_01",
    name: "Magnetometer",
    category: "Space Physics",
    description:
      "Measures the strength and direction of magnetic fields to investigate planetary magnetic environments and interactions with solar wind.",
    measurement: "Magnetic field strength and direction",
    scientificPurpose: "Planetary magnetic field investigation",
    compatibleObjectives: [
      "OBJ_MAGNETIC_FIELD",
      "OBJ_SOLAR_WIND_INTERACTION",
      "OBJ_SPACE_ENVIRONMENT"
    ],
    applicableTargets: ["Earth", "Moon", "Mars"],
    isActive: false,

    massKg: 5,
    powerWatts: 10,
    dataRateKbps: 1000,
    costMillions: 10,
    sciencePoints: 25,

    model: "procedural:magnetometer",
    resolution: "Magnetic field measurement resolution depends on sensor design",
    sensitivity: "Detection of magnetic field variations",
    measurementRange: "Instrument-dependent magnetic field range",
    limitations: [
      "Spacecraft-generated magnetic interference can affect measurements.",
      "Usually requires careful positioning and calibration.",
      "Does not directly determine surface chemical composition."
    ]
  },

  {
    id: "INS_MASS_01",
    name: "Mass Spectrometer",
    category: "Spectroscopy",
    model: "procedural:mass-spectrometer",
    description: "Analyzes the chemical composition of gases and particles.",
    measurement: "Mass-to-charge ratio of ions",
    scientificPurpose: "Identify chemical compounds, atmospheric gases, and volatile substances.",
    compatibleObjectives: [
      "OBJ_CHEMICAL_COMPOSITION",
      "OBJ_VOLATILE_ANALYSIS",
      "OBJ_ATMOSPHERIC_STUDY"
    ],
    applicableTargets: ["Earth", "Moon", "Mars"],
    isActive: false,

    massKg: 8,
    powerWatts: 30,
    dataRateKbps: 2000,
    costMillions: 25,
    sciencePoints: 30,

    resolution: "High mass resolution",
    sensitivity: "Detects trace chemical compounds",
    measurementRange: "Mass-to-charge ratio of ions",
    limitations: [
      "Requires calibration",
      "Can be affected by contamination",
      "Some measurements require gas or particle samples"
    ]
  },

  {
    id: "INS_LIDAR_01",
    name: "Laser Altimeter (LIDAR)",
    category: "Remote Sensing",
    model: "procedural:laser-altimeter",
    description: "Uses laser pulses to measure distances and surface elevation.",
    measurement: "Laser pulse travel time",
    scientificPurpose: "Create detailed topographic maps and measure surface elevation.",
    compatibleObjectives: [
      "OBJ_SURFACE_TOPOGRAPHY",
      "OBJ_GEOLOGICAL_MAPPING",
      "OBJ_SURFACE_STRUCTURE"
    ],
    applicableTargets: ["Earth", "Moon", "Mars"],
    isActive: true,

    massKg: 21.4,
    powerWatts: 59,
    dataRateKbps: 4000,
    costMillions: 28,
    sciencePoints: 30,

    resolution: "High-resolution distance measurements",
    sensitivity: "Sensitive to reflected laser pulses",
    measurementRange: "Distance between spacecraft and surface",
    limitations: [
      "Requires a clear line of sight",
      "Surface reflectivity affects measurements",
      "Limited coverage compared with wide-angle cameras"
    ]
  },

  {
    id: "INS_UV_01",
    name: "Ultraviolet Spectrometer",
    category: "Spectroscopy",
    model: "procedural:uv-spectrometer",
    description: "Measures ultraviolet light emitted, absorbed, or reflected by a target.",
    measurement: "Ultraviolet spectral signatures",
    scientificPurpose: "Study atmospheric composition, upper atmospheres, and surface materials.",
    compatibleObjectives: [
      "OBJ_ATMOSPHERIC_STUDY",
      "OBJ_CHEMICAL_COMPOSITION",
      "OBJ_SPACE_ENVIRONMENT"
    ],
    applicableTargets: ["Earth", "Moon", "Mars"],
    isActive: false,

    massKg: 12,
    powerWatts: 22,
    dataRateKbps: 3000,
    costMillions: 18,
    sciencePoints: 25,

    resolution: "Moderate to high spectral resolution",
    sensitivity: "Detects ultraviolet radiation",
    measurementRange: "Ultraviolet spectrum (approximately 10–400 nm)",
    limitations: [
      "Some UV wavelengths are absorbed by atmospheres",
      "Requires careful calibration",
      "Sensitive to background radiation"
    ]
  },

  {
    id: "INS_THERMAL_01",
    name: "Thermal Infrared Imager",
    category: "Imaging",
    model: "procedural:thermal-imager",
    description: "Captures infrared radiation to map surface temperatures.",
    measurement: "Thermal infrared radiation",
    scientificPurpose: "Study temperature variations, thermal properties, and geological activity.",
    compatibleObjectives: [
      "OBJ_THERMAL_MAPPING",
      "OBJ_SURFACE_COMPOSITION",
      "OBJ_GEOLOGICAL_MAPPING"
    ],
    applicableTargets: ["Earth", "Moon", "Mars"],
    isActive: false,

    massKg: 10,
    powerWatts: 20,
    dataRateKbps: 6000,
    costMillions: 16,
    sciencePoints: 25,

    resolution: "Moderate spatial resolution",
    sensitivity: "Sensitive to thermal radiation",
    measurementRange: "Thermal infrared spectrum (approximately 8–14 μm)",
    limitations: [
      "Measurements depend on surface temperature",
      "Atmospheric conditions can interfere",
      "Requires thermal calibration"
    ]
  },

  {
    id: "INS_PARTICLE_01",
    name: "Particle Detector",
    category: "Space Physics",
    model: "procedural:particle-detector",
    description: "Detects energetic charged particles in the space environment.",
    measurement: "Particle energy and flux",
    scientificPurpose: "Study solar wind, radiation environments, and charged particles.",
    compatibleObjectives: [
      "OBJ_SOLAR_WIND_INTERACTION",
      "OBJ_SPACE_ENVIRONMENT",
      "OBJ_RADIATION_ENVIRONMENT"
    ],
    applicableTargets: ["Earth", "Moon", "Mars"],
    isActive: false,

    massKg: 6,
    powerWatts: 15,
    dataRateKbps: 2000,
    costMillions: 14,
    sciencePoints: 25,

    resolution: "Energy-dependent particle measurements",
    sensitivity: "Detects energetic charged particles",
    measurementRange: "Particle energy and flux",
    limitations: [
      "Limited detection range depending on detector design",
      "Can be affected by background radiation",
      "Requires shielding and calibration"
    ]
  },

  {
    id: "INS_SEISM_01",
    name: "Seismometer",
    category: "Geophysics",
    model: "procedural:seismometer",
    description: "Measures ground vibrations and seismic activity.",
    measurement: "Ground motion and seismic waves",
    scientificPurpose: "Investigate planetary interiors, tectonic activity, and internal structure.",
    compatibleObjectives: [
      "OBJ_SEISMIC_ACTIVITY",
      "OBJ_INTERIOR_STRUCTURE"
    ],
    applicableTargets: ["Earth", "Moon", "Mars"],
    isActive: false,

    massKg: 5,
    powerWatts: 8,
    dataRateKbps: 1000,
    costMillions: 12,
    sciencePoints: 30,

    resolution: "High sensitivity to ground motion",
    sensitivity: "Detects small ground vibrations",
    measurementRange: "Seismic frequencies and ground displacement",
    limitations: [
      "Requires stable mounting or surface contact",
      "Sensitive to mechanical interference",
      "Provides limited information without long observation periods"
    ]
  }
];

/**
 * Return all available scientific instruments.
 * @returns {Array<import('../../../shared/interfaces/MissionSpec.js').InstrumentSelection>}
 */
export function getInstruments() {
  return INSTRUMENTS;
}

/**
 * Find a scientific instrument by ID.
 * @param {string} instrumentId
 * @returns {import('../../../shared/interfaces/MissionSpec.js').InstrumentSelection | undefined}
 */
export function getInstrumentById(instrumentId) {
  return INSTRUMENTS.find((i) => i.id === instrumentId);
}
