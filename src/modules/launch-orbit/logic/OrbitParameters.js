/**
 * @file src/modules/launch-orbit/logic/OrbitParameters.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Circular-orbit geometry: convert an altitude in km to radius,
 *       circular velocity, and orbital period.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * THE PHYSICS (for later understanding — code below uses these directly)
 * ═══════════════════════════════════════════════════════════════════════
 *   For a circular orbit at radius r around a body with gravitational
 *   parameter μ = GM:
 *
 *     velocity    v = √(μ / r)              [m/s]
 *     period      T = 2π √(r³ / μ)          [s]
 *
 *   where:
 *     μ_earth = 3.986 × 10¹⁴ m³/s²
 *     R_earth = 6,371 km  (mean radius)
 *     r = R_earth + altitude  (radius, NOT altitude)
 *
 *   Altitude and radius are different quantities. This file makes that
 *   conversion explicit. Every other file must use one or the other
 *   consistently — never mix.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { EARTH_MU, EARTH_RADIUS_KM } from '../../../shared/data/constants.js';

/**
 * Convert altitude (km above surface) to radius (km from Earth's center).
 * @param {number} altitudeKm
 * @returns {number} radius [km]
 */
export function radiusFromAltitudeKm(altitudeKm) {
  return EARTH_RADIUS_KM + altitudeKm;
}

/**
 * Circular-orbit velocity at a given altitude.
 *   v = √(μ / r)
 * @param {number} altitudeKm
 * @returns {number} velocity [km/s]
 */
export function circularVelocityKmS(altitudeKm) {
  const rM = radiusFromAltitudeKm(altitudeKm) * 1000;
  const vMps = Math.sqrt(EARTH_MU / rM);
  return vMps / 1000;
}

/**
 * Orbital period at a given altitude.
 *   T = 2π √(r³ / μ)
 * @param {number} altitudeKm
 * @returns {number} period [min]
 */
export function orbitalPeriodMin(altitudeKm) {
  const rM = radiusFromAltitudeKm(altitudeKm) * 1000;
  const tSec = 2 * Math.PI * Math.sqrt((rM ** 3) / EARTH_MU);
  return tSec / 60;
}