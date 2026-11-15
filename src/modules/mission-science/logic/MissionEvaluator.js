
/**
 * @file src/modules/mission-science/logic/MissionEvaluator.js
 * @owner Member 1 (Mission & Science)
 * @goal Evaluates mission success, failure reasons, and final score by comparing
 *       MissionSpec requirements against SpacecraftSpec and LaunchResult.
 */

export class MissionEvaluator {
  /**
   * Check whether the spacecraft and launch satisfy all mission requirements.
   *
   * @param {import('../../../shared/interfaces/MissionSpec.js').MissionSpec} missionSpec
   * @param {import('../../../shared/interfaces/SpacecraftSpec.js').SpacecraftSpec} spacecraftSpec
   * @param {import('../../../shared/interfaces/LaunchResult.js').LaunchResult} launchResult
   * @returns {{ passed: boolean, checks: Array<{ label: string, passed: boolean, detail: string }> }}
   */
  checkRequirements(missionSpec, spacecraftSpec, launchResult) {
    const checks = [];

    // 1. Validate input objects
    if (!missionSpec || !spacecraftSpec || !launchResult) {
      return {
        passed: false,
        checks: [{
          label: "Input validation",
          passed: false,
          detail: "One or more mission evaluation inputs are missing.",
        }],
      };
    }

    const instruments = missionSpec.instruments ?? [];

    // Calculate scientific payload values
    const sciencePoints = instruments.reduce(
      (total, instrument) => total + instrument.sciencePoints,
      0
    );

    const instrumentCost = instruments.reduce(
      (total, instrument) => total + instrument.costMillions,
      0
    );

    const instrumentDataRate = instruments.reduce(
      (total, instrument) => total + instrument.dataRateKbps,
      0
    );

    // 2. Budget check
    const totalCost =
      instrumentCost +
      spacecraftSpec.costMillions +
      launchResult.launchCostMillions;

    const budgetPassed = totalCost <= missionSpec.budgetMillions;

    checks.push({
      label: "Mission budget",
      passed: budgetPassed,
      detail: budgetPassed
        ? `Total cost: $${totalCost.toFixed(2)}M / $${missionSpec.budgetMillions}M.`
        : `Budget exceeded by $${(totalCost - missionSpec.budgetMillions).toFixed(2)}M.`,
    });

    // 3. Spacecraft validity check
    checks.push({
      label: "Spacecraft compatibility",
      passed: spacecraftSpec.isValid,
      detail: spacecraftSpec.isValid
        ? "All spacecraft compatibility checks passed."
        : `Spacecraft is invalid: ${(spacecraftSpec.errors ?? []).join(" ")}`,
    });

    // 4. Power balance check
    const powerPassed =
      spacecraftSpec.powerGeneratedWatts >= spacecraftSpec.powerConsumedWatts;

    const powerMargin =
      spacecraftSpec.powerGeneratedWatts - spacecraftSpec.powerConsumedWatts;

    checks.push({
      label: "Power balance",
      passed: powerPassed,
      detail: powerPassed
        ? `Power surplus: ${powerMargin.toFixed(2)} W.`
        : `Power deficit: ${Math.abs(powerMargin).toFixed(2)} W.`,
    });

    // 5. Antenna range check
    const rangePassed =
      spacecraftSpec.maxRangeKm >= missionSpec.targetDistanceKm;

    checks.push({
      label: "Communication range",
      passed: rangePassed,
      detail: rangePassed
        ? `Antenna range: ${spacecraftSpec.maxRangeKm} km / ${missionSpec.targetDistanceKm} km required.`
        : `Antenna range is insufficient. Required: ${missionSpec.targetDistanceKm} km, available: ${spacecraftSpec.maxRangeKm} km.`,
    });

    // 6. Communication data rate check
    const dataRatePassed =
      spacecraftSpec.maxDataRateKbps >= missionSpec.requiredDataRateKbps;

    checks.push({
      label: "Downlink data rate",
      passed: dataRatePassed,
      detail: dataRatePassed
        ? `Downlink capacity: ${spacecraftSpec.maxDataRateKbps} kbps / ${missionSpec.requiredDataRateKbps} kbps required.`
        : `Insufficient downlink capacity. Required: ${missionSpec.requiredDataRateKbps} kbps, available: ${spacecraftSpec.maxDataRateKbps} kbps.`,
    });

    // 7. Scientific return check (requires mission to reach orbit to return science)
    const scienceReturned = launchResult.success ? sciencePoints : 0;
    const sciencePassed =
      Boolean(launchResult.success) && scienceReturned >= missionSpec.minSciencePoints;

    checks.push({
      label: "Scientific objectives",
      passed: sciencePassed,
      detail: !launchResult.success
        ? `No science returned — mission lost before science operations (${sciencePoints} pts configured, 0 pts collected).`
        : sciencePassed
          ? `Science score: ${sciencePoints} / ${missionSpec.minSciencePoints} required.`
          : `Insufficient science points. Required: ${missionSpec.minSciencePoints}, obtained: ${sciencePoints}.`,
    });

    // 8. Launch and orbit check
    const orbitPassed =
      launchResult.success &&
      launchResult.targetOrbitId === missionSpec.targetOrbitId;

    let orbitDetail;

    if (!launchResult.success) {
      orbitDetail = launchResult.failureReason ||
        "Launch failed to reach the target orbit.";
    } else if (launchResult.targetOrbitId !== missionSpec.targetOrbitId) {
      orbitDetail =
        `Orbit mismatch. Required: ${missionSpec.targetOrbitId}, achieved: ${launchResult.targetOrbitId}.`;
    } else {
      orbitDetail =
        `Successfully reached target orbit: ${missionSpec.targetOrbitId}.`;
    }

    checks.push({
      label: "Launch and orbit",
      passed: orbitPassed,
      detail: orbitDetail,
    });

    return {
      passed: checks.every((check) => check.passed),
      checks,
    };
  }

  /**
   * Compute overall mission performance score (0–100) and feedback summary.
   *
   * Scoring weights:
   * Science return:       35 points
   * Budget compliance:    20 points
   * Power balance:        15 points
   * Communications:       15 points
   * Spacecraft validity:   5 points
   * Launch outcome:        10 points
   *
   * @param {import('../../../shared/interfaces/MissionSpec.js').MissionSpec} missionSpec
   * @param {import('../../../shared/interfaces/SpacecraftSpec.js').SpacecraftSpec} spacecraftSpec
   * @param {import('../../../shared/interfaces/LaunchResult.js').LaunchResult} launchResult
   * @returns {{ score: number, grade: string, summary: string, checks: Array<Object> }}
   */
  calculateScore(missionSpec, spacecraftSpec, launchResult) {
    const evaluation = this.checkRequirements(
      missionSpec,
      spacecraftSpec,
      launchResult
    );

    if (!missionSpec || !spacecraftSpec || !launchResult) {
      return {
        score: 0,
        grade: "F",
        summary: "Mission evaluation could not be completed because input data is missing.",
        checks: evaluation.checks,
      };
    }

    const instruments = missionSpec.instruments ?? [];

    const sciencePoints = instruments.reduce(
      (total, instrument) => total + instrument.sciencePoints,
      0
    );

    const instrumentCost = instruments.reduce(
      (total, instrument) => total + instrument.costMillions,
      0
    );

    const totalCost =
      instrumentCost +
      spacecraftSpec.costMillions +
      launchResult.launchCostMillions;

    // Prevent ratios from exceeding 1.
    const ratio = (actual, required) => {
      if (required <= 0) return 1;
      return Math.min(actual / required, 1);
    };

    // 1. Science return: 35 points (capped at 0 if launch/orbit failed before science return)
    const missionSucceeded = Boolean(launchResult.success);
    const scienceScore = missionSucceeded
      ? 35 * ratio(sciencePoints, missionSpec.minSciencePoints)
      : 0;

    // 2. Budget compliance: 20 points
    const budgetScore =
      20 * (
        totalCost <= missionSpec.budgetMillions
          ? 1
          : ratio(missionSpec.budgetMillions, totalCost)
      );

    // 3. Power balance: 15 points
    const powerScore =
      15 * ratio(
        spacecraftSpec.powerGeneratedWatts,
        spacecraftSpec.powerConsumedWatts
      );

    // 4. Communications: 15 points
    const rangeScore =
      7.5 * ratio(
        spacecraftSpec.maxRangeKm,
        missionSpec.targetDistanceKm
      );

    const dataRateScore =
      7.5 * ratio(
        spacecraftSpec.maxDataRateKbps,
        missionSpec.requiredDataRateKbps
      );

    const communicationScore = rangeScore + dataRateScore;

    // 5. Spacecraft validity: 5 points
    const spacecraftScore = spacecraftSpec.isValid ? 5 : 0;

    // 6. Launch outcome: 10 points
    const launchScore =
      missionSucceeded &&
      launchResult.targetOrbitId === missionSpec.targetOrbitId
        ? 10
        : 0;

    // Final score (lost missions cannot exceed D grade / 69)
    const rawScore =
      scienceScore +
      budgetScore +
      powerScore +
      communicationScore +
      spacecraftScore +
      launchScore;

    const score = missionSucceeded
      ? Math.round(rawScore)
      : Math.min(Math.round(rawScore), 69);

    // Grade
    let grade;

    if (!missionSucceeded) {
      grade = score >= 60 ? "D" : "F";
    } else if (score >= 90) grade = "A";
    else if (score >= 80) grade = "B";
    else if (score >= 70) grade = "C";
    else if (score >= 60) grade = "D";
    else grade = "F";

    // Feedback summary
    const failedChecks = evaluation.checks.filter(
      (check) => !check.passed
    );

    let summary;

    if (evaluation.passed) {
      summary =
        `Mission successful! All requirements satisfied. ` +
        `Final score: ${score}/100 (${grade}).`;
    } else {
      const failures = failedChecks
        .map((check) => check.label)
        .join(", ");

      summary =
        `Mission requirements not fully satisfied. ` +
        `Issues detected: ${failures}. ` +
        `Final score: ${score}/100 (${grade}).`;
    }

    return {
      score,
      grade,
      summary,
      checks: evaluation.checks,
      budget: {
        startingBudget: missionSpec.budgetMillions,
        totalCost: Number(totalCost.toFixed(2)),
        budgetRemaining: Number((missionSpec.budgetMillions - totalCost).toFixed(2)),
        instrumentsCost: Number(instrumentCost.toFixed(2)),
        spacecraftCost: Number(spacecraftSpec.costMillions.toFixed(2)),
        launchCost: Number(launchResult.launchCostMillions.toFixed(2)),
      },
    };
  }
}

