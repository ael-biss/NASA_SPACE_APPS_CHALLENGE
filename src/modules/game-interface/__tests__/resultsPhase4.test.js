/**
 * @file src/modules/game-interface/__tests__/resultsPhase4.test.js
 * @owner Member 4 (Interface & Integration)
 * @goal Unit tests for Phase 4 Results & Education: top summary with collapsed details,
 *       Real Mission vs Your Design comparison, Retry with Fixes keeping design state,
 *       localStorage best design persistence, and PNG result card download.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { GameState } from "../../../core/GameState.js";
import { getMissionById } from "../../mission-science/data/missions.js";
import { DEFAULT_SELECTION } from "../../spacecraft-design/data/components.js";
import { SpacecraftConfig } from "../../spacecraft-design/logic/SpacecraftConfig.js";
import {
  BEST_DESIGNS_STORAGE_KEY,
  downloadResultCardPng,
  getBestDesign,
  saveBestDesign,
} from "../logic/DesignRecordsStore.js";
import { MissionResultsModal } from "../ui/MissionResultsModal.js";

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test("DesignRecordsStore saves highest score per mission in localStorage and tie-breaks on lower cost", () => {
  const storage = createMemoryStorage();
  const mission = getMissionById("MISSION_LUNAR_ORBIT");
  const sc = new SpacecraftConfig({ ...DEFAULT_SELECTION, antennaId: "deep-space-dish" }).toSpacecraftSpec();

  const first = saveBestDesign(
    {
      mission,
      spacecraft: sc,
      launchResult: { rocketId: "heavy-lift", rocketName: "Heavy-Lift", targetOrbitId: "LUNAR", launchCostMillions: 65, remainingDeltaVMs: 420 },
      evaluationResult: { score: 82, grade: "B", budget: { totalCost: 155 } },
      passed: true,
    },
    storage
  );
  assert.equal(first.isNewBest, true);
  assert.equal(getBestDesign("MISSION_LUNAR_ORBIT", storage).score, 82);

  // Lower score must not overwrite saved personal best
  const lower = saveBestDesign(
    {
      mission,
      spacecraft: sc,
      launchResult: { rocketId: "heavy-lift", rocketName: "Heavy-Lift", targetOrbitId: "LUNAR", launchCostMillions: 65 },
      evaluationResult: { score: 45, grade: "F", budget: { totalCost: 120 } },
      passed: false,
    },
    storage
  );
  assert.equal(lower.isNewBest, false);
  assert.equal(getBestDesign("MISSION_LUNAR_ORBIT", storage).score, 82);

  // Same score at lower cost becomes new personal best
  const cheaperTie = saveBestDesign(
    {
      mission,
      spacecraft: sc,
      launchResult: { rocketId: "heavy-lift", rocketName: "Heavy-Lift", targetOrbitId: "LUNAR", launchCostMillions: 65 },
      evaluationResult: { score: 82, grade: "B", budget: { totalCost: 140 } },
      passed: true,
    },
    storage
  );
  assert.equal(cheaperTie.isNewBest, true);
  const stored = JSON.parse(storage.getItem(BEST_DESIGNS_STORAGE_KEY));
  assert.equal(stored.MISSION_LUNAR_ORBIT.totalCostMillions, 140);
  assert.equal(stored.MISSION_LUNAR_ORBIT.selection.antennaId, "deep-space-dish");
});

test("MissionResultsModal renders top summary, Real Mission vs Your Design card, collapsed breakdown, and Retry with Fixes", () => {
  const prevStorage = globalThis.localStorage;
  globalThis.localStorage = createMemoryStorage();

  const handlers = {};
  const makeBtn = (action) => ({
    addEventListener(type, fn) {
      handlers[action] = fn;
    },
  });
  const mockContainer = {
    innerHTML: "",
    querySelector(sel) {
      const m = sel.match(/data-modal-action="([^"]+)"/);
      return m ? makeBtn(m[1]) : null;
    },
  };

  try {
    const modal = new MissionResultsModal(mockContainer);
    const lroMission = getMissionById("MISSION_LUNAR_ORBIT");
    const scSpec = new SpacecraftConfig({ ...DEFAULT_SELECTION, structureId: "medium-oct" }).toSpacecraftSpec();

    let retriedWithFixes = false;
    modal.show(
      {
        score: 38,
        grade: "F",
        summary: "Mission failed during ascent due to G-load overshoot.",
        checks: [
          { label: "Mission budget", passed: true, detail: "$150M / $230M" },
          { label: "Launch trajectory", passed: false, detail: "Rocket structural failure" },
        ],
        budget: {
          startingBudget: 230,
          instrumentsCost: 30,
          spacecraftCost: scSpec.costMillions,
          launchCost: 65,
          totalCost: 150,
          budgetRemaining: 80,
        },
      },
      {
        success: false,
        failedPhaseId: "ascent",
        failureMode: "structural-breakup",
        failureCause: "Peak acceleration exceeded structural bus rating.",
        failureFix: "Upgrade to a stronger structural bus or liquid rocket.",
        targetOrbitId: "LUNAR",
        rocketName: "Heavy-Lift",
        launchCostMillions: 65,
        phases: [{ id: "ascent", name: "Ascent", status: "failed", summary: "Max G exceeded" }],
        componentHealth: { structure: 0, propulsion: 40 },
      },
      {
        onModifyDesign: () => {
          retriedWithFixes = true;
        },
      },
      { mission: lroMission, spacecraft: scSpec }
    );

    const html = mockContainer.innerHTML;
    assert.ok(html.includes("WHAT WENT WRONG"), "renders top what-went-wrong summary");
    assert.ok(html.includes("How to Fix:"), "renders concrete fix hint at top");
    assert.ok(html.includes("NASA LRO (2009)"), "renders real reference mission card");
    assert.ok(html.includes("1,916 kg"), "renders real LRO mass");
    assert.ok(html.includes("50 km Lunar Polar Orbit"), "renders real LRO orbit");
    assert.ok(html.includes("$504M"), "renders real LRO cost");
    assert.ok(html.includes("Retry with Fixes"), "renders Retry with Fixes button");
    assert.ok(html.includes("Download Result Card (PNG)"), "renders Download Result Card button");
    assert.ok(html.includes('<details class="oc-details gi-breakdown">'), "detailed breakdown starts collapsed (no open attr)");

    // Clicking Retry with Fixes invokes onModifyDesign keeping previous design intact
    handlers.modify();
    assert.equal(retriedWithFixes, true);

    const gs = new GameState();
    gs.setMission(lroMission);
    gs.setSpacecraft(scSpec);
    gs.setPhase("spacecraft");
    assert.equal(gs.spacecraft.selection.structureId, "medium-oct");
    assert.equal(gs.mission.id, "MISSION_LUNAR_ORBIT");
  } finally {
    globalThis.localStorage = prevStorage;
  }
});

test("downloadResultCardPng renders PNG card onto 2D canvas and triggers download", () => {
  const prevDoc = globalThis.document;
  let downloadedName = "";
  let downloadedHref = "";
  let clicked = false;

  const mockCtx = {
    createLinearGradient: () => ({ addColorStop() {} }),
    fillRect() {},
    beginPath() {},
    moveTo() {},
    arcTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    fillText() {},
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
  };
  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: () => mockCtx,
    toDataURL: (mime) => `data:${mime};base64,TESTPNG`,
  };
  const mockLink = {
    download: "",
    href: "",
    click() {
      clicked = true;
      downloadedName = this.download;
      downloadedHref = this.href;
    },
    remove() {},
  };

  globalThis.document = {
    createElement: (tag) => (tag === "canvas" ? mockCanvas : mockLink),
    body: { appendChild() {} },
  };

  try {
    const ok = downloadResultCardPng({
      missionId: "MISSION_LUNAR_ORBIT",
      missionName: "Lunar Polar Exploration",
      passed: true,
      grade: "A",
      score: 94,
    });
    assert.equal(ok, true);
    assert.equal(clicked, true);
    assert.equal(downloadedName, "orbit-craft-mission-lunar-orbit-result.png");
    assert.equal(downloadedHref, "data:image/png;base64,TESTPNG");
  } finally {
    globalThis.document = prevDoc;
  }
});
