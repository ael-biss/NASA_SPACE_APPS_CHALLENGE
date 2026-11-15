/**
 * @file src/modules/game-interface/logic/GuidanceStore.js
 * @goal Persists new-player guidance progress (tutorialCompleted, tutorialDismissed,
 *       tutorialStepIndex, hintsEnabled) in localStorage with safe try/catch and in-memory fallback.
 */

export const GUIDANCE_STORAGE_KEY = "orbitCraft.guidance.v1";

const DEFAULT_STATE = Object.freeze({
  welcomeSeen: false,
  tutorialCompleted: false,
  tutorialDismissed: false,
  tutorialStepIndex: 0,
  hintsEnabled: true,
});

export class GuidanceStore {
  /** @param {Storage | null} [storageOverride] */
  constructor(storageOverride = undefined) {
    this._storageOverride = storageOverride;
    this._memory = { ...DEFAULT_STATE };
    this._state = this._load();
    this._listeners = new Set();
  }

  _getStorage() {
    if (this._storageOverride !== undefined) return this._storageOverride;
    try {
      return typeof globalThis.localStorage !== "undefined" ? globalThis.localStorage : null;
    } catch {
      return null;
    }
  }

  _load() {
    const storage = this._getStorage();
    if (!storage) return { ...this._memory };
    try {
      const raw = storage.getItem(GUIDANCE_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_STATE };
      const parsed = JSON.parse(raw);
      return {
        welcomeSeen: Boolean(parsed?.welcomeSeen),
        tutorialCompleted: Boolean(parsed?.tutorialCompleted),
        tutorialDismissed: Boolean(parsed?.tutorialDismissed),
        tutorialStepIndex:
          typeof parsed?.tutorialStepIndex === "number" && parsed.tutorialStepIndex >= 0
            ? Math.floor(parsed.tutorialStepIndex)
            : 0,
        hintsEnabled: parsed?.hintsEnabled !== false,
      };
    } catch {
      return { ...this._memory };
    }
  }

  _save() {
    this._memory = { ...this._state };
    const storage = this._getStorage();
    if (!storage) return;
    try {
      storage.setItem(GUIDANCE_STORAGE_KEY, JSON.stringify(this._state));
    } catch {
      // Fall back silently to in-memory state
    }
  }

  getState() {
    return { ...this._state };
  }

  shouldShowWelcomeOnFirstRun() {
    return (
      !this._state.welcomeSeen &&
      !this._state.tutorialCompleted &&
      !this._state.tutorialDismissed
    );
  }

  markWelcomeSeen() {
    if (this._state.welcomeSeen) return this.getState();
    return this.update({ welcomeSeen: true });
  }

  update(patch) {
    this._state = { ...this._state, ...patch };
    this._save();
    for (const fn of this._listeners) {
      fn(this.getState());
    }
    return this.getState();
  }

  setStepIndex(index) {
    return this.update({ tutorialStepIndex: Math.max(0, Math.floor(index)) });
  }

  markCompleted() {
    return this.update({
      welcomeSeen: true,
      tutorialCompleted: true,
      tutorialStepIndex: 0,
    });
  }

  markDismissed() {
    return this.update({
      welcomeSeen: true,
      tutorialDismissed: true,
    });
  }

  setHintsEnabled(enabled) {
    return this.update({ hintsEnabled: Boolean(enabled) });
  }

  resetForReplay() {
    return this.update({ tutorialCompleted: false, tutorialStepIndex: 0 });
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }
}
