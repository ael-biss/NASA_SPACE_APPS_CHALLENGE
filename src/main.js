/**
 * @file src/main.js
 * @owner Member 2 (Spacecraft Design) — Standalone Test Harness on feature/spacecraft-design
 * @goal Mounts the Spacecraft Design 3D assembly bay wired to the actual mission and instrument
 *       catalogs so users can switch missions and add/remove 3D instruments in the browser.
 *       (Member 4 will replace this entry point with initGame() during final integration.)
 */

import "./styles/main.css";
import { SceneManager } from "./core/SceneManager.js";
import { GameState } from "./core/GameState.js";
import { getMissions } from "./modules/mission-science/data/missions.js";
import { getInstruments } from "./modules/mission-science/data/instruments.js";
import * as spacecraftDesign from "./modules/spacecraft-design/index.js";

const HARNESS_STYLE_ID = "mission-harness-styles";

/**
 * Map a human-readable mission orbit string to the shared orbit key.
 * @param {string} targetOrbit
 * @returns {string}
 */
function toOrbitId(targetOrbit = "") {
  const orbit = targetOrbit.toLowerCase();
  if (orbit.includes("geo")) return "GEO";
  if (orbit.includes("meo")) return "MEO";
  if (orbit.includes("lunar") || orbit.includes("moon")) return "LUNAR";
  if (orbit.includes("mars")) return "MARS";
  if (orbit.includes("heo") || orbit.includes("elliptical")) return "HEO";
  return "LEO";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toInstrumentSelection(instrument) {
  return {
    id: instrument.id,
    name: instrument.name,
    massKg: instrument.massKg,
    powerWatts: instrument.powerWatts,
    dataRateKbps: instrument.dataRateKbps,
    costMillions: instrument.costMillions,
    sciencePoints: instrument.sciencePoints,
    model: instrument.model,
  };
}

/**
 * Build a MissionSpec for the selected mission (or unrestricted free-build with instruments).
 * @param {Object | null} mission
 * @param {Set<string>} selectedInstrumentIds
 * @param {Array<Object>} allInstruments
 * @returns {import('./shared/interfaces/MissionSpec.js').MissionSpec | null}
 */
function buildMissionSpec(mission, selectedInstrumentIds, allInstruments) {
  const instruments = allInstruments
    .filter((ins) => selectedInstrumentIds.has(ins.id))
    .map(toInstrumentSelection);

  if (!mission) {
    if (instruments.length === 0) return null;
    return {
      missionId: "free-build",
      title: "Free Build",
      targetOrbitId: "LEO",
      budgetMillions: Infinity,
      minSciencePoints: 0,
      requiredDataRateKbps: 0,
      targetDistanceKm: 0,
      instruments,
    };
  }

  return {
    missionId: mission.id,
    title: mission.name,
    targetOrbitId: toOrbitId(mission.targetOrbit),
    budgetMillions: mission.budgetCap,
    minSciencePoints: mission.minScienceScore,
    requiredDataRateKbps: mission.requiredDownlinkDataRate,
    targetDistanceKm: mission.missionDistance,
    instruments,
  };
}

function ensureHarnessStyles() {
  if (document.getElementById(HARNESS_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = HARNESS_STYLE_ID;
  style.textContent = `
    .mh-panel {
      position: fixed;
      top: 16px;
      left: 16px;
      z-index: 20;
      width: min(336px, calc(100vw - 32px));
      max-height: calc(100vh - 32px);
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      border-radius: 12px;
      background: rgba(11, 17, 32, 0.88);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(56, 189, 248, 0.28);
      color: #e2e8f0;
      font-size: 12px;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.45);
    }
    .mh-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .mh-label {
      color: #38bdf8;
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.06em;
      white-space: nowrap;
    }
    .mh-select {
      flex: 1;
      min-width: 0;
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 5px 8px;
      font-size: 12px;
    }
    .mh-btn {
      background: rgba(30, 41, 59, 0.9);
      color: #cbd5e1;
      border: 1px solid rgba(148, 163, 184, 0.35);
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 11px;
      cursor: pointer;
    }
    .mh-btn:hover:not(:disabled) {
      border-color: #38bdf8;
      color: #f8fafc;
    }
    .mh-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .mh-summary {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
      padding: 8px;
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.78);
      border: 1px solid rgba(148, 163, 184, 0.16);
      font-size: 11px;
    }
    .mh-summary strong {
      display: block;
      font-size: 12px;
      color: #f8fafc;
    }
    .mh-ok { color: #4ade80 !important; }
    .mh-warn { color: #fbbf24 !important; }
    .mh-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      overflow-y: auto;
      padding-right: 2px;
    }
    .mh-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px;
      border-radius: 8px;
      background: rgba(30, 41, 59, 0.65);
      border: 1px solid rgba(148, 163, 184, 0.2);
      cursor: pointer;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .mh-item:hover {
      border-color: rgba(56, 189, 248, 0.55);
    }
    .mh-item-selected {
      background: rgba(14, 116, 144, 0.25);
      border-color: #38bdf8;
    }
    .mh-item input {
      margin-top: 2px;
      accent-color: #38bdf8;
      cursor: pointer;
    }
    .mh-item-body {
      flex: 1;
      min-width: 0;
    }
    .mh-item-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }
    .mh-item-name {
      font-weight: 600;
      color: #f8fafc;
    }
    .mh-tag {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 4px;
      background: rgba(56, 189, 248, 0.16);
      color: #7dd3fc;
      white-space: nowrap;
    }
    .mh-tag-dim {
      background: rgba(100, 116, 139, 0.22);
      color: #94a3b8;
    }
    .mh-item-meta {
      margin-top: 3px;
      font-size: 10.5px;
      color: #94a3b8;
    }
    .mh-collapsed .mh-drawer {
      display: none;
    }
  `;
  document.head.appendChild(style);
}

const missions = getMissions();
const allInstruments = getInstruments();
const missionsById = new Map(missions.map((m) => [m.id, m]));

let activeMission = missions[0] ?? null;
let selectedInstrumentIds = new Set(activeMission?.recommendedInstrumentIds ?? []);
let drawerCollapsed = false;

const appRoot = document.getElementById("app") || document.body;
const sceneManager = new SceneManager(appRoot);
const gameState = new GameState();
gameState.setMission(buildMissionSpec(activeMission, selectedInstrumentIds, allInstruments));

const uiRoot = document.createElement("div");
appRoot.appendChild(uiRoot);

ensureHarnessStyles();

const missionPanel = document.createElement("aside");
missionPanel.className = "mh-panel";
missionPanel.innerHTML = `
  <div class="mh-row">
    <span class="mh-label">MISSION</span>
    <select id="mission-select" class="mh-select"></select>
    <button type="button" class="mh-btn" data-action="toggle-drawer"></button>
  </div>
  <div class="mh-drawer" style="display:flex;flex-direction:column;gap:8px;min-height:0;flex:1;">
    <div class="mh-summary" data-role="payload-summary"></div>
    <div class="mh-row">
      <span class="mh-label">PAYLOAD INSTRUMENTS</span>
      <div style="display:flex;gap:6px;">
        <button type="button" class="mh-btn" data-action="reset-recommended">Recommended</button>
        <button type="button" class="mh-btn" data-action="clear-instruments">Clear All</button>
      </div>
    </div>
    <div class="mh-list" data-role="instrument-list"></div>
  </div>
`;
appRoot.appendChild(missionPanel);

const missionSelect = missionPanel.querySelector("#mission-select");
for (const mission of missions) {
  const option = document.createElement("option");
  option.value = mission.id;
  option.textContent = `${mission.name} (${toOrbitId(mission.targetOrbit)} · ${mission.missionDistance.toLocaleString()} km)`;
  missionSelect.appendChild(option);
}

const freeBuildOption = document.createElement("option");
freeBuildOption.value = "none";
freeBuildOption.textContent = "Free Build (No Mission Constraints)";
missionSelect.appendChild(freeBuildOption);
missionSelect.value = activeMission ? activeMission.id : "none";

function renderPayloadPanel() {
  const toggleBtn = missionPanel.querySelector('[data-action="toggle-drawer"]');
  const recBtn = missionPanel.querySelector('[data-action="reset-recommended"]');
  const clearBtn = missionPanel.querySelector('[data-action="clear-instruments"]');
  const summaryEl = missionPanel.querySelector('[data-role="payload-summary"]');
  const listEl = missionPanel.querySelector('[data-role="instrument-list"]');
  const drawerEl = missionPanel.querySelector(".mh-drawer");

  missionPanel.classList.toggle("mh-collapsed", drawerCollapsed);
  drawerEl.style.display = drawerCollapsed ? "none" : "flex";
  toggleBtn.textContent = `${drawerCollapsed ? "Show" : "Hide"} (${selectedInstrumentIds.size})`;
  recBtn.disabled = !activeMission;
  clearBtn.disabled = selectedInstrumentIds.size === 0;

  const selected = allInstruments.filter((ins) => selectedInstrumentIds.has(ins.id));
  const totals = selected.reduce(
    (acc, ins) => ({
      mass: acc.mass + ins.massKg,
      power: acc.power + ins.powerWatts,
      cost: acc.cost + ins.costMillions,
      science: acc.science + ins.sciencePoints,
    }),
    { mass: 0, power: 0, cost: 0, science: 0 }
  );

  const scienceOk = !activeMission || totals.science >= activeMission.minScienceScore;
  summaryEl.innerHTML = activeMission
    ? `
      <div><span>Science Target</span><strong class="${scienceOk ? "mh-ok" : "mh-warn"}">${totals.science} / ${activeMission.minScienceScore} pts</strong></div>
      <div><span>Payload / Cap</span><strong>$${totals.cost.toFixed(1)}M / $${activeMission.budgetCap}M</strong></div>
      <div><span>Payload Mass</span><strong>${totals.mass.toFixed(1)} kg</strong></div>
      <div><span>Payload Power</span><strong>${totals.power} W</strong></div>
    `
    : `
      <div><span>Selected</span><strong>${selected.length} instruments</strong></div>
      <div><span>Payload Cost</span><strong>$${totals.cost.toFixed(1)}M</strong></div>
      <div><span>Payload Mass</span><strong>${totals.mass.toFixed(1)} kg</strong></div>
      <div><span>Payload Power</span><strong>${totals.power} W</strong></div>
    `;

  const recommended = new Set(activeMission?.recommendedInstrumentIds ?? []);
  const ordered = [...allInstruments].sort((a, b) => {
    const aRec = recommended.has(a.id) ? 0 : 1;
    const bRec = recommended.has(b.id) ? 0 : 1;
    return aRec - bRec;
  });

  listEl.innerHTML = ordered
    .map((ins) => {
      const checked = selectedInstrumentIds.has(ins.id);
      const isRec = recommended.has(ins.id);
      const badgeText = activeMission ? (isRec ? "Recommended" : "Optional") : ins.category;
      const badgeClass = activeMission && !isRec ? "mh-tag mh-tag-dim" : "mh-tag";

      return `
        <label class="mh-item ${checked ? "mh-item-selected" : ""}">
          <input type="checkbox" data-instrument-id="${escapeHtml(ins.id)}" ${checked ? "checked" : ""} />
          <div class="mh-item-body">
            <div class="mh-item-top">
              <span class="mh-item-name">${escapeHtml(ins.name)}</span>
              <span class="${badgeClass}">${escapeHtml(badgeText)}</span>
            </div>
            <div class="mh-item-meta">
              ${ins.massKg} kg · ${ins.powerWatts} W · $${ins.costMillions}M · ${ins.sciencePoints} pts
            </div>
          </div>
        </label>
      `;
    })
    .join("");
}

function syncMissionSelection() {
  renderPayloadPanel();
  gameState.setMission(buildMissionSpec(activeMission, selectedInstrumentIds, allInstruments));
}

missionSelect.addEventListener("change", (e) => {
  activeMission = missionsById.get(e.target.value) ?? null;
  selectedInstrumentIds = new Set(activeMission?.recommendedInstrumentIds ?? []);
  syncMissionSelection();
});

missionPanel.addEventListener("click", (e) => {
  const actionEl = e.target.closest("[data-action]");
  if (!actionEl) return;

  const action = actionEl.dataset.action;
  if (action === "toggle-drawer") {
    drawerCollapsed = !drawerCollapsed;
    renderPayloadPanel();
  } else if (action === "reset-recommended" && activeMission) {
    selectedInstrumentIds = new Set(activeMission.recommendedInstrumentIds ?? []);
    syncMissionSelection();
  } else if (action === "clear-instruments") {
    selectedInstrumentIds.clear();
    syncMissionSelection();
  }
});

missionPanel.addEventListener("change", (e) => {
  const checkbox = e.target.closest("[data-instrument-id]");
  if (!checkbox) return;

  const id = checkbox.dataset.instrumentId;
  if (checkbox.checked) {
    selectedInstrumentIds.add(id);
  } else {
    selectedInstrumentIds.delete(id);
  }
  syncMissionSelection();
});

renderPayloadPanel();
spacecraftDesign.mount(sceneManager, gameState, uiRoot);

let lastTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const deltaTime = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  spacecraftDesign.update(deltaTime);
  sceneManager.render();
}
requestAnimationFrame(animate);
