/**
 * @file src/modules/game-interface/__tests__/spotlightTour.test.js
 * @goal Unit tests for Phase 7 Step (a): GuidanceStore localStorage try/catch + memory fallback,
 *       i18n strings.en.js + RTL direction, First-Run Welcome Card, and SpotlightTour engine
 *       (missing-target skip, action-gated steps, keyboard navigation, aria-live, resize, mobile).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { applyDocumentDirection, getStrings, setStrings, t } from "../../../shared/i18n/index.js";
import { STRINGS_EN } from "../../../shared/i18n/strings.en.js";
import { GUIDANCE_STORAGE_KEY, GuidanceStore } from "../logic/GuidanceStore.js";
import { SpotlightTour } from "../ui/SpotlightTour.js";

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function createFakeDom(initialWidth = 1280, initialHeight = 800) {
  const targets = new Map();
  const winListeners = {};
  const makeNode = (tag) => {
    const node = {
      tagName: tag.toUpperCase(),
      className: "",
      innerHTML: "",
      textContent: "",
      style: {},
      children: [],
      attributes: {},
      parentNode: null,
      listeners: {},
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); },
      },
      setAttribute(k, v) { this.attributes[k] = v; },
      appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
      },
      removeChild(child) {
        this.children = this.children.filter((c) => c !== child);
        child.parentNode = null;
      },
      addEventListener(type, fn) {
        this.listeners[type] = fn;
      },
      removeEventListener(type, fn) {
        if (this.listeners[type] === fn) delete this.listeners[type];
      },
      querySelector(sel) {
        if (sel === ".oc-tour-card") return this._mockCard ?? null;
        if (sel === '[role="dialog"]') return this._mockCard ?? null;
        return null;
      },
      querySelectorAll() {
        return [];
      },
      focus() {},
    };
    return node;
  };

  const doc = {
    documentElement: { dir: "ltr" },
    activeElement: null,
    createElement: (tag) => makeNode(tag),
    querySelector: (sel) => {
      const m = sel.match(/\[data-tour="([^"]+)"\]/);
      return m ? targets.get(m[1]) ?? null : null;
    },
  };

  const win = {
    innerWidth: initialWidth,
    innerHeight: initialHeight,
    addEventListener(type, fn) {
      winListeners[type] = fn;
    },
    removeEventListener(type, fn) {
      if (winListeners[type] === fn) delete winListeners[type];
    },
  };

  return { targets, doc, win, winListeners, makeNode };
}

test("GuidanceStore persists state to localStorage and falls back in-memory on storage errors", () => {
  const storage = createMemoryStorage();
  const store = new GuidanceStore(storage);
  assert.equal(store.shouldShowWelcomeOnFirstRun(), true);
  assert.equal(store.getState().hintsEnabled, true);

  store.setStepIndex(4);
  store.setHintsEnabled(false);
  store.markCompleted();

  const reloaded = new GuidanceStore(storage);
  assert.equal(reloaded.getState().tutorialCompleted, true);
  assert.equal(reloaded.getState().hintsEnabled, false);
  assert.equal(reloaded.shouldShowWelcomeOnFirstRun(), false);

  const savedRaw = JSON.parse(storage.getItem(GUIDANCE_STORAGE_KEY));
  assert.equal(savedRaw.tutorialCompleted, true);

  // Throwing localStorage must never crash
  const throwingStorage = {
    getItem() { throw new Error("SecurityError"); },
    setItem() { throw new Error("QuotaExceededError"); },
  };
  const fallbackStore = new GuidanceStore(throwingStorage);
  fallbackStore.setStepIndex(2);
  fallbackStore.markDismissed();
  assert.equal(fallbackStore.getState().tutorialStepIndex, 2);
  assert.equal(fallbackStore.getState().tutorialDismissed, true);
});

test("i18n strings.en.js interpolation and RTL switching work cleanly", () => {
  const prevDoc = globalThis.document;
  globalThis.document = { documentElement: { dir: "ltr" } };
  try {
    assert.equal(t("tour.stepCounter", { current: 3, total: 15 }), "3 / 15");
    setStrings({ ...STRINGS_EN, dir: "rtl" });
    assert.equal(globalThis.document.documentElement.dir, "rtl");
    applyDocumentDirection("ltr");
    assert.equal(globalThis.document.documentElement.dir, "ltr");
    setStrings(STRINGS_EN);
    assert.equal(getStrings().locale, "en");
  } finally {
    globalThis.document = prevDoc;
  }
});

test("SpotlightTour shows Welcome card, skips missing data-tour targets, gates actions, and supports keyboard", () => {
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const prevW = globalThis.innerWidth;
  const prevH = globalThis.innerHeight;

  const { targets, doc, win, winListeners, makeNode } = createFakeDom(1280, 800);
  globalThis.document = doc;
  globalThis.window = win;
  globalThis.innerWidth = 1280;
  globalThis.innerHeight = 800;

  try {
    const store = new GuidanceStore(createMemoryStorage());
    const host = makeNode("div");
    let started = false;
    let finished = false;

    const tour = new SpotlightTour(host, store, {
      onStartTutorial: () => {
        started = true;
      },
      onFinish: () => {
        finished = true;
      },
    });

    // 1. First-run welcome card renders all 3 required buttons
    tour.showWelcome();
    assert.equal(tour.isWelcomeOpen(), true);
    assert.ok(tour._root.innerHTML.includes(STRINGS_EN.welcome.title));
    assert.ok(tour._root.innerHTML.includes(STRINGS_EN.welcome.startBtn));
    assert.ok(tour._root.innerHTML.includes(STRINGS_EN.welcome.skipBtn));
    assert.ok(tour._root.innerHTML.includes(STRINGS_EN.welcome.dismissBtn));

    // Clicking Start Tour fires callback
    tour._root.listeners.click({
      target: { closest: () => ({ dataset: { tourAction: "start-tour" }, disabled: false }) },
    });
    assert.equal(started, true);

    // 2. Spotlight steps: configure 3 steps where middle step's data-tour target is MISSING
    targets.set("step-1", {
      getBoundingClientRect: () => ({ top: 100, left: 40, width: 220, height: 80 }),
    });
    targets.set("step-3", {
      getBoundingClientRect: () => ({ top: 260, left: 60, width: 200, height: 60 }),
    });

    const mockCard = makeNode("section");
    tour.setSteps([
      { id: "step-1", phase: "mission", title: "Step One", body: "Pick mission.", actionRequired: "pick-bus" },
      { id: "missing-step-2", phase: "mission", title: "Missing", body: "Should skip." },
      { id: "step-3", phase: "mission", title: "Step Three", body: "Final step." },
    ]);

    assert.equal(tour.start(0), true);
    tour._root._mockCard = mockCard;
    tour._renderStep();

    // Action-gated step blocks Next until action is completed
    assert.equal(tour.nextStep(), false);
    assert.ok(tour._root.innerHTML.includes('data-tour-action="next-step" disabled'));

    // Completing action unlocks Next and jumps over missing "missing-step-2" straight to step-3
    tour.markActionCompleted("pick-bus");
    assert.equal(tour.nextStep(), true);
    assert.equal(tour._stepIndex, 2);
    assert.ok(tour._liveRegion.textContent.includes("Step Three"));

    // ArrowLeft moves cleanly backward skipping missing-step-2 back to step-1
    winListeners.keydown({ key: "ArrowLeft", preventDefault() {} });
    assert.equal(tour._stepIndex, 0);

    // ArrowRight advances again to step-3, then Finish completes tour
    winListeners.keydown({ key: "ArrowRight", preventDefault() {} });
    assert.equal(tour._stepIndex, 2);
    tour.nextStep();
    assert.equal(finished, true);
    assert.equal(store.getState().tutorialCompleted, true);
    assert.equal(tour.isActive(), false);
  } finally {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
    globalThis.innerWidth = prevW;
    globalThis.innerHeight = prevH;
  }
});

test("First-run welcome only auto-shows once and multi-phase SpotlightTour tracks 15 steps cleanly", () => {
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;

  const { targets, doc, win, makeNode } = createFakeDom(1280, 800);
  globalThis.document = doc;
  globalThis.window = win;

  try {
    const storage = createMemoryStorage();
    const store = new GuidanceStore(storage);
    const host = makeNode("div");
    const tour = new SpotlightTour(host, store);

    // First run shows welcome, then persisted welcomeSeen prevents re-showing on reload
    assert.equal(store.shouldShowWelcomeOnFirstRun(), true);
    tour.showWelcome();
    assert.equal(store.getState().welcomeSeen, true);
    assert.equal(new GuidanceStore(storage).shouldShowWelcomeOnFirstRun(), false);

    // Wire mission + spacecraft + launch + results targets and step across phases
    for (const id of [
      "mission-list",
      "topbar-hud",
      "select-mission-btn",
      "subsystem-tabs",
      "structure-card",
      "launch-vehicle-cards",
      "results-modal",
      "results-actions",
    ]) {
      targets.set(id, {
        getBoundingClientRect: () => ({ top: 80, left: 40, width: 220, height: 80 }),
      });
    }

    assert.equal(tour.start(0), true);
    assert.equal(tour._stepIndex, 0);
    // Same-phase sync must NOT jump back to step 0 when on step 1
    assert.equal(tour.nextStep(), true);
    assert.equal(tour._stepIndex, 1);
    assert.equal(tour.syncPhase("mission"), false);
    assert.equal(tour._stepIndex, 1);

    // Entering spacecraft phase advances smoothly to step 3 ("subsystem-tabs")
    assert.equal(tour.syncPhase("spacecraft"), true);
    assert.equal(tour._steps[tour._stepIndex].id, "subsystem-tabs");
    // Step 4 ("structure-card") gates on select-bus
    assert.equal(tour.nextStep(), true);
    assert.equal(tour._steps[tour._stepIndex].id, "structure-card");
    assert.equal(tour.nextStep(), false);
    tour.markActionCompleted("select-bus");
    // At last mounted spacecraft step, nextStep pauses waiting for launch phase
    assert.equal(tour.nextStep(), true);
    assert.equal(tour._waitingForPhase, true);
    assert.equal(tour.syncPhase("launch"), true);
    assert.equal(tour._steps[tour._stepIndex].id, "launch-vehicle-cards");
    assert.equal(tour.syncPhase("results"), true);
    assert.equal(tour._steps[tour._stepIndex].id, "results-modal");
    assert.equal(tour.nextStep(), true);
    assert.equal(tour._steps[tour._stepIndex].id, "results-actions");
    assert.equal(tour.nextStep(), true);
    assert.equal(store.getState().tutorialCompleted, true);
  } finally {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
  }
});
