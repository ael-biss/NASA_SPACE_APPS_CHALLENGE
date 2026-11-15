/**
 * @file src/modules/launch-orbit/data/launchSites.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Catalog of Earth launch sites with latitude/longitude coordinates, launch azimuth,
 *       downrange corridor, and Earth-rotation velocity assist helpers.
 */

import { PHYSICS } from "../../../shared/data/constants.js";

export const DEFAULT_LAUNCH_SITE_ID = "ksc-lc39a";

export const LAUNCH_SITES = [
  {
    id: "ksc-lc39a",
    name: "Kennedy Space Center (LC-39A)",
    shortName: "KSC LC-39A",
    location: "Merritt Island, Florida",
    latitudeDeg: 28.6,
    longitudeDeg: -80.6,
    defaultAzimuthDeg: 90,
    minInclinationDeg: 28.6,
    rangeCorridor: "Atlantic Ocean (Eastern Range)",
    description:
      "Historic NASA Saturn V, Space Shuttle, and deep-space launch pad at 28.6°N, 80.6°W launching east over the Atlantic for ~408 m/s Earth-rotation assist.",
  },
];

/**
 * Return all configured launch sites.
 * @returns {Array<Object>}
 */
export function getLaunchSites() {
  return LAUNCH_SITES;
}

/**
 * Resolve a launch site by ID, falling back to KSC LC-39A when omitted or unknown.
 * @param {string | Object} [siteOrId]
 * @returns {Object}
 */
export function getLaunchSiteById(siteOrId) {
  if (siteOrId && typeof siteOrId === "object") {
    return siteOrId;
  }
  const targetId = typeof siteOrId === "string" && siteOrId ? siteOrId : DEFAULT_LAUNCH_SITE_ID;
  return LAUNCH_SITES.find((s) => s.id === targetId) ?? LAUNCH_SITES[0];
}

/**
 * Compute eastward Earth-rotation velocity at a launch site:
 * v_rot = omega * R_earth * cos(latitude).
 * At KSC (28.6°N) this yields ~407.9 m/s (~408 m/s).
 *
 * @param {string | Object} [siteOrId]
 * @returns {number} Tangential velocity in m/s
 */
export function calculateSiteRotationBonusMs(siteOrId = DEFAULT_LAUNCH_SITE_ID) {
  const site = getLaunchSiteById(siteOrId);
  const latDeg = typeof site?.latitudeDeg === "number" ? site.latitudeDeg : 28.6;
  const latRad = (latDeg * Math.PI) / 180;
  return PHYSICS.EARTH_SIDEREAL_OMEGA_RAD_S * (PHYSICS.EARTH_RADIUS_KM * 1000) * Math.cos(latRad);
}
