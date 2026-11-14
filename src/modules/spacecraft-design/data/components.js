/**
 * @file src/modules/spacecraft-design/data/components.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Component database defining selectable spacecraft subsystems:
 *       structures, solar panels, batteries, propulsion units, antennas, and avionics,
 *       with mass, power, cost, performance stats, and 3D model/attachment metadata.
 */

export const SPACECRAFT_COMPONENTS = {
  structures: [
    // TODO: Add CubeSat, SmallSat, Medium Bus, Heavy Deep-Space Bus options
  ],
  solarPanels: [
    // TODO: Add Compact Fixed, Deployable Twin-Wing, High-Efficiency Deep-Space Arrays
  ],
  batteries: [
    // TODO: Add Small Li-Ion, Medium Redundant Pack, High-Capacity Battery Pack
  ],
  propulsion: [
    // TODO: Add Cold Gas Thruster, Monopropellant Hydrazine, Bipropellant, Ion Thruster
  ],
  antennas: [
    // TODO: Add S-Band Patch, X-Band High-Gain Dish, Ka-Band Deep-Space Dish
  ],
  avionics: [
    // TODO: Add Basic Flight Computer, Radiation-Hardened Avionics
  ],
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
