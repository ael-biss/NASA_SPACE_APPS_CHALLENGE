/**
 * @file src/modules/game-interface/logic/DesignRecordsStore.js
 * @owner Member 4 (Interface & Integration)
 * @goal Persists best spacecraft designs per mission in localStorage and exports
 *       a high-contrast NASA-style mission debrief result card as a PNG image.
 */

export const BEST_DESIGNS_STORAGE_KEY = "orbitCraft.bestDesigns.v1";

function getStorage(storageOverride) {
  if (storageOverride) return storageOverride;
  try {
    return typeof globalThis.localStorage !== "undefined" ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Load all saved best mission designs keyed by missionId.
 * @param {Storage} [storageOverride]
 * @returns {Record<string, Object>}
 */
export function loadBestDesigns(storageOverride) {
  const storage = getStorage(storageOverride);
  if (!storage) return {};
  try {
    const raw = storage.getItem(BEST_DESIGNS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Retrieve the best recorded design for a given missionId.
 * @param {string} missionId
 * @param {Storage} [storageOverride]
 * @returns {Object | null}
 */
export function getBestDesign(missionId, storageOverride) {
  if (!missionId) return null;
  const all = loadBestDesigns(storageOverride);
  return all[missionId] ?? null;
}

/**
 * Save a design if it improves on the mission's best score (or matches score at lower total cost).
 * @param {{ mission?: Object, spacecraft?: Object, launchResult?: Object, evaluationResult: Object, passed?: boolean }} entry
 * @param {Storage} [storageOverride]
 * @returns {{ record: Object | null, isNewBest: boolean, previousBest: Object | null }}
 */
export function saveBestDesign(
  { mission, spacecraft, launchResult, evaluationResult, passed },
  storageOverride
) {
  const missionId = mission?.id ?? launchResult?.targetOrbitId ?? "CUSTOM_MISSION";
  const all = loadBestDesigns(storageOverride);
  const previousBest = all[missionId] ?? null;

  const score = Number(evaluationResult?.score ?? 0);
  const totalCost = Number(
    evaluationResult?.budget?.totalCost ??
      ((spacecraft?.costMillions ?? 0) + (launchResult?.launchCostMillions ?? 0))
  );

  const record = {
    missionId,
    missionName: mission?.name ?? missionId,
    targetOrbitId: mission?.targetOrbitId ?? launchResult?.targetOrbitId ?? "LEO",
    score,
    grade: evaluationResult?.grade ?? "—",
    passed: Boolean(passed),
    rocketId: launchResult?.rocketId ?? null,
    rocketName: launchResult?.rocketName ?? "Unknown Rocket",
    fairingId: launchResult?.fairingId ?? "standard-fairing",
    selection: spacecraft?.selection ? { ...spacecraft.selection } : null,
    instrumentIds: Array.isArray(mission?.instruments)
      ? mission.instruments.map((i) => i.id)
      : [],
    totalMassKg: Math.round(spacecraft?.totalMassKg ?? 0),
    totalCostMillions: Number(totalCost.toFixed(1)),
    deltaVMarginMs:
      typeof launchResult?.remainingDeltaVMs === "number"
        ? Math.round(launchResult.remainingDeltaVMs)
        : null,
    savedAt: new Date().toISOString(),
  };

  const beatsPrev =
    !previousBest ||
    record.score > Number(previousBest.score ?? -1) ||
    (record.score === Number(previousBest.score ?? -1) &&
      record.totalCostMillions < Number(previousBest.totalCostMillions ?? Infinity));

  if (!beatsPrev) {
    return { record: previousBest, isNewBest: false, previousBest };
  }

  const next = { ...all, [missionId]: record };
  const storage = getStorage(storageOverride);
  if (storage) {
    try {
      storage.setItem(BEST_DESIGNS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota / security errors cleanly
    }
  }

  return { record, isNewBest: true, previousBest };
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Draw the debrief summary card to a 2D canvas and return a PNG data URL (or null if unavailable).
 * @param {Object} summary
 * @returns {string | null}
 */
export function renderResultCardDataUrl(summary) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext?.("2d");
  if (!ctx) return null;

  // Deep Space gradient background
  const bg = ctx.createLinearGradient(0, 0, 960, 540);
  bg.addColorStop(0, "#050B1B");
  bg.addColorStop(1, "#0B162C");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 960, 540);

  // Subtle star speckles
  ctx.fillStyle = "rgba(234, 244, 255, 0.25)";
  for (let i = 0; i < 65; i++) {
    const sx = ((i * 173 + 37) % 940) + 10;
    const sy = ((i * 97 + 53) % 520) + 10;
    ctx.fillRect(sx, sy, i % 4 === 0 ? 2 : 1.5, i % 4 === 0 ? 2 : 1.5);
  }

  // Outer card frame
  drawRoundedRect(ctx, 24, 24, 912, 492, 16);
  ctx.fillStyle = "rgba(16, 29, 51, 0.88)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = summary.passed ? "#35D58A" : summary.orbitReached ? "#FF9D24" : "#FF5364";
  ctx.stroke();

  // Top Header
  ctx.fillStyle = "#19BFFF";
  ctx.font = "700 15px Rajdhani, Orbitron, sans-serif";
  ctx.fillText("ORBIT CRAFT · MISSION TELEMETRY CARD", 52, 66);

  const badgeColor = summary.passed ? "#35D58A" : summary.orbitReached ? "#FF9D24" : "#FF5364";
  ctx.fillStyle = badgeColor;
  ctx.font = "700 14px Rajdhani, sans-serif";
  ctx.fillText(String(summary.badgeText || "MISSION DEBRIEF"), 52, 92);

  ctx.fillStyle = "#EAF4FF";
  ctx.font = "800 30px Orbitron, sans-serif";
  ctx.fillText(String(summary.missionName || "Space Mission").slice(0, 38), 52, 132);

  ctx.fillStyle = "#8CA3BF";
  ctx.font = "500 16px Inter, system-ui, sans-serif";
  ctx.fillText(String(summary.headlineSub || "").slice(0, 82), 52, 162);

  // Grade pill top right
  drawRoundedRect(ctx, 780, 48, 128, 92, 12);
  ctx.fillStyle = "rgba(5, 11, 27, 0.8)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = badgeColor;
  ctx.stroke();

  ctx.fillStyle = badgeColor;
  ctx.font = "800 40px Orbitron, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(summary.grade || "—"), 844, 102);
  ctx.fillStyle = "#EAF4FF";
  ctx.font = "700 15px Rajdhani, sans-serif";
  ctx.fillText(`${summary.score ?? 0} / 100`, 844, 126);
  ctx.textAlign = "left";

  // Metrics strip (4 boxes)
  const cards = [
    { label: "TARGET ORBIT", val: summary.orbitLabel || "—" },
    { label: "ΔV MARGIN", val: summary.dvDisplay || "—" },
    { label: "WET MASS", val: `${summary.playerMassKg ?? 0} kg` },
    { label: "TOTAL COST", val: summary.costDisplay || "—" },
  ];
  cards.forEach((c, idx) => {
    const cx = 52 + idx * 218;
    drawRoundedRect(ctx, cx, 192, 204, 88, 10);
    ctx.fillStyle = "rgba(5, 11, 27, 0.72)";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(25, 191, 255, 0.35)";
    ctx.stroke();

    ctx.fillStyle = "#8CA3BF";
    ctx.font = "700 12px Rajdhani, sans-serif";
    ctx.fillText(c.label, cx + 14, 218);

    ctx.fillStyle = "#EAF4FF";
    ctx.font = "700 19px Inter, system-ui, sans-serif";
    ctx.fillText(String(c.val).slice(0, 18), cx + 14, 254);
  });

  // Real Mission vs Your Design Comparison Block
  drawRoundedRect(ctx, 52, 302, 856, 128, 12);
  ctx.fillStyle = "rgba(5, 11, 27, 0.65)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 157, 36, 0.45)";
  ctx.stroke();

  ctx.fillStyle = "#FF9D24";
  ctx.font = "700 14px Rajdhani, sans-serif";
  ctx.fillText(`BENCHMARK COMPARISON · ${summary.realName || "Real NASA Mission"} vs YOUR DESIGN`, 70, 330);

  ctx.fillStyle = "#EAF4FF";
  ctx.font = "600 16px Inter, system-ui, sans-serif";
  ctx.fillText(
    `Reference: ${summary.realMassKg ?? "—"} kg · ${summary.realOrbit || "—"} · $${summary.realCostM ?? "—"}M (${summary.realLauncher || "Launcher"})`,
    70,
    364
  );
  ctx.fillStyle = "#19BFFF";
  ctx.fillText(
    `Your Craft: ${summary.playerMassKg ?? "—"} kg · ${summary.orbitLabel || "—"} · ${summary.costDisplay || "—"} (${summary.rocketName || "Rocket"})`,
    70,
    398
  );

  // Footer: achievements + personal best
  ctx.fillStyle = "#8CA3BF";
  ctx.font = "600 14px Rajdhani, sans-serif";
  const bestText = summary.bestScore != null ? `PERSONAL BEST: ${summary.bestScore}/100 (${summary.bestGrade})` : "";
  ctx.fillText(bestText, 52, 476);

  ctx.textAlign = "right";
  ctx.fillStyle = "#19BFFF";
  ctx.fillText("ORBIT CRAFT · NASA SPACE APPS EDITION", 908, 476);
  ctx.textAlign = "left";

  return canvas.toDataURL("image/png");
}

/**
 * Trigger a browser PNG download for the rendered mission result card.
 * @param {Object} summary
 * @param {string} [filename]
 * @returns {boolean}
 */
export function downloadResultCardPng(summary, filename) {
  const dataUrl = renderResultCardDataUrl(summary);
  if (!dataUrl || typeof document === "undefined") return false;
  const link = document.createElement("a");
  const safeId = String(summary.missionId || "mission").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  link.download = filename || `orbit-craft-${safeId}-result.png`;
  link.href = dataUrl;
  document.body.appendChild?.(link);
  link.click?.();
  link.remove?.();
  return true;
}
