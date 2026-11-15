/**
 * @file src/modules/launch-orbit/ui/LaunchControlPanel.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Launch control panel — rocket selector, per-orbit payload
 *       validation, liftoff TWR check, and live telemetry.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * SCOPE (end of Module 1)
 * ═══════════════════════════════════════════════════════════════════════
 *   Implemented (Module 1):
 *     - mount / destroy
 *     - setMissionSpec / setSpacecraftSpec
 *     - Rocket list rendered with per-orbit capacity and cost
 *     - Payload check (spacecraft mass vs. vehicle capacity for the
 *       target orbit — Module 1 §3.5–3.6)
 *     - Liftoff TWR check via RocketPhysics.liftoffTWR (Module 1 §3.2)
 *     - Launch button enabled only when both checks pass
 *     - Player-facing explanation strings for every failure mode
 *
 *   Deferred:
 *     - updateTelemetry()      → Module 5 (animation loop)
 *     - Δv margin display       → Module 3
 *     - 3D orbit visualization  → Module 5
 * ═══════════════════════════════════════════════════════════════════════
 */

import { getRockets } from '../data/rockets.js';
import { getOrbits } from '../data/orbits.js';
import { liftoffTWR } from '../logic/RocketPhysics.js';

export class LaunchControlPanel {
  /**
   * @param {HTMLElement} container
   * @param {import('../../../core/GameState.js').GameState} gameState
   * @param {(rocketId: string, orbitId: string) => void} onLaunch
   */
  constructor(container, gameState, onLaunch) {
    this.container = container;
    this.gameState = gameState;
    this.onLaunch = onLaunch;

    this._missionSpec = null;
    this._spacecraftSpec = null;
    this._selectedRocketId = null;

    this._onSelectorChange = this._onSelectorChange.bind(this);
    this._onLaunchClick = this._onLaunchClick.bind(this);
  }

  // ─── Public setters (called by Member 4's flow controller) ─────────

  setMissionSpec(missionSpec) {
    this._missionSpec = missionSpec;
    this._rerender();
  }

  setSpacecraftSpec(spacecraftSpec) {
    this._spacecraftSpec = spacecraftSpec;
    this._rerender();
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────

  mount() {
    this._renderShell();
    this._bindEvents();
    this._rerender();
  }

  /**
   * Update live telemetry readouts during flight.
   * @param {{ altitudeKm: number, velocityKms: number, stage: string }} telemetry
   *
   * STUB (Module 5): no-op until LaunchAnimation exists.
   */
  updateTelemetry(_telemetry) {
    // TODO (Module 5): write values into the telemetry DOM nodes.
  }

  destroy() {
    this._unbindEvents();
    this.container.innerHTML = '';
  }

  // ─── Internals: shell ──────────────────────────────────────────────

  _renderShell() {
    this.container.innerHTML = `
      <div class="launch-panel">
        <h2 class="launch-panel__title">Launch &amp; Orbit</h2>

        <section class="launch-panel__section">
          <h3>Target Orbit</h3>
          <p id="lo-target-orbit" class="launch-panel__target">
            Waiting for mission phase…
          </p>
          <p id="lo-orbit-explainer" class="launch-panel__hint"></p>
        </section>

        <section class="launch-panel__section">
          <h3>Launch Vehicle</h3>
          <div id="lo-rocket-list" class="launch-panel__rockets"></div>
        </section>

        <section class="launch-panel__section">
          <h3>Mission Checks</h3>
          <p id="lo-spacecraft-mass" class="launch-panel__hint">
            Waiting for spacecraft phase…
          </p>
          <p id="lo-payload-check" class="launch-panel__validation"></p>
          <p id="lo-payload-explain" class="launch-panel__hint"></p>
          <p id="lo-twr-check" class="launch-panel__validation"></p>
          <p id="lo-twr-explain" class="launch-panel__hint"></p>
        </section>

        <section class="launch-panel__section">
          <button id="lo-launch-btn" class="launch-panel__button" disabled>
            Launch
          </button>
        </section>

        <section class="launch-panel__section launch-panel__telemetry">
          <h3>Telemetry</h3>
          <dl>
            <dt>Altitude</dt><dd id="lo-telemetry-alt">—</dd>
            <dt>Velocity</dt><dd id="lo-telemetry-vel">—</dd>
            <dt>Stage</dt>   <dd id="lo-telemetry-stage">—</dd>
          </dl>
        </section>
      </div>
    `;

    this._refs = {
      targetOrbit:       this.container.querySelector('#lo-target-orbit'),
      orbitExplainer:    this.container.querySelector('#lo-orbit-explainer'),
      rocketList:        this.container.querySelector('#lo-rocket-list'),
      spacecraftMass:    this.container.querySelector('#lo-spacecraft-mass'),
      payloadCheck:      this.container.querySelector('#lo-payload-check'),
      payloadExplain:    this.container.querySelector('#lo-payload-explain'),
      twrCheck:          this.container.querySelector('#lo-twr-check'),
      twrExplain:        this.container.querySelector('#lo-twr-explain'),
      launchBtn:         this.container.querySelector('#lo-launch-btn'),
      telemetryAlt:      this.container.querySelector('#lo-telemetry-alt'),
      telemetryVel:      this.container.querySelector('#lo-telemetry-vel'),
      telemetryStage:    this.container.querySelector('#lo-telemetry-stage')
    };
  }

  _bindEvents() {
    this._refs.launchBtn.addEventListener('click', this._onLaunchClick);
    this._refs.rocketList.addEventListener('change', this._onSelectorChange);
  }

  _unbindEvents() {
    this._refs?.launchBtn.removeEventListener('click', this._onLaunchClick);
    this._refs?.rocketList.removeEventListener('change', this._onSelectorChange);
  }

  // ─── Internals: state → DOM ────────────────────────────────────────

  _rerender() {
    if (!this._refs) return;

    const rockets = getRockets();
    const orbits = getOrbits();
    const targetOrbitId = this._missionSpec?.targetOrbit ?? null;
    const targetOrbit = orbits.find((o) => o.id === targetOrbitId);

    // ── Target orbit block ──
    if (targetOrbit) {
      this._refs.targetOrbit.textContent =
        `${targetOrbit.name} (${targetOrbit.id})`;
      this._refs.orbitExplainer.textContent =
        targetOrbit.payloadImpact ?? '';
    } else {
      this._refs.targetOrbit.textContent = 'Waiting for mission phase…';
      this._refs.orbitExplainer.textContent = '';
    }

    // ── Rocket list ──
    this._refs.rocketList.innerHTML = rockets
      .map((r) => this._renderRocketOption(r, targetOrbitId))
      .join('');

    // ── Spacecraft mass summary ──
    const spacecraftMassKg = this._spacecraftSpec?.totalMassKg ?? null;
    this._refs.spacecraftMass.textContent =
      spacecraftMassKg != null
        ? `Spacecraft mass: ${spacecraftMassKg.toFixed(0)} kg`
        : 'Waiting for spacecraft phase…';

    // ── Checks for the currently selected rocket ──
    const selected = rockets.find((r) => r.id === this._selectedRocketId);
    if (!selected) {
      this._clearChecks('Select a launch vehicle to check compatibility.');
      return;
    }
    if (!targetOrbit || spacecraftMassKg == null) {
      this._clearChecks('Waiting for mission and spacecraft data.');
      return;
    }

    const payloadResult = this._validatePayload(selected, targetOrbit, spacecraftMassKg);
    const twrResult     = this._validateTWR(selected, spacecraftMassKg);

    this._refs.payloadCheck.textContent   = payloadResult.headline;
    this._refs.payloadExplain.textContent = payloadResult.explain;
    this._refs.twrCheck.textContent       = twrResult.headline;
    this._refs.twrExplain.textContent     = twrResult.explain;

    this._refs.launchBtn.disabled = !(payloadResult.valid && twrResult.valid);
  }

  _clearChecks(hint) {
    this._refs.payloadCheck.textContent   = hint;
    this._refs.payloadExplain.textContent = '';
    this._refs.twrCheck.textContent       = '';
    this._refs.twrExplain.textContent     = '';
    this._refs.launchBtn.disabled = true;
  }

  _renderRocketOption(rocket, orbitId) {
    const capacity = orbitId ? rocket.payloadCapacityKg?.[orbitId] : null;
    const capacityText = capacity
      ? capacity.max > 0
        ? `Lifts ${capacity.min.toLocaleString()}–${capacity.max.toLocaleString()} kg to ${orbitId}`
        : `Cannot reach ${orbitId}`
      : 'No capacity data for this orbit';
    const fictionBadge = rocket.fictional
      ? '<span class="launch-panel__badge">illustrative</span>'
      : '';
    const checked = rocket.id === this._selectedRocketId ? 'checked' : '';

    return `
      <label class="launch-panel__rocket">
        <input type="radio" name="lo-rocket" value="${rocket.id}" ${checked} />
        <span class="launch-panel__rocket-name">${rocket.name}</span>
        ${fictionBadge}
        <span class="launch-panel__rocket-meta">${capacityText}</span>
        <span class="launch-panel__rocket-meta">
          Fairing Ø${rocket.fairingDiameterM} m · cost $${(rocket.costUsd / 1e6).toFixed(1)}M
        </span>
      </label>
    `;
  }

  // ─── Checks ────────────────────────────────────────────────────────

  /**
   * Payload mass check (Module 1 §3.5–3.6).
   * Capacity depends on the target orbit; using LEO capacity for a GEO
   * mission would be wrong by up to 3× on some vehicles.
   */
  _validatePayload(rocket, targetOrbit, spacecraftMassKg) {
    const cap = rocket.payloadCapacityKg?.[targetOrbit.id];

    if (!cap || cap.max === 0) {
      return {
        valid: false,
        headline: `✗ ${rocket.name} cannot reach ${targetOrbit.name}.`,
        explain:
          'This vehicle does not have the performance to deliver any ' +
          'payload to this orbit. Pick a larger vehicle or a lower-energy ' +
          'destination orbit.'
      };
    }

    const marginKg = cap.max - spacecraftMassKg;
    if (marginKg >= 0) {
      return {
        valid: true,
        headline: `✓ Payload fits on ${rocket.name} for ${targetOrbit.id}.`,
        explain:
          `Spacecraft ${spacecraftMassKg.toFixed(0)} kg; vehicle limit ` +
          `${cap.max.toFixed(0)} kg; margin ${marginKg.toFixed(0)} kg. ` +
          `Payload mass is validated against the target orbit because ` +
          `higher orbits cost more delta-v and therefore carry less payload.`
      };
    }

    return {
      valid: false,
      headline:
        `✗ Payload too heavy by ${Math.abs(marginKg).toFixed(0)} kg for ${targetOrbit.id}.`,
      explain:
        `The vehicle lifts at most ${cap.max.toFixed(0)} kg to ${targetOrbit.id}, ` +
        `but your spacecraft is ${spacecraftMassKg.toFixed(0)} kg. Reduce mass ` +
        `in the spacecraft phase, or choose a larger vehicle.`
    };
  }

  /**
   * Liftoff thrust-to-weight check (Module 1 §3.2).
   * TWR < 1 means the engines cannot overcome the rocket's weight —
   * no launch is possible, no matter what the payload capacity says.
   */
  _validateTWR(rocket, spacecraftMassKg) {
    const twr = liftoffTWR(rocket, spacecraftMassKg);
    if (twr < 1) {
      return {
        valid: false,
        headline: `✗ Liftoff thrust-to-weight ratio is ${twr.toFixed(2)}.`,
        explain:
          'A ratio below 1 means the engines cannot overcome the rocket\'s ' +
          'own weight — the vehicle cannot leave the pad. This is a hard ' +
          'physical limit independent of payload capacity.'
      };
    }
    return {
      valid: true,
      headline: `✓ Liftoff thrust-to-weight ratio is ${twr.toFixed(2)}.`,
      explain:
        'Above 1 means the engines can lift the fully loaded vehicle off ' +
        'the pad. Real orbital launchers typically launch at 1.2–1.5.'
    };
  }

  // ─── Events ────────────────────────────────────────────────────────

  _onSelectorChange(evt) {
    if (evt.target?.name !== 'lo-rocket') return;
    this._selectedRocketId = evt.target.value;
    this._rerender();
  }

  _onLaunchClick() {
    if (!this._selectedRocketId) return;
    const orbitId = this._missionSpec?.targetOrbit;
    if (!orbitId) return;

    try {
      this.onLaunch(this._selectedRocketId, orbitId);
    } catch (err) {
      // Launch simulation lives in Module 3 — until then it throws, and
      // we surface that message to the player instead of an empty console.
      console.warn('[launch-orbit] Launch attempt failed:', err.message);
      this._refs.payloadExplain.textContent = err.message;
    }
  }
}