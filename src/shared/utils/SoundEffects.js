/**
 * @file src/shared/utils/SoundEffects.js
 * @owner Shared Audio Utility
 * @goal Synthesizes clean, zero-dependency, CC0-safe Web Audio API SFX
 *       (countdown pips, engine thruster rumble, anomaly alarm, success chime, staging pop)
 *       with persistent mute toggle in localStorage.
 */

export const AUDIO_MUTE_STORAGE_KEY = "orbitCraft.muted.v1";

export class SoundEffectsManager {
  constructor() {
    this._ctx = null;
    this._muted = this._loadMuted();
    this._engineNodes = null;
    this._listeners = new Set();
  }

  _loadMuted() {
    try {
      if (typeof globalThis.localStorage === "undefined") return false;
      return globalThis.localStorage.getItem(AUDIO_MUTE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }

  isMuted() {
    return this._muted;
  }

  setMuted(muted) {
    this._muted = Boolean(muted);
    try {
      if (typeof globalThis.localStorage !== "undefined") {
        globalThis.localStorage.setItem(AUDIO_MUTE_STORAGE_KEY, String(this._muted));
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
    if (this._muted) {
      this.stopEngineLoop();
    }
    for (const fn of this._listeners) {
      fn(this._muted);
    }
    return this._muted;
  }

  toggleMute() {
    return this.setMuted(!this._muted);
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _ensureContext() {
    if (this._muted) return null;
    const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this._ctx) {
      this._ctx = new AudioCtx();
    }
    if (this._ctx.state === "suspended") {
      this._ctx.resume?.().catch(() => {});
    }
    return this._ctx;
  }

  unlock() {
    return Boolean(this._ensureContext());
  }

  /** Countdown beep (`T-3`, `T-2`, `T-1`) or higher ignition tone at `T-0`. */
  playCountdownTick(isIgnition = false) {
    const ctx = this._ensureContext();
    if (!ctx) return false;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isIgnition ? "triangle" : "sine";
    osc.frequency.setValueAtTime(isIgnition ? 1174.66 : 880, now);
    if (isIgnition) {
      osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.34);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(isIgnition ? 0.18 : 0.11, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (isIgnition ? 0.36 : 0.14));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (isIgnition ? 0.38 : 0.16));
    return true;
  }

  /** Filtered sub-bass + noise thruster roar during powered ascent. */
  startEngineLoop() {
    const ctx = this._ensureContext();
    if (!ctx || this._engineNodes) return Boolean(this._engineNodes);

    const bufferSize = Math.floor(ctx.sampleRate * 1.5);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.04 * white) / 1.04;
      data[i] = lastOut * 3.2;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 340;

    const sub = ctx.createOscillator();
    sub.type = "sawtooth";
    sub.frequency.value = 54;

    const subGain = ctx.createGain();
    subGain.gain.value = 0.045;

    const master = ctx.createGain();
    const now = ctx.currentTime;
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.14, now + 0.35);

    noise.connect(filter);
    filter.connect(master);
    sub.connect(subGain);
    subGain.connect(master);
    master.connect(ctx.destination);

    noise.start(now);
    sub.start(now);

    this._engineNodes = { noise, sub, filter, master };
    return true;
  }

  updateEngineIntensity(factor = 1) {
    if (!this._engineNodes || !this._ctx || this._muted) return;
    const clamped = Math.max(0.15, Math.min(1.2, factor));
    const now = this._ctx.currentTime;
    this._engineNodes.filter.frequency.setTargetAtTime(180 + clamped * 260, now, 0.08);
    this._engineNodes.master.gain.setTargetAtTime(0.04 + clamped * 0.12, now, 0.08);
  }

  stopEngineLoop() {
    if (!this._engineNodes) return;
    const { noise, sub, master } = this._engineNodes;
    this._engineNodes = null;
    try {
      const ctx = this._ctx;
      if (ctx) {
        const now = ctx.currentTime;
        master.gain.setTargetAtTime(0.0001, now, 0.06);
        setTimeout(() => {
          try {
            noise.stop();
            sub.stop();
            master.disconnect();
          } catch {
            // Already stopped
          }
        }, 180);
      } else {
        noise.stop();
        sub.stop();
        master.disconnect();
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /** Clean pneumatic thump on stage or fairing separation. */
  playStageSeparation() {
    const ctx = this._ensureContext();
    if (!ctx) return false;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.18);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
    return true;
  }

  /** Two-tone mission anomaly caution alarm. */
  playAlarm() {
    const ctx = this._ensureContext();
    if (!ctx) return false;
    const now = ctx.currentTime;
    [0, 0.22].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(660, now + offset);
      osc.frequency.setValueAtTime(495, now + offset + 0.1);

      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.11, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.19);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    });
    return true;
  }

  /** Bright sci-fi harmonic chord arpeggio for orbital capture & mission success. */
  playSuccess() {
    const ctx = this._ensureContext();
    if (!ctx) return false;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.11, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.44);
    });
    return true;
  }
}

export const soundFX = new SoundEffectsManager();
