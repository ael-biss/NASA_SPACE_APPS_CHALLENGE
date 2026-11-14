/**
 * @file src/modules/mission-science/data/instruments.js
 * @owner Member 1 (Mission & Science)
 * @goal Database of scientific instruments (optical camera, spectrometer, radar, magnetometer)
 *       with their engineering trade-offs (mass, power, data rate, cost, science points).
 */

export const INSTRUMENTS = [
  // TODO: Populate scientific instruments matching InstrumentSelection typedef
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
