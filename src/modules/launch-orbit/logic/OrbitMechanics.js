/**
 * @file src/modules/launch-orbit/logic/OrbitMechanics.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Physics & phase-by-phase outbound flight simulator using TWR (F = ma),
 *       Max-Q aerodynamic pressure, launch g-loads/vibration, vis-viva orbital velocity
 *       (v = sqrt(mu / r)), Tsiolkovsky delta-v, inverse-square solar power, thermal balance,
 *       radiation dose, comms delay, and target orbit capture.
 */

import { PHYSICS } from "../../../shared/data/constants.js";
import { createDefaultLaunchResult } from "../../../shared/interfaces/LaunchResult.js";
import {
  DEFAULT_LAUNCH_SITE_ID,
  calculateSiteRotationBonusMs,
  getLaunchSiteById,
} from "../data/launchSites.js";
import { getOrbitById } from "../data/orbits.js";
import { getFairingById, getRocketById } from "../data/rockets.js";

const LEO_REFERENCE_ALTITUDE_KM = 500;
const LEO_ASCENT_LOSSES_MS = 1783.44;

export class OrbitMechanics {
  /**
   * Compute geocentric orbital radius r = R_earth + altitude in km.
   * @param {number} altitudeKm
   * @returns {number}
   */
  calculateOrbitalRadiusKm(altitudeKm) {
    if (typeof altitudeKm !== "number" || !Number.isFinite(altitudeKm) || altitudeKm < 0) {
      return 0;
    }
    return PHYSICS.EARTH_RADIUS_KM + altitudeKm;
  }

  /**
   * Compute circular orbital velocity v = sqrt(mu / r) in m/s.
   * @param {number} altitudeKm
   * @returns {number}
   */
  calculateOrbitalVelocity(altitudeKm) {
    const radiusKm = this.calculateOrbitalRadiusKm(altitudeKm);
    if (radiusKm <= 0) return 0;
    return Math.sqrt(PHYSICS.EARTH_MU_KM3_S2 / radiusKm) * 1000;
  }

  /**
   * Compute local escape velocity v_esc = sqrt(2 * mu / r) in m/s.
   * @param {number} altitudeKm
   * @returns {number}
   */
  calculateEscapeVelocity(altitudeKm) {
    const radiusKm = this.calculateOrbitalRadiusKm(altitudeKm);
    if (radiusKm <= 0) return 0;
    return Math.sqrt((2 * PHYSICS.EARTH_MU_KM3_S2) / radiusKm) * 1000;
  }

  /**
   * Compute Keplerian circular orbital period T = 2 * pi * sqrt(r^3 / mu) in seconds.
   * @param {number} altitudeKm
   * @returns {number}
   */
  calculateOrbitalPeriod(altitudeKm) {
    const radiusKm = this.calculateOrbitalRadiusKm(altitudeKm);
    if (radiusKm <= 0) return 0;
    return 2 * Math.PI * Math.sqrt(Math.pow(radiusKm, 3) / PHYSICS.EARTH_MU_KM3_S2);
  }

  /**
   * Compute two-impulse Hohmann transfer delta-v (m/s) between two circular altitudes.
   * @param {number} fromAltitudeKm
   * @param {number} toAltitudeKm
   * @returns {number}
   */
  calculateHohmannTransferDeltaV(fromAltitudeKm, toAltitudeKm) {
    const r1 = this.calculateOrbitalRadiusKm(fromAltitudeKm);
    const r2 = this.calculateOrbitalRadiusKm(toAltitudeKm);
    if (r1 <= 0 || r2 <= 0) return 0;
    if (r1 === r2) return 0;

    const mu = PHYSICS.EARTH_MU_KM3_S2;
    const semiMajorAxis = (r1 + r2) / 2;

    const v1 = Math.sqrt(mu / r1);
    const v2 = Math.sqrt(mu / r2);
    const vt1 = Math.sqrt(mu * (2 / r1 - 1 / semiMajorAxis));
    const vt2 = Math.sqrt(mu * (2 / r2 - 1 / semiMajorAxis));

    const dv1Ms = Math.abs(vt1 - v1) * 1000;
    const dv2Ms = Math.abs(v2 - vt2) * 1000;
    return dv1Ms + dv2Ms;
  }

  /**
   * Compute required delta-v (m/s) from a launch site to a target orbit, including:
   * - Baseline orbital speed + ascent losses (+ Hohmann transfer)
   * - Earth rotation bonus v = omega * R * cos(lat) (~408 m/s at KSC 28.6°N) subtracted from ascent
   * - Plane-change delta-v for inclinations below site latitude (e.g. 0° GEO)
   * - Azimuth penalty for inclinations above site latitude (e.g. 55° MEO)
   *
   * @param {Object | string} orbit
   * @param {string | Object} [launchSite]
   * @returns {{
   *   baseDeltaVMs: number,
   *   rotationBonusMs: number,
   *   planeChangeDeltaVMs: number,
   *   azimuthPenaltyMs: number,
   *   inclinationPenaltyMs: number,
   *   effectiveDeltaVMs: number,
   *   azimuthDeg: number,
   *   siteMinInclDeg: number,
   *   targetInclDeg: number,
   *   penaltyKind: "none" | "plane-change" | "azimuth",
   *   launchSite: Object
   * }}
   */
  calculateSiteDeltaVBreakdown(orbit, launchSite = DEFAULT_LAUNCH_SITE_ID) {
    const site = getLaunchSiteById(launchSite);
    const empty = {
      baseDeltaVMs: 0,
      rotationBonusMs: 0,
      planeChangeDeltaVMs: 0,
      azimuthPenaltyMs: 0,
      inclinationPenaltyMs: 0,
      effectiveDeltaVMs: 0,
      azimuthDeg: site?.defaultAzimuthDeg ?? 90,
      siteMinInclDeg: Math.abs(site?.latitudeDeg ?? 28.6),
      targetInclDeg: Math.abs(site?.latitudeDeg ?? 28.6),
      penaltyKind: "none",
      launchSite: site,
    };

    const resolved = typeof orbit === "string" ? getOrbitById(orbit) : orbit;
    if (!resolved || typeof resolved !== "object") return empty;

    let baseDeltaVMs = 0;
    if (
      typeof resolved.requiredDeltaVMs === "number" &&
      Number.isFinite(resolved.requiredDeltaVMs) &&
      resolved.requiredDeltaVMs > 0
    ) {
      baseDeltaVMs = resolved.requiredDeltaVMs;
    } else if (
      typeof resolved.altitudeKm === "number" &&
      Number.isFinite(resolved.altitudeKm) &&
      resolved.altitudeKm >= 0
    ) {
      const leoBaselineMs =
        this.calculateOrbitalVelocity(LEO_REFERENCE_ALTITUDE_KM) + LEO_ASCENT_LOSSES_MS;

      if (resolved.altitudeKm <= LEO_REFERENCE_ALTITUDE_KM) {
        baseDeltaVMs = this.calculateOrbitalVelocity(resolved.altitudeKm) + LEO_ASCENT_LOSSES_MS;
      } else {
        const transferMs = this.calculateHohmannTransferDeltaV(
          LEO_REFERENCE_ALTITUDE_KM,
          resolved.altitudeKm
        );
        const overheadMs =
          typeof resolved.insertionOverheadMs === "number" &&
          Number.isFinite(resolved.insertionOverheadMs) &&
          resolved.insertionOverheadMs > 0
            ? resolved.insertionOverheadMs
            : 0;
        baseDeltaVMs = leoBaselineMs + transferMs + overheadMs;
      }
    } else {
      return empty;
    }

    const rawRotationBonusMs = calculateSiteRotationBonusMs(site);
    const rotationBonusMs = Math.round(rawRotationBonusMs);
    const siteMinInclDeg = Math.abs(site.latitudeDeg ?? 28.6);
    const isEarthOrbit = !resolved.targetBody || resolved.targetBody === "Earth";
    const targetInclDeg =
      isEarthOrbit && typeof resolved.inclinationDeg === "number" && Number.isFinite(resolved.inclinationDeg)
        ? Math.max(0, Math.min(180, resolved.inclinationDeg))
        : siteMinInclDeg;

    let azimuthDeg = 90;
    let planeChangeDeltaVMs = 0;
    let azimuthPenaltyMs = 0;
    let penaltyKind = "none";

    const inclEpsilon = 0.05;
    if (isEarthOrbit && targetInclDeg < siteMinInclDeg - inclEpsilon) {
      // Launch due east into parking inclination = site latitude, then perform plane change
      const deltaInclRad = ((siteMinInclDeg - targetInclDeg) * Math.PI) / 180;
      const targetAltKm =
        typeof resolved.altitudeKm === "number" && Number.isFinite(resolved.altitudeKm)
          ? resolved.altitudeKm
          : LEO_REFERENCE_ALTITUDE_KM;

      if (targetAltKm > LEO_REFERENCE_ALTITUDE_KM) {
        const r1 = this.calculateOrbitalRadiusKm(LEO_REFERENCE_ALTITUDE_KM);
        const r2 = this.calculateOrbitalRadiusKm(targetAltKm);
        const vApogeeTransfer = Math.sqrt(PHYSICS.EARTH_MU_KM3_S2 * (2 / r2 - 2 / (r1 + r2))) * 1000;
        const vCircularTarget = this.calculateOrbitalVelocity(targetAltKm);
        const dvCoplanar = Math.abs(vCircularTarget - vApogeeTransfer);
        const dvCombined = Math.sqrt(
          vApogeeTransfer * vApogeeTransfer +
            vCircularTarget * vCircularTarget -
            2 * vApogeeTransfer * vCircularTarget * Math.cos(deltaInclRad)
        );
        planeChangeDeltaVMs = Math.round(Math.max(0, dvCombined - dvCoplanar));
      } else {
        const vCircular = this.calculateOrbitalVelocity(targetAltKm);
        planeChangeDeltaVMs = Math.round(2 * vCircular * Math.sin(deltaInclRad / 2));
      }
      penaltyKind = "plane-change";
    } else if (isEarthOrbit && targetInclDeg > siteMinInclDeg + inclEpsilon) {
      // Higher inclination than latitude: steer northeast/southeast azimuth, losing eastward Earth spin
      const siteLatRad = (siteMinInclDeg * Math.PI) / 180;
      const targetInclRad = (targetInclDeg * Math.PI) / 180;
      const sinAzimuth = Math.max(-1, Math.min(1, Math.cos(targetInclRad) / Math.max(1e-6, Math.cos(siteLatRad))));
      azimuthDeg = Number(((Math.asin(Math.abs(sinAzimuth)) * 180) / Math.PI).toFixed(1));
      const effectiveRotationMs = rawRotationBonusMs * sinAzimuth;
      azimuthPenaltyMs = Math.round(Math.max(0, rawRotationBonusMs - effectiveRotationMs));
      penaltyKind = "azimuth";
    }

    const inclinationPenaltyMs = planeChangeDeltaVMs + azimuthPenaltyMs;
    const effectiveDeltaVMs = Math.max(0, Math.round(baseDeltaVMs - rotationBonusMs + inclinationPenaltyMs));

    return {
      baseDeltaVMs: Math.round(baseDeltaVMs),
      rotationBonusMs,
      planeChangeDeltaVMs,
      azimuthPenaltyMs,
      inclinationPenaltyMs,
      effectiveDeltaVMs,
      azimuthDeg,
      siteMinInclDeg,
      targetInclDeg,
      penaltyKind,
      launchSite: site,
    };
  }

  /**
   * Compute required delta-v (m/s) from the launch site to a target orbit.
   * Applies Earth's rotation assist and site-to-orbit plane-change / azimuth costs.
   * @param {Object | string} orbit
   * @param {string | Object} [launchSite]
   * @returns {number}
   */
  calculateRequiredDeltaV(orbit, launchSite = DEFAULT_LAUNCH_SITE_ID) {
    return this.calculateSiteDeltaVBreakdown(orbit, launchSite).effectiveDeltaVMs;
  }

  /**
   * Compute spacecraft onboard delta-v using Tsiolkovsky equation: Isp * g0 * ln(m0 / mf).
   * @param {import('../../../shared/interfaces/SpacecraftSpec.js').SpacecraftSpec} spacecraftSpec
   * @returns {number}
   */
  calculateSpacecraftDeltaV(spacecraftSpec) {
    if (!spacecraftSpec || typeof spacecraftSpec !== "object") return 0;

    const { ispSeconds, totalMassKg, dryMassKg } = spacecraftSpec;
    if (
      typeof ispSeconds !== "number" ||
      typeof totalMassKg !== "number" ||
      typeof dryMassKg !== "number" ||
      !Number.isFinite(ispSeconds) ||
      !Number.isFinite(totalMassKg) ||
      !Number.isFinite(dryMassKg) ||
      ispSeconds <= 0 ||
      dryMassKg <= 0 ||
      totalMassKg <= dryMassKg
    ) {
      return 0;
    }

    return ispSeconds * PHYSICS.STANDARD_GRAVITY_MS2 * Math.log(totalMassKg / dryMassKg);
  }

  /**
   * Simulate all 7 outbound flight phases and produce a detailed LaunchResult.
   * @param {Object | string} rocket
   * @param {import('../../../shared/interfaces/SpacecraftSpec.js').SpacecraftSpec} spacecraftSpec
   * @param {Object | string} targetOrbit
   * @param {{ fairingId?: string, launchSite?: string | Object, launchSiteId?: string, missionSpec?: Object | null, allowInvalid?: boolean }} [options]
   * @returns {import('../../../shared/interfaces/LaunchResult.js').LaunchResult}
   */
  simulateLaunch(rocket, spacecraftSpec, targetOrbit, options = {}) {
    const result = createDefaultLaunchResult();

    const resolvedRocket = typeof rocket === "string" ? getRocketById(rocket) : rocket;
    const resolvedOrbit =
      typeof targetOrbit === "string" ? getOrbitById(targetOrbit) : targetOrbit;
    const resolvedSite = getLaunchSiteById(
      options.launchSite ?? options.launchSiteId ?? DEFAULT_LAUNCH_SITE_ID
    );
    const resolvedFairing =
      getFairingById(options.fairingId ?? "standard-fairing") ??
      getFairingById("standard-fairing");

    result.fairingId = resolvedFairing?.id ?? "standard-fairing";
    result.launchSiteId = resolvedSite?.id ?? DEFAULT_LAUNCH_SITE_ID;

    if (!resolvedRocket || typeof resolvedRocket !== "object") {
      result.failureReason = "No valid launch vehicle selected.";
      result.failureCause = result.failureReason;
      result.failureFix = "Select a launch vehicle before launching.";
      return result;
    }

    if (!resolvedOrbit || typeof resolvedOrbit !== "object") {
      result.rocketId = resolvedRocket.id ?? "";
      result.launchCostMillions =
        (resolvedRocket.costMillions ?? 0) + (resolvedFairing?.costMillions ?? 0);
      result.failureReason = "No valid target orbit specified.";
      result.failureCause = result.failureReason;
      result.failureFix = "Select a mission with a valid target orbit.";
      return result;
    }

    result.rocketId = resolvedRocket.id ?? "";
    result.targetOrbitId = resolvedOrbit.id ?? "LEO";
    result.launchCostMillions =
      (typeof resolvedRocket.costMillions === "number" ? resolvedRocket.costMillions : 0) +
      (resolvedFairing?.costMillions ?? 0);

    if (!spacecraftSpec || typeof spacecraftSpec !== "object") {
      result.failureReason = "No spacecraft configuration provided.";
      result.failureCause = result.failureReason;
      result.failureFix = "Configure your spacecraft subsystems first.";
      return result;
    }

    if (spacecraftSpec.isValid === false && !options.allowInvalid) {
      const errorList = Array.isArray(spacecraftSpec.errors)
        ? spacecraftSpec.errors.filter((e) => typeof e === "string" && e.trim())
        : [];
      result.failureReason =
        errorList.length > 0
          ? `Spacecraft failed pre-launch checks: ${errorList.join(" ")}`
          : "Spacecraft failed pre-launch engineering checks.";
      result.failureCause = result.failureReason;
      result.failureFix = "Resolve compatibility errors in Spacecraft Design before launch.";
      return result;
    }

    if (
      typeof spacecraftSpec.totalMassKg !== "number" ||
      !Number.isFinite(spacecraftSpec.totalMassKg) ||
      spacecraftSpec.totalMassKg <= 0
    ) {
      result.failureReason = "Spacecraft total mass must be greater than 0 kg.";
      result.failureCause = result.failureReason;
      result.failureFix = "Verify spacecraft structure and subsystem mass.";
      return result;
    }

    const limits = this._resolveLimits(spacecraftSpec);
    const health = result.componentHealth;
    const fairingMassKg = resolvedFairing?.massKg ?? 0;
    const effectivePayloadKg = spacecraftSpec.totalMassKg + fairingMassKg;

    const dvBreakdown = this.calculateSiteDeltaVBreakdown(resolvedOrbit, resolvedSite);
    const requiredDeltaV = dvBreakdown.effectiveDeltaVMs;
    const spacecraftDeltaV = this.calculateSpacecraftDeltaV(spacecraftSpec);
    const launcherDeltaV =
      typeof resolvedRocket.launcherDeltaVMs === "number" ? resolvedRocket.launcherDeltaVMs : 0;
    const totalDeltaV = launcherDeltaV + spacecraftDeltaV;
    const leoRequiredDeltaV = this.calculateRequiredDeltaV("LEO", resolvedSite) || 8992;

    // ------------------------------------------------------------
    // PHASE 1: LIFTOFF (TWR > 1, Payload Capacity)
    // ------------------------------------------------------------
    const liftoffThrustN = (resolvedRocket.liftoffThrustKN ?? 1800) * 1000;
    const rocketMassKg = resolvedRocket.liftoffMassKg ?? 120000;
    const stackMassKg = rocketMassKg + effectivePayloadKg;
    const twr = liftoffThrustN / (stackMassKg * PHYSICS.STANDARD_GRAVITY_MS2);

    const failAtPhase = (phaseId, phaseName, summary, cause, fix, failureMode, metrics = {}, achievedAlt = 0) => {
      result.phases.push({
        id: phaseId,
        name: phaseName,
        status: "failed",
        summary,
        cause,
        fix,
        metrics,
      });
      this._appendSkippedPhases(result.phases, phaseId, resolvedOrbit);
      result.success = false;
      result.achievedAltitudeKm = achievedAlt;
      result.remainingDeltaVMs = 0;
      result.failedPhaseId = phaseId;
      result.failureReason = cause;
      result.failureCause = cause;
      result.failureFix = fix;
      result.failureMode = failureMode;
      result.missionStats = {
        launchSiteId: resolvedSite.id,
        launchSiteName: resolvedSite.name,
        launchAzimuthDeg: dvBreakdown.azimuthDeg,
        rotationBonusMs: dvBreakdown.rotationBonusMs,
        planeChangeDeltaVMs: dvBreakdown.planeChangeDeltaVMs,
        azimuthPenaltyMs: dvBreakdown.azimuthPenaltyMs,
        inclinationPenaltyMs: dvBreakdown.inclinationPenaltyMs,
        totalDeltaVMs: Math.round(totalDeltaV),
        requiredDeltaVMs: Math.round(requiredDeltaV),
        twr: Number(twr.toFixed(2)),
        maxQPa: resolvedRocket.maxQPa ?? 31000,
        peakLaunchG: resolvedRocket.peakLaunchG ?? 5.2,
        cruiseDays: resolvedOrbit.cruiseDays ?? 1,
        commsDelaySec: Number(
          ((options.missionSpec?.targetDistanceKm ?? resolvedOrbit.altitudeKm) /
            PHYSICS.SPEED_OF_LIGHT_KMS).toFixed(2)
        ),
      };
      return result;
    };

    if (effectivePayloadKg > resolvedRocket.maxPayloadLeoKg) {
      return failAtPhase(
        "liftoff",
        "1. Liftoff & Tower Clear",
        `Mass ${Math.round(effectivePayloadKg)} kg > ${resolvedRocket.maxPayloadLeoKg} kg cap`,
        `Payload mass (${Math.round(spacecraftSpec.totalMassKg)} kg${fairingMassKg ? ` + ${fairingMassKg} kg fairing` : ""}) exceeds ${resolvedRocket.name} maximum capacity (${resolvedRocket.maxPayloadLeoKg} kg).`,
        `Select a heavier launch vehicle (e.g., Heavy Lift or Super-Heavy) or reduce spacecraft mass.`,
        "explosion",
        { twr: Number(twr.toFixed(2)), payloadKg: Math.round(effectivePayloadKg) },
        0
      );
    }

    if (twr <= 1.05) {
      return failAtPhase(
        "liftoff",
        "1. Liftoff & Tower Clear",
        `TWR ${twr.toFixed(2)} ≤ 1.05`,
        `Thrust-to-weight ratio (${twr.toFixed(2)}) is too low to lift the ${Math.round(stackMassKg).toLocaleString()} kg stack off the pad.`,
        `Switch to a higher-thrust rocket or reduce spacecraft & propellant mass.`,
        "explosion",
        { twr: Number(twr.toFixed(2)), thrustKN: resolvedRocket.liftoffThrustKN },
        0
      );
    }

    result.phases.push({
      id: "liftoff",
      name: "1. Liftoff & Tower Clear",
      status: "passed",
      summary: `${resolvedSite.shortName} (${resolvedSite.latitudeDeg}°N) · Az ${dvBreakdown.azimuthDeg}° · TWR ${twr.toFixed(2)}`,
      metrics: {
        launchSiteId: resolvedSite.id,
        azimuthDeg: dvBreakdown.azimuthDeg,
        twr: Number(twr.toFixed(2)),
        payloadKg: Math.round(effectivePayloadKg),
      },
    });

    // ------------------------------------------------------------
    // PHASE 2: MAX-Q (~60 s, Dynamic Pressure & Fairing Fit)
    // ------------------------------------------------------------
    const maxQPa = resolvedRocket.maxQPa ?? 31000;
    const maxQKpa = maxQPa / 1000;

    if (!resolvedFairing.protectsAero && maxQKpa > limits.maxQExposedKpa) {
      health.solarPanels = 0;
      health.antenna = 0;
      return failAtPhase(
        "max-q",
        "2. Max-Q Aerodynamic Load",
        `Unfaired load ${maxQKpa.toFixed(1)} kPa > ${limits.maxQExposedKpa} kPa`,
        `Dynamic pressure at Max-Q (${maxQKpa.toFixed(1)} kPa) sheared off unshielded deployable panels/antenna (exposed limit ${limits.maxQExposedKpa} kPa).`,
        `Equip a protective payload fairing (Standard or Acoustic-Damped) or use compact body-mounted panels.`,
        "structural-breakup",
        { maxQKpa, fairingDiameterM: resolvedRocket.fairingDiameterM },
        0
      );
    }

    if (resolvedFairing.protectsAero && limits.stowedDiameterM > resolvedRocket.fairingDiameterM) {
      health.structure = 0;
      return failAtPhase(
        "max-q",
        "2. Max-Q Aerodynamic Load",
        `Envelope ${limits.stowedDiameterM} m > ${resolvedRocket.fairingDiameterM} m fairing`,
        `Spacecraft stowed width (${limits.stowedDiameterM} m) exceeds ${resolvedRocket.name}'s ${resolvedRocket.fairingDiameterM} m fairing, causing fairing rupture at Max-Q (${maxQKpa.toFixed(1)} kPa).`,
        `Choose a rocket with a wider fairing or swap to a smaller bus/antenna.`,
        "structural-breakup",
        { maxQKpa, stowedDiameterM: limits.stowedDiameterM, fairingDiameterM: resolvedRocket.fairingDiameterM },
        0
      );
    }

    const carriedMassKg =
      typeof spacecraftSpec.carriedMassKg === "number"
        ? spacecraftSpec.carriedMassKg
        : spacecraftSpec.totalMassKg;
    const maxBusLoadKg = spacecraftSpec.maxPayloadMassKg ?? 0;
    const carriedRatio = maxBusLoadKg > 0 ? carriedMassKg / maxBusLoadKg : 0.5;
    const aeroStressKpa = maxQKpa * (0.75 + carriedRatio * 0.35);
    if (aeroStressKpa > limits.structuralStrengthKpa) {
      health.structure = 0;
      const overloadNote =
        typeof spacecraftSpec.carriedMassKg === "number" &&
        maxBusLoadKg > 0 &&
        spacecraftSpec.carriedMassKg > maxBusLoadKg
          ? ` Carried mass (${Math.round(spacecraftSpec.carriedMassKg)} kg) exceeds bus limit (${maxBusLoadKg} kg).`
          : "";
      return failAtPhase(
        "max-q",
        "2. Max-Q Aerodynamic Load",
        `Aero stress ${aeroStressKpa.toFixed(1)} kPa > ${limits.structuralStrengthKpa} kPa`,
        `Combined Max-Q buffeting (${aeroStressKpa.toFixed(1)} kPa) buckled the bus structure (limit ${limits.structuralStrengthKpa} kPa).${overloadNote}`,
        `Upgrade to a stronger spacecraft bus structure or reduce carried mass.`,
        "structural-breakup",
        { maxQKpa, aeroStressKpa: Number(aeroStressKpa.toFixed(1)) },
        0
      );
    }

    health.structure = Math.max(40, Math.round(100 - (aeroStressKpa / limits.structuralStrengthKpa) * 20));
    result.phases.push({
      id: "max-q",
      name: "2. Max-Q Aerodynamic Load",
      status: "passed",
      summary: `${maxQKpa.toFixed(1)} kPa · Fits ${resolvedRocket.fairingDiameterM}m fairing`,
      metrics: { maxQKpa, stowedDiameterM: limits.stowedDiameterM },
    });

    // ------------------------------------------------------------
    // PHASE 3: ASCENT & STAGING (G-load, Vibration & LEO Energy)
    // ------------------------------------------------------------
    const peakG = resolvedRocket.peakLaunchG ?? 5.2;
    const damping = resolvedFairing?.vibrationDamping ?? 1.0;
    const effectiveVibG = (resolvedRocket.vibrationGrms ?? 5.4) * damping;

    if (peakG > limits.maxG) {
      health.structure = 0;
      health.propulsion = 0;
      return failAtPhase(
        "ascent",
        "3. Ascent & Staging",
        `Peak ${peakG.toFixed(1)}g > ${limits.maxG.toFixed(1)}g limit`,
        `Sustained staging acceleration (${peakG.toFixed(1)} g) exceeded spacecraft structural/component limit (${limits.maxG.toFixed(1)} g).`,
        `Choose a liquid-core launcher with gentler acceleration (Medium, Heavy, or Super-Heavy) or reinforce components.`,
        "structural-breakup",
        { peakG, maxG: limits.maxG, effectiveVibG: Number(effectiveVibG.toFixed(2)) },
        0
      );
    }

    if (effectiveVibG > limits.vibrationLimitG) {
      health.payload = 0;
      health.avionics = 15;
      return failAtPhase(
        "ascent",
        "3. Ascent & Staging",
        `Vib ${effectiveVibG.toFixed(1)}g RMS > ${limits.vibrationLimitG.toFixed(1)}g limit`,
        `Launch acoustic vibration (${effectiveVibG.toFixed(1)} g RMS) fractured delicate payload optics and sensors (limit ${limits.vibrationLimitG.toFixed(1)} g).`,
        `Select the Acoustic-Damped Heavy Fairing (cuts vibration 38%) or choose a smoother liquid launcher.`,
        "structural-breakup",
        { peakG, effectiveVibG: Number(effectiveVibG.toFixed(2)), limit: limits.vibrationLimitG },
        0
      );
    }

    if (
      typeof spacecraftSpec.carriedMassKg === "number" &&
      spacecraftSpec.maxPayloadMassKg > 0 &&
      spacecraftSpec.carriedMassKg > spacecraftSpec.maxPayloadMassKg
    ) {
      health.structure = 0;
      return failAtPhase(
        "ascent",
        "3. Ascent & Staging",
        `Bus load ${Math.round(spacecraftSpec.carriedMassKg)} kg > ${spacecraftSpec.maxPayloadMassKg} kg limit`,
        `Carried mass (${Math.round(spacecraftSpec.carriedMassKg)} kg) exceeded the bus structural limit (${spacecraftSpec.maxPayloadMassKg} kg) under ${peakG.toFixed(1)} g ascent loads, collapsing the chassis.`,
        `Upgrade to a larger spacecraft bus structure or reduce subsystems, propellant, or payload mass.`,
        "structural-breakup",
        {
          carriedMassKg: Math.round(spacecraftSpec.carriedMassKg),
          maxPayloadMassKg: spacecraftSpec.maxPayloadMassKg,
          peakG,
        },
        0
      );
    }

    const vibWear = Math.max(0, (effectiveVibG / limits.vibrationLimitG - 0.55) * 40);
    health.payload = Math.max(25, Math.round(100 - vibWear));

    if (totalDeltaV < leoRequiredDeltaV) {
      return failAtPhase(
        "ascent",
        "3. Ascent & Staging",
        `Δv ${Math.round(totalDeltaV)} m/s < ${Math.round(leoRequiredDeltaV)} m/s LEO`,
        `Insufficient delta-v: ${Math.round(totalDeltaV).toLocaleString()} m/s available (${Math.round(launcherDeltaV).toLocaleString()} m/s rocket + ${Math.round(spacecraftDeltaV).toLocaleString()} m/s spacecraft) vs ${Math.round(leoRequiredDeltaV).toLocaleString()} m/s needed for orbital velocity.`,
        `Select a higher-energy launch vehicle or upgrade spacecraft propulsion.`,
        "suborbital-fall",
        { totalDeltaVMs: Math.round(totalDeltaV), leoRequiredDeltaVMs: Math.round(leoRequiredDeltaV) },
        0
      );
    }

    const leoVelMs = this.calculateOrbitalVelocity(LEO_REFERENCE_ALTITUDE_KM);
    result.phases.push({
      id: "ascent",
      name: "3. Ascent & Staging",
      status: "passed",
      summary: `${peakG.toFixed(1)}g · Spin assist -${dvBreakdown.rotationBonusMs} m/s · v=${Math.round(leoVelMs)} m/s`,
      metrics: {
        peakG,
        effectiveVibG: Number(effectiveVibG.toFixed(2)),
        leoVelMs: Math.round(leoVelMs),
        rotationBonusMs: dvBreakdown.rotationBonusMs,
        azimuthPenaltyMs: dvBreakdown.azimuthPenaltyMs,
      },
    });

    // ------------------------------------------------------------
    // PHASE 4: PARKING ORBIT & DEPLOYMENT (Solar, Eclipse Battery)
    // ------------------------------------------------------------
    const deployPenalty = Math.max(0, (100 - health.payload) * 0.002);
    const effectiveDeployRisk = Math.max(0, limits.deployRisk + deployPenalty - (1 - limits.burnStability) * 0.05);
    const powerMarginLeo = spacecraftSpec.powerGeneratedWatts - spacecraftSpec.powerConsumedWatts;

    if (powerMarginLeo < 0) {
      health.batteries = 0;
      return failAtPhase(
        "deployment",
        "4. Parking Orbit & Deployment",
        `Power ${powerMarginLeo} W deficit in LEO`,
        `After solar deployment in LEO, array output (${spacecraftSpec.powerGeneratedWatts} W) could not sustain spacecraft load (${spacecraftSpec.powerConsumedWatts} W).`,
        `Upgrade Solar Panels or remove high-draw payloads/ion thrusters.`,
        "power-loss",
        { powerMarginLeo },
        LEO_REFERENCE_ALTITUDE_KM
      );
    }

    // Eclipse battery draw excludes main chemical propulsion idle draw; uses ~70% bus+payload draw
    const leoEclipseHours = 35 / 60;
    const leoEclipseWhNeeded = spacecraftSpec.powerConsumedWatts * 0.7 * leoEclipseHours;
    if ((spacecraftSpec.batteryCapacityWh ?? 0) < leoEclipseWhNeeded) {
      health.batteries = 0;
      return failAtPhase(
        "deployment",
        "4. Parking Orbit & Deployment",
        `Battery ${spacecraftSpec.batteryCapacityWh} Wh < ${Math.round(leoEclipseWhNeeded)} Wh eclipse`,
        `Battery pack (${spacecraftSpec.batteryCapacityWh} Wh) depleted completely during Earth's 35-minute orbital eclipse (needed ${Math.round(leoEclipseWhNeeded)} Wh).`,
        `Upgrade to a higher-capacity Battery Pack or reduce continuous power draw.`,
        "power-loss",
        { batteryWh: spacecraftSpec.batteryCapacityWh, neededWh: Math.round(leoEclipseWhNeeded) },
        LEO_REFERENCE_ALTITUDE_KM
      );
    }

    health.solarPanels = Math.max(50, Math.round(100 - effectiveDeployRisk * 100));
    result.phases.push({
      id: "deployment",
      name: "4. Parking Orbit & Deployment",
      status: "passed",
      summary: `Panels deployed · +${Math.round(powerMarginLeo)} W · Eclipse OK`,
      metrics: { powerMarginLeo: Math.round(powerMarginLeo), leoEclipseWhNeeded: Math.round(leoEclipseWhNeeded) },
    });

    // ------------------------------------------------------------
    // PHASE 5: TRANS-PLANETARY / TRANSFER INJECTION BURN
    // ------------------------------------------------------------
    const tpiDeltaVMs = resolvedOrbit.tpiDeltaVMs ?? 0;
    const captureDeltaVMs = resolvedOrbit.captureDeltaVMs ?? 0;
    const tpiRequiredTotal =
      resolvedOrbit.id === "LEO"
        ? requiredDeltaV
        : Math.max(leoRequiredDeltaV, requiredDeltaV - captureDeltaVMs);

    if (totalDeltaV < tpiRequiredTotal) {
      return failAtPhase(
        "tpi-burn",
        resolvedOrbit.id === "LEO"
          ? "5. Orbital Trim & Station-Keeping"
          : `5. ${resolvedOrbit.targetBody} Transfer Injection Burn`,
        `Δv ${Math.round(totalDeltaV)} m/s < ${Math.round(tpiRequiredTotal)} m/s needed`,
        `Insufficient delta-v: ${Math.round(totalDeltaV).toLocaleString()} m/s available (${Math.round(launcherDeltaV).toLocaleString()} m/s rocket + ${Math.round(spacecraftDeltaV).toLocaleString()} m/s spacecraft) vs ${Math.round(requiredDeltaV).toLocaleString()} m/s required for ${result.targetOrbitId}.`,
        `Choose a higher-energy rocket (Heavy Lift / Super-Heavy) or higher-Isp propulsion (Bipropellant / Ion).`,
        "missed-capture",
        { totalDeltaVMs: Math.round(totalDeltaV), tpiRequiredTotal: Math.round(tpiRequiredTotal) },
        LEO_REFERENCE_ALTITUDE_KM
      );
    }

    if ((resolvedOrbit.id === "LUNAR" || resolvedOrbit.id === "MARS") && spacecraftSpec.ispSeconds < 100) {
      health.propulsion = 0;
      return failAtPhase(
        "tpi-burn",
        `5. ${resolvedOrbit.targetBody} Transfer Injection Burn`,
        `Cold gas (Isp ${spacecraftSpec.ispSeconds}s) unsuited for deep-space burn`,
        `Low-energy Cold Gas thruster cannot execute precision deep-space injection and course corrections for ${resolvedOrbit.targetBody}.`,
        `Equip a Bipropellant Apogee Engine or Xenon Hall Ion Thruster.`,
        "missed-capture",
        { ispSeconds: spacecraftSpec.ispSeconds },
        LEO_REFERENCE_ALTITUDE_KM
      );
    }

    result.phases.push({
      id: "tpi-burn",
      name:
        resolvedOrbit.id === "LEO"
          ? "5. Orbital Trim & Station-Keeping"
          : `5. ${resolvedOrbit.targetBody} Transfer Injection Burn`,
      status: "passed",
      summary:
        tpiDeltaVMs > 0
          ? `Injection Δv ${tpiDeltaVMs.toLocaleString()} m/s nominal`
          : `Orbit stabilized at ${resolvedOrbit.altitudeKm} km`,
      metrics: { tpiDeltaVMs, totalDeltaVMs: Math.round(totalDeltaV) },
    });

    // ------------------------------------------------------------
    // PHASE 6: CRUISE & OPERATIONS (Solar AU, Thermal, Radiation, Comms)
    // ------------------------------------------------------------
    const solarDistanceAU = resolvedOrbit.solarDistanceAU ?? 1.0;
    const solarFluxFactor = 1 / (solarDistanceAU * solarDistanceAU);
    const cruiseSolarW = spacecraftSpec.powerGeneratedWatts * solarFluxFactor;

    // During deep-space coast, chemical engine is off (saving ~45W), while electric ion stays on
    const isElectricProp = spacecraftSpec.ispSeconds >= 1000;
    const cruiseLoadW = isElectricProp
      ? spacecraftSpec.powerConsumedWatts
      : Math.max(40, spacecraftSpec.powerConsumedWatts - 45);
    const cruisePowerMarginW = cruiseSolarW - cruiseLoadW;

    if (cruisePowerMarginW < 0) {
      health.batteries = 0;
      return failAtPhase(
        "cruise",
        "6. Cruise, Thermal & Deep-Space Ops",
        `Solar at ${solarDistanceAU} AU: ${Math.round(cruiseSolarW)} W < ${Math.round(cruiseLoadW)} W`,
        `At ${solarDistanceAU} AU (${Math.round(solarFluxFactor * 100)}% Earth sunlight), solar arrays only produce ${Math.round(cruiseSolarW)} W against ${Math.round(cruiseLoadW)} W load — batteries drained during cruise.`,
        `Upgrade to Mega Concentrator or Triple-Junction solar wings, or lower instrument/thruster power draw.`,
        "power-loss",
        { solarDistanceAU, cruiseSolarW: Math.round(cruiseSolarW), cruiseLoadW: Math.round(cruiseLoadW) },
        LEO_REFERENCE_ALTITUDE_KM
      );
    }

    // Eclipse duration battery check at target
    const targetEclipseHours = (resolvedOrbit.eclipseMinutes ?? 35) / 60;
    const targetEclipseWhNeeded = cruiseLoadW * 0.75 * targetEclipseHours;
    if ((spacecraftSpec.batteryCapacityWh ?? 0) < targetEclipseWhNeeded) {
      health.batteries = 0;
      return failAtPhase(
        "cruise",
        "6. Cruise, Thermal & Deep-Space Ops",
        `Eclipse ${Math.round(targetEclipseWhNeeded)} Wh > ${spacecraftSpec.batteryCapacityWh} Wh`,
        `Batteries exhausted during a ${resolvedOrbit.eclipseMinutes}-minute orbital eclipse (needed ${Math.round(targetEclipseWhNeeded)} Wh vs ${spacecraftSpec.batteryCapacityWh} Wh capacity).`,
        `Install a Dual Redundant or Deep-Space High-Cap battery pack.`,
        "power-loss",
        { targetEclipseWhNeeded: Math.round(targetEclipseWhNeeded), batteryWh: spacecraftSpec.batteryCapacityWh },
        LEO_REFERENCE_ALTITUDE_KM
      );
    }

    // Thermal check
    const ambientSunC = resolvedOrbit.ambientSunTempC ?? 55;
    const ambientEclipseC = resolvedOrbit.ambientEclipseTempC ?? -20;
    const insulation = limits.insulationFactor ?? 0.28;
    const coolingW = limits.coolingCapacityW ?? 120;

    const thermalBonusC =
      limits.thermalId === "active-radiators"
        ? 30
        : limits.thermalId === "heaters-mli"
          ? 20
          : 0;
    const minInternalTempC = ambientEclipseC + insulation * 78 + thermalBonusC;
    const maxInternalTempC =
      ambientSunC + Math.max(0, cruiseLoadW - coolingW) * 0.14 - (limits.thermalId === "active-radiators" ? 28 : 0);

    if (minInternalTempC < limits.tempMinC) {
      health.thermal = 0;
      health.propulsion = 0;
      health.batteries = 10;
      return failAtPhase(
        "cruise",
        "6. Cruise, Thermal & Deep-Space Ops",
        `Cold soak ${Math.round(minInternalTempC)}°C < ${limits.tempMinC}°C limit`,
        `Spacecraft internals cooled to ${Math.round(minInternalTempC)}°C during deep-space shadow (below ${limits.tempMinC}°C survival limit), freezing propellant valves and cells.`,
        `Add MLI Blanket + Survival Heaters or Deployable Radiators + Heat Pipes in the Thermal tab.`,
        "thermal-failure",
        { minInternalTempC: Math.round(minInternalTempC), tempMinC: limits.tempMinC },
        LEO_REFERENCE_ALTITUDE_KM
      );
    }

    if (maxInternalTempC > limits.tempMaxC) {
      health.thermal = 0;
      health.avionics = 15;
      return failAtPhase(
        "cruise",
        "6. Cruise, Thermal & Deep-Space Ops",
        `Overheat ${Math.round(maxInternalTempC)}°C > ${limits.tempMaxC}°C limit`,
        `Internal heat (${Math.round(cruiseLoadW)} W load vs ${coolingW} W cooling) pushed avionics to ${Math.round(maxInternalTempC)}°C (above ${limits.tempMaxC}°C limit).`,
        `Upgrade to Deployable Radiators + Heat Pipes or lower continuous power dissipation.`,
        "thermal-failure",
        { maxInternalTempC: Math.round(maxInternalTempC), tempMaxC: limits.tempMaxC },
        LEO_REFERENCE_ALTITUDE_KM
      );
    }

    health.thermal = Math.max(
      35,
      Math.round(100 - Math.max(0, (limits.tempMinC - minInternalTempC + 15) * 1.8))
    );

    // Radiation dose check
    const cruiseDays = resolvedOrbit.cruiseDays ?? 1;
    const radiationDoseKrad =
      cruiseDays * (resolvedOrbit.radiationFluxKradPerDay ?? 0.1) * limits.attenuationFactor;

    if (radiationDoseKrad > limits.effectiveRadLimitKrad) {
      health.avionics = 0;
      return failAtPhase(
        "cruise",
        "6. Cruise, Thermal & Deep-Space Ops",
        `Dose ${radiationDoseKrad.toFixed(1)} krad > ${Math.round(limits.effectiveRadLimitKrad)} krad`,
        `Cumulative ionizing radiation (${radiationDoseKrad.toFixed(1)} krad over ${cruiseDays} days) exceeded flight computer tolerance (${Math.round(limits.effectiveRadLimitKrad)} krad), causing permanent avionics latch-up.`,
        `Upgrade to Radiation-Hardened Avionics and/or add an Aluminum or Tantalum-Poly Shield.`,
        "radiation-fried",
        { radiationDoseKrad: Number(radiationDoseKrad.toFixed(1)), limitKrad: Math.round(limits.effectiveRadLimitKrad) },
        LEO_REFERENCE_ALTITUDE_KM
      );
    }

    health.avionics = Math.max(
      30,
      Math.round(100 - (radiationDoseKrad / Math.max(1, limits.effectiveRadLimitKrad)) * 55)
    );

    // Communications & pointing check
    const targetDistanceKm = options.missionSpec?.targetDistanceKm ?? resolvedOrbit.altitudeKm;
    const requiredDataRate = options.missionSpec?.requiredDataRateKbps ?? 0;
    const commsDelaySec = targetDistanceKm / PHYSICS.SPEED_OF_LIGHT_KMS;

    if (spacecraftSpec.maxRangeKm < targetDistanceKm) {
      health.antenna = 0;
      return failAtPhase(
        "cruise",
        "6. Cruise, Thermal & Deep-Space Ops",
        `Signal lost beyond ${spacecraftSpec.maxRangeKm.toLocaleString()} km`,
        `Spacecraft drifted out of telemetry range (${spacecraftSpec.maxRangeKm.toLocaleString()} km max vs ${targetDistanceKm.toLocaleString()} km target distance).`,
        `Equip a longer-range antenna (Parabolic Dish for Moon, Ka-Band Deep-Space Dish for Mars).`,
        "signal-lost",
        { maxRangeKm: spacecraftSpec.maxRangeKm, targetDistanceKm },
        LEO_REFERENCE_ALTITUDE_KM
      );
    }

    if (
      (resolvedOrbit.id === "MARS" || spacecraftSpec.maxRangeKm >= 10000000) &&
      limits.pointingAccuracyDeg > limits.minAntennaPointingDeg * 2.5
    ) {
      health.antenna = 20;
      return failAtPhase(
        "cruise",
        "6. Cruise, Thermal & Deep-Space Ops",
        `Pointing ±${limits.pointingAccuracyDeg}° missed ±${limits.minAntennaPointingDeg}° beam`,
        `Deep-space dish beamwidth (±${limits.minAntennaPointingDeg}°) lost Earth lock because RCS pointing (±${limits.pointingAccuracyDeg}°) was too coarse across ${Math.round(targetDistanceKm / 1e6)}M km.`,
        `Install a 3-Axis Reaction Wheel Triad or Precision CMG + Dual Star Trackers in Attitude.`,
        "signal-lost",
        { pointingDeg: limits.pointingAccuracyDeg, beamDeg: limits.minAntennaPointingDeg },
        LEO_REFERENCE_ALTITUDE_KM
      );
    }

    if (spacecraftSpec.maxDataRateKbps < requiredDataRate) {
      health.antenna = Math.min(health.antenna, 25);
      return failAtPhase(
        "cruise",
        "6. Cruise, Thermal & Deep-Space Ops",
        `Downlink ${spacecraftSpec.maxDataRateKbps} < ${requiredDataRate} kbps`,
        `Antenna data rate (${spacecraftSpec.maxDataRateKbps} kbps) cannot sustain mission telemetry (${requiredDataRate} kbps required).`,
        `Upgrade to a higher-bandwidth antenna.`,
        "signal-lost",
        { maxDataRateKbps: spacecraftSpec.maxDataRateKbps, requiredDataRate },
        LEO_REFERENCE_ALTITUDE_KM
      );
    }

    result.phases.push({
      id: "cruise",
      name: "6. Cruise, Thermal & Deep-Space Ops",
      status: "passed",
      summary: `${Math.round(cruiseSolarW)}W @ ${solarDistanceAU} AU · ${radiationDoseKrad.toFixed(1)} krad · Delay ${commsDelaySec >= 60 ? `${(commsDelaySec / 60).toFixed(1)}m` : `${commsDelaySec.toFixed(1)}s`}`,
      metrics: {
        cruiseSolarW: Math.round(cruiseSolarW),
        cruisePowerMarginW: Math.round(cruisePowerMarginW),
        minInternalTempC: Math.round(minInternalTempC),
        maxInternalTempC: Math.round(maxInternalTempC),
        radiationDoseKrad: Number(radiationDoseKrad.toFixed(1)),
        commsDelaySec: Number(commsDelaySec.toFixed(2)),
      },
    });

    // ------------------------------------------------------------
    // PHASE 7: TARGET ORBIT INSERTION BURN
    // ------------------------------------------------------------
    if (totalDeltaV < requiredDeltaV) {
      return failAtPhase(
        "orbit-insertion",
        `7. ${resolvedOrbit.targetBody} Orbit Insertion Burn`,
        `Δv ${Math.round(totalDeltaV)} m/s < ${Math.round(requiredDeltaV)} m/s required`,
        `Insufficient delta-v: ${Math.round(totalDeltaV).toLocaleString()} m/s available (${Math.round(launcherDeltaV).toLocaleString()} m/s rocket + ${Math.round(spacecraftDeltaV).toLocaleString()} m/s spacecraft) vs ${Math.round(requiredDeltaV).toLocaleString()} m/s required for ${result.targetOrbitId}. Spacecraft overshot capture into a hyperbolic flyby.`,
        `Increase propellant/Isp (Bipropellant or Ion) or upgrade to a higher-energy launch vehicle.`,
        "missed-capture",
        { totalDeltaVMs: Math.round(totalDeltaV), requiredDeltaVMs: Math.round(requiredDeltaV) },
        LEO_REFERENCE_ALTITUDE_KM
      );
    }

    if (resolvedOrbit.id === "MARS" && limits.burnStability < 0.9) {
      return failAtPhase(
        "orbit-insertion",
        "7. Mars Orbit Insertion Burn",
        `Unstable capture burn (${Math.round(limits.burnStability * 100)}% stability)`,
        `During the critical Mars Orbit Insertion burn (${commsDelaySec >= 60 ? `${(commsDelaySec / 60).toFixed(1)}-min` : ""} autonomous light-delay window), coarse RCS attitude control caused an off-axis burn and missed capture.`,
        `Add 3-Axis Reaction Wheels or CMG + Star Trackers for autonomous capture burn stability.`,
        "missed-capture",
        { burnStability: limits.burnStability },
        LEO_REFERENCE_ALTITUDE_KM
      );
    }

    result.phases.push({
      id: "orbit-insertion",
      name: `7. ${resolvedOrbit.targetBody} Orbit Insertion Burn`,
      status: "passed",
      summary: `Capture nominal · +${Math.round(totalDeltaV - requiredDeltaV)} m/s Δv reserve`,
      metrics: {
        remainingDeltaVMs: Math.round(totalDeltaV - requiredDeltaV),
        captureDeltaVMs,
      },
    });

    result.success = true;
    result.achievedAltitudeKm = resolvedOrbit.altitudeKm ?? 0;
    result.remainingDeltaVMs = totalDeltaV - requiredDeltaV;
    result.failureReason = "";
    result.failedPhaseId = null;
    result.failureCause = "";
    result.failureFix = "";
    result.failureMode = "";
    result.missionStats = {
      launchSiteId: resolvedSite.id,
      launchSiteName: resolvedSite.name,
      launchAzimuthDeg: dvBreakdown.azimuthDeg,
      rotationBonusMs: dvBreakdown.rotationBonusMs,
      planeChangeDeltaVMs: dvBreakdown.planeChangeDeltaVMs,
      azimuthPenaltyMs: dvBreakdown.azimuthPenaltyMs,
      inclinationPenaltyMs: dvBreakdown.inclinationPenaltyMs,
      totalDeltaVMs: Math.round(totalDeltaV),
      requiredDeltaVMs: Math.round(requiredDeltaV),
      twr: Number(twr.toFixed(2)),
      maxQPa,
      peakLaunchG: peakG,
      cruiseDays,
      commsDelaySec: Number(commsDelaySec.toFixed(2)),
      minPowerMarginW: Math.round(cruisePowerMarginW),
      minTempC: Math.round(minInternalTempC),
      maxTempC: Math.round(maxInternalTempC),
      radiationDoseKrad: Number(radiationDoseKrad.toFixed(1)),
      radiationLimitKrad: Math.round(limits.effectiveRadLimitKrad),
    };
    return result;
  }

  _resolveLimits(spec) {
    if (spec.limits && typeof spec.limits === "object") {
      return spec.limits;
    }
    return {
      maxG: 10.0,
      vibrationLimitG: 8.0,
      structuralStrengthKpa: 55,
      maxQExposedKpa: 25,
      tempMinC: -20,
      tempMaxC: 65,
      insulationFactor: 0.5,
      coolingCapacityW: 300,
      baseRadLimitKrad: 75,
      attenuationFactor: 1.0,
      effectiveRadLimitKrad: 75,
      pointingAccuracyDeg: 0.5,
      minAntennaPointingDeg: 1.5,
      burnStability: 0.95,
      stowedDiameterM: 1.4,
      deployableSolar: true,
      deployRisk: 0.04,
      radHardened: true,
      thermalId: "baseline-mli",
      shieldingId: "none-shield",
      reactionWheelId: "baseline-rcs",
    };
  }

  _appendSkippedPhases(phases, failedId, orbit) {
    const body = orbit?.targetBody ?? "Target";
    const order = [
      { id: "liftoff", name: "1. Liftoff & Tower Clear" },
      { id: "max-q", name: "2. Max-Q Aerodynamic Load" },
      { id: "ascent", name: "3. Ascent & Staging" },
      { id: "deployment", name: "4. Parking Orbit & Deployment" },
      {
        id: "tpi-burn",
        name:
          orbit?.id === "LEO"
            ? "5. Orbital Trim & Station-Keeping"
            : `5. ${body} Transfer Injection Burn`,
      },
      { id: "cruise", name: "6. Cruise, Thermal & Deep-Space Ops" },
      { id: "orbit-insertion", name: `7. ${body} Orbit Insertion Burn` },
    ];
    const idx = order.findIndex((p) => p.id === failedId);
    if (idx < 0) return;
    for (let i = idx + 1; i < order.length; i++) {
      phases.push({
        id: order[i].id,
        name: order[i].name,
        status: "skipped",
        summary: "Aborted after prior failure",
      });
    }
  }
}
