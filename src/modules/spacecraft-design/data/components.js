/**
 * @file src/modules/spacecraft-design/data/components.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Component database defining selectable spacecraft subsystems:
 *       structures, solar panels, batteries, propulsion units, antennas, and avionics,
 *       with mass, power, cost, performance stats, and 3D geometry metadata.
 */

export const SUBSYSTEM_CATEGORIES = [
  { key: "structures", selectionKey: "structureId", label: "Structure" },
  { key: "solarPanels", selectionKey: "solarPanelId", label: "Solar Panels" },
  { key: "batteries", selectionKey: "batteryId", label: "Batteries" },
  { key: "propulsion", selectionKey: "propulsionId", label: "Propulsion" },
  { key: "antennas", selectionKey: "antennaId", label: "Antenna" },
  { key: "avionics", selectionKey: "avionicsId", label: "Avionics" },
];

export const SPACECRAFT_COMPONENTS = {
  structures: [
    {
      id: "cubesat-6u",
      name: "CubeSat 6U Bus",
      massKg: 12,
      maxPayloadMassKg: 45,
      costMillions: 2.5,
      shape: "box",
      width: 0.65,
      height: 0.95,
      depth: 0.55,
      color: 0xd4af37,
      description: "Lightweight modular 6U frame suited for low-cost LEO tech demos.",
    },
    {
      id: "smallsat-hex",
      name: "SmallSat Hex Bus",
      massKg: 85,
      maxPayloadMassKg: 260,
      costMillions: 8.0,
      shape: "hex",
      width: 1.15,
      height: 1.25,
      depth: 1.15,
      color: 0xc9a227,
      description: "Balanced hexagonal bus with thermal MLI foil and good payload capacity.",
    },
    {
      id: "medium-oct",
      name: "Medium Modular Bus",
      massKg: 260,
      maxPayloadMassKg: 750,
      costMillions: 18.0,
      shape: "oct",
      width: 1.55,
      height: 1.7,
      depth: 1.55,
      color: 0xb0bec5,
      description: "Octagonal aluminum-honeycomb bus built for GEO and multi-instrument payloads.",
    },
    {
      id: "heavy-deep-space",
      name: "Deep-Space Heavy Bus",
      massKg: 620,
      maxPayloadMassKg: 1600,
      costMillions: 36.0,
      shape: "oct",
      width: 2.0,
      height: 2.1,
      depth: 2.0,
      color: 0xe0b94a,
      description: "Reinforced deep-space chassis capable of carrying heavy propellant and dishes.",
    },
  ],

  solarPanels: [
    {
      id: "fixed-body",
      name: "Body-Mounted Panels",
      massKg: 8,
      powerGeneratedWatts: 180,
      costMillions: 1.5,
      span: 1.0,
      chord: 0.6,
      segments: 1,
      deployable: false,
      description: "Compact fixed photovoltaic panels; zero deployment risk, low power.",
    },
    {
      id: "twin-deployable",
      name: "Twin Deployable Wings",
      massKg: 32,
      powerGeneratedWatts: 650,
      costMillions: 5.5,
      span: 2.4,
      chord: 0.85,
      segments: 2,
      deployable: true,
      description: "Articulated twin solar wings providing solid orbital power.",
    },
    {
      id: "triple-junction",
      name: "Triple-Junction Arrays",
      massKg: 68,
      powerGeneratedWatts: 1600,
      costMillions: 12.0,
      span: 3.4,
      chord: 1.05,
      segments: 3,
      deployable: true,
      description: "High-efficiency GaAs arrays required for power-hungry sensors or ion drives.",
    },
    {
      id: "deep-space-mega",
      name: "Mega Concentrator Wings",
      massKg: 125,
      powerGeneratedWatts: 3200,
      costMillions: 22.0,
      span: 4.5,
      chord: 1.2,
      segments: 4,
      deployable: true,
      description: "Massive multi-panel solar wings engineered for high-power deep-space missions.",
    },
  ],

  batteries: [
    {
      id: "li-ion-compact",
      name: "Compact Li-Ion Pack",
      massKg: 10,
      capacityWh: 400,
      costMillions: 1.2,
      description: "Lightweight battery pack for short orbital eclipse windows.",
    },
    {
      id: "li-ion-dual",
      name: "Dual Redundant Pack",
      massKg: 28,
      capacityWh: 1400,
      costMillions: 3.8,
      description: "Dual-string lithium-ion storage for medium payloads and GEO eclipses.",
    },
    {
      id: "deep-space-cells",
      name: "Deep-Space High-Cap Pack",
      massKg: 65,
      capacityWh: 3600,
      costMillions: 8.5,
      description: "Thermal-regulated high-capacity cells for long-duration missions.",
    },
  ],

  propulsion: [
    {
      id: "cold-gas",
      name: "Cold Gas N2 Thruster",
      dryMassKg: 8,
      propellantMassKg: 12,
      ispSeconds: 70,
      thrustN: 5,
      powerWatts: 10,
      costMillions: 1.5,
      style: "cold-gas",
      plumeColor: 0xbae6fd,
      description: "Simple attitude & minor orbit trim thruster with very low delta-v.",
    },
    {
      id: "hydrazine-mono",
      name: "Hydrazine Monoprop",
      dryMassKg: 28,
      propellantMassKg: 95,
      ispSeconds: 230,
      thrustN: 120,
      powerWatts: 35,
      costMillions: 5.0,
      style: "monoprop",
      plumeColor: 0xf97316,
      description: "Reliable monopropellant thruster for LEO station-keeping and small transfers.",
    },
    {
      id: "bipropellant",
      name: "Bipropellant Apogee Engine",
      dryMassKg: 75,
      propellantMassKg: 380,
      ispSeconds: 315,
      thrustN: 450,
      powerWatts: 55,
      costMillions: 12.5,
      style: "biprop",
      plumeColor: 0xfb923c,
      description: "High-thrust chemical engine ideal for GEO insertion and lunar capture burns.",
    },
    {
      id: "xenon-ion",
      name: "Xenon Hall Ion Thruster",
      dryMassKg: 55,
      propellantMassKg: 140,
      ispSeconds: 3000,
      thrustN: 0.2,
      powerWatts: 950,
      costMillions: 18.0,
      style: "ion",
      plumeColor: 0x38bdf8,
      description: "Ultra-efficient electric propulsion; delivers huge delta-v but draws 950 W.",
    },
  ],

  antennas: [
    {
      id: "s-band-patch",
      name: "S-Band Patch Array",
      massKg: 3,
      powerWatts: 25,
      maxRangeKm: 2500,
      maxDataRateKbps: 256,
      costMillions: 1.0,
      style: "patch",
      radius: 0.28,
      description: "Low-mass patch antenna suitable only for Low Earth Orbit.",
    },
    {
      id: "x-band-medium",
      name: "X-Band Helical Medium-Gain",
      massKg: 14,
      powerWatts: 65,
      maxRangeKm: 50000,
      maxDataRateKbps: 2048,
      costMillions: 4.5,
      style: "helical",
      radius: 0.35,
      description: "Medium-gain directional antenna capable of reaching MEO and GEO.",
    },
    {
      id: "parabolic-high-gain",
      name: "Parabolic High-Gain Dish",
      massKg: 38,
      powerWatts: 140,
      maxRangeKm: 450000,
      maxDataRateKbps: 10240,
      costMillions: 11.0,
      style: "dish",
      radius: 0.78,
      description: "Large deployable parabolic dish supporting Lunar links and high-speed data.",
    },
    {
      id: "ka-band-deep-space",
      name: "Ka-Band Deep-Space Dish",
      massKg: 72,
      powerWatts: 240,
      maxRangeKm: 150000000,
      maxDataRateKbps: 25600,
      costMillions: 20.0,
      style: "deep-dish",
      radius: 1.08,
      description: "Massive deep-space high-gain antenna for high-rate interplanetary telemetry.",
    },
  ],

  avionics: [
    {
      id: "basic-obc",
      name: "Standard Flight Computer",
      massKg: 6,
      powerWatts: 35,
      costMillions: 1.8,
      radHardened: false,
      description: "Commercial off-the-shelf flight computer; suitable for shielded LEO.",
    },
    {
      id: "redundant-obc",
      name: "Redundant Orbital Avionics",
      massKg: 16,
      powerWatts: 75,
      costMillions: 5.5,
      radHardened: true,
      description: "Dual-redundant radiation-tolerant computer for MEO, GEO, and Lunar missions.",
    },
    {
      id: "deep-space-core",
      name: "Rad-Hard Deep-Space Core",
      massKg: 28,
      powerWatts: 110,
      costMillions: 10.5,
      radHardened: true,
      description: "Autonomous fault-tolerant deep-space avionics suite.",
    },
  ],
};

export const DEFAULT_SELECTION = {
  structureId: "smallsat-hex",
  solarPanelId: "twin-deployable",
  batteryId: "li-ion-dual",
  propulsionId: "hydrazine-mono",
  antennaId: "x-band-medium",
  avionicsId: "redundant-obc",
};

/**
 * Return all components for a given subsystem category.
 * @param {keyof typeof SPACECRAFT_COMPONENTS} category
 * @returns {Array<Object>}
 */
export function getComponentsByCategory(category) {
  return SPACECRAFT_COMPONENTS[category] ?? [];
}

/**
 * Look up a specific component by category and ID.
 * @param {keyof typeof SPACECRAFT_COMPONENTS} category
 * @param {string} id
 * @returns {Object | undefined}
 */
export function getComponentById(category, id) {
  return getComponentsByCategory(category).find((item) => item.id === id);
}
