/**
 * @file src/modules/game-interface/__tests__/audioAndOnboarding.test.js
 * @owner Member 4 (Interface & Integration)
 * @goal Unit tests for Phase 5 Web Audio SFX (countdown, engine, alarm, success, mute toggle)
 *       and 3-step onboarding tutorial tooltips + contextual Hint button.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { GameState } from "../../../core/GameState.js";
import { AUDIO_MUTE_STORAGE_KEY, SoundEffectsManager } from "../../../shared/utils/SoundEffects.js";
import {
  TUTORIAL_STEPS,
  TUTORIAL_STORAGE_KEY,
  OnboardingGuide,
  buildContextualHint,
} from "../ui/OnboardingGuide.js";

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function createMockAudioContext(stats) {
  return class MockAudioContext {
    constructor() {
      this.currentTime = 0;
      this.sampleRate = 44100;
      this.state = "running";
      this.destination = {};
      stats.created += 1;
    }
    createOscillator() {
      stats.oscillators += 1;
      return {
        type: "sine",
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 440 },
        connect() {},
        start() {
          stats.started += 1;
        },
        stop() {},
      };
    }
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
          setTargetAtTime() {},
          value: 1,
        },
        connect() {},
        disconnect() {},
      };
    }
    createBuffer(_ch, len) {
      return { getChannelData: () => new Float32Array(len) };
    }
    createBufferSource() {
      stats.noiseSources += 1;
      return { buffer: null, loop: false, connect() {}, start() {}, stop() {} };
    }
    createBiquadFilter() {
      return { type: "lowpass", frequency: { value: 300, setTargetAtTime() {} }, connect() {} };
    }
  };
}

test("SoundEffectsManager synthesizes countdown, engine, alarm, success SFX and respects mute toggle", () => {
  const prevStorage = globalThis.localStorage;
  const prevAudio = globalThis.AudioContext;
  const stats = { created: 0, oscillators: 0, started: 0, noiseSources: 0 };
  const storage = createMemoryStorage();
  globalThis.localStorage = storage;
  globalThis.AudioContext = createMockAudioContext(stats);

  try {
    const sfx = new SoundEffectsManager();
    assert.equal(sfx.isMuted(), false);

    assert.equal(sfx.playCountdownTick(false), true);
    assert.equal(sfx.playCountdownTick(true), true);
    assert.equal(sfx.startEngineLoop(), true);
    sfx.updateEngineIntensity(0.8);
    sfx.stopEngineLoop();
    assert.equal(sfx.playStageSeparation(), true);
    assert.equal(sfx.playAlarm(), true);
    assert.equal(sfx.playSuccess(), true);
    assert.ok(stats.oscillators >= 8);
    assert.equal(stats.noiseSources, 1);

    // Muting persists in localStorage and silences playback
    assert.equal(sfx.toggleMute(), true);
    assert.equal(storage.getItem(AUDIO_MUTE_STORAGE_KEY), "true");
    assert.equal(sfx.playAlarm(), false);
    assert.equal(sfx.playSuccess(), false);
    assert.equal(sfx.startEngineLoop(), false);

    // Reloading respects persisted mute state
    const reloaded = new SoundEffectsManager();
    assert.equal(reloaded.isMuted(), true);
  } finally {
    globalThis.localStorage = prevStorage;
    globalThis.AudioContext = prevAudio;
  }
});

test("buildContextualHint tailors engineering guidance across all 4 game phases", () => {
  const gs = new GameState();
  assert.ok(buildContextualHint(gs).title.includes("Mission"));

  gs.setPhase("spacecraft");
  gs.setSpacecraft({
    isValid: false,
    totalMassKg: 1400,
    maxRangeKm: 1000,
    errors: ["Total carried mass exceeds bus capacity."],
    warnings: [],
  });
  const scHint = buildContextualHint(gs);
  assert.ok(scHint.message.includes("Auto-Fix"));

  gs.setPhase("launch");
  gs.setLaunch({
    success: false,
    failureFix: "Select Heavy-Lift liquid launcher.",
  });
  assert.ok(buildContextualHint(gs).message.includes("Heavy-Lift"));

  gs.setPhase("results");
  assert.ok(buildContextualHint(gs).message.includes("Retry with Fixes"));
});

test("OnboardingGuide renders 3-step tutorial tooltips, Hint button, and SFX mute toggle", () => {
  const prevStorage = globalThis.localStorage;
  const storage = createMemoryStorage();
  globalThis.localStorage = storage;

  const controlsListeners = {};
  const overlayListeners = {};
  const controlsHost = {
    innerHTML: "",
    addEventListener(type, fn) {
      controlsListeners[type] = fn;
    },
    removeEventListener() {},
  };
  const overlayHost = {
    innerHTML: "",
    addEventListener(type, fn) {
      overlayListeners[type] = fn;
    },
    removeEventListener() {},
  };

  const gs = new GameState();
  const guide = new OnboardingGuide(controlsHost, overlayHost, gs);

  try {
    assert.equal(TUTORIAL_STEPS.length, 3);
    guide.mount();

    assert.ok(controlsHost.innerHTML.includes("? Hint"));
    assert.ok(controlsHost.innerHTML.includes("SFX"));
    assert.ok(overlayHost.innerHTML.includes("STEP 1 OF 3"));

    // Step through tutorial: 1 -> 2 -> 3 -> Done
    overlayListeners.click({
      target: { closest: () => ({ dataset: { guideAction: "tut-next" } }) },
    });
    assert.ok(overlayHost.innerHTML.includes("STEP 2 OF 3"));

    overlayListeners.click({
      target: { closest: () => ({ dataset: { guideAction: "tut-next" } }) },
    });
    assert.ok(overlayHost.innerHTML.includes("STEP 3 OF 3"));

    overlayListeners.click({
      target: { closest: () => ({ dataset: { guideAction: "tut-next" } }) },
    });
    assert.equal(storage.getItem(TUTORIAL_STORAGE_KEY), "true");
    assert.equal(overlayHost.innerHTML.includes("STEP"), false);

    // Click Hint button to display Mission Control Hint
    controlsListeners.click({
      target: { closest: () => ({ dataset: { guideAction: "toggle-hint" } }) },
    });
    assert.ok(overlayHost.innerHTML.includes("MISSION CONTROL HINT"));
  } finally {
    guide.destroy();
    globalThis.localStorage = prevStorage;
  }
});
