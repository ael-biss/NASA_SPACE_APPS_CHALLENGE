/**
 * @file src/main.js
 * @owner Member 4 (Interface & Integration)
 * @goal Application entry point bootstrapping the integrated 4-phase NASA Space Mission
 *       Design & Physics Simulation Game.
 */

import "./styles/main.css";
import { initGame } from "./modules/game-interface/index.js";
 /* @owner Member 3 (Launch & Orbit) — Standalone Test Harness
 * @goal Mounts the Launch & Orbit module with sample missions and spacecraft specs
 *       so you can test vehicle selection, Delta-v validation, and launch execution.
 */

import "./styles/main.css";
import { SceneManager } from "./core/SceneManager.js";
import { GameState } from "./core/GameState.js";
import * as launchOrbit from "./modules/launch-orbit/index.js";

// ── 1. Preset Test Missions ──────────────────────────────────────────────────
const TEST_MISSIONS = {
  leo: {
    missionId: "earth-climate-leo",
    title: "Earth Climate Monitor",
    targetOrbitId: "LEO",
    targetDistanceKm: 550,
    budgetMillions: 60,
  },
  geo: {
    missionId: "weather-geo",
    title: "Global Weather Relay",
    targetOrbitId: "GEO",
    targetDistanceKm: 35786,
    budgetMillions: 120,
  },
  lunar: {
    missionId: "lunar-mapper",
    title: "Lunar Surface Mapper",
    targetOrbitId: "LUNAR",
    targetDistanceKm: 384400,
    budgetMillions: 180,
  },
};

// ── 2. Preset Test Spacecraft Specs ──────────────────────────────────────────
const TEST_SPACECRAFTS = {
  light: {
    label: "CubeSat / Light Payload (500 kg)",
    totalMassKg: 500,
    dryMassKg: 350,
    propellantMassKg: 150,
    ispSeconds: 300,
    costMillions: 15,
    isValid: true,
  },
  nominal: {
    label: "Medium Science Sat (2,200 kg)",
    totalMassKg: 2200,
    dryMassKg: 1400,
    propellantMassKg: 800,
    ispSeconds: 315,
    costMillions: 35,
    isValid: true,
  },
  heavy: {
    label: "Heavy Deep-Space Probe (9,500 kg — Tests Overweight)",
    totalMassKg: 9500,
    dryMassKg: 5500,
    propellantMassKg: 4000,
    ispSeconds: 325,
    costMillions: 65,
    isValid: true,
  },
};

// ── 3. Bootstrap State & Scene ───────────────────────────────────────────────
const appRoot = document.getElementById("app") || document.body;
initGame(appRoot);
const sceneManager = new SceneManager(appRoot);
const gameState = new GameState();

// Initialize with LEO + Nominal Spacecraft
gameState.setMission(TEST_MISSIONS.leo);
gameState.setSpacecraft(TEST_SPACECRAFTS.nominal);

// ── 4. UI Mount Point ────────────────────────────────────────────────────────
const uiRoot = document.createElement("div");
uiRoot.id = "launch-ui-root";
appRoot.appendChild(uiRoot);

// ── 5. Quick Test Control Toolbar ────────────────────────────────────────────
const testBar = document.createElement("div");
testBar.style.cssText = `
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 999;
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(56, 189, 248, 0.4);
  color: #f8fafc;
  font-size: 13px;
  font-family: monospace;
`;

testBar.innerHTML = `
  <strong style="color:#38bdf8;">TEST HARNESS:</strong>
  <label>Orbit:
    <select id="test-orbit-select" style="background:#1e293b;color:#fff;border:1px solid #475569;border-radius:4px;padding:3px 6px;">
      <option value="leo" selected>LEO (550 km)</option>
      <option value="geo">GEO (35,786 km)</option>
      <option value="lunar">LUNAR (384,400 km)</option>
    </select>
  </label>

  <label>Spacecraft:
    <select id="test-craft-select" style="background:#1e293b;color:#fff;border:1px solid #475569;border-radius:4px;padding:3px 6px;">
      <option value="nominal" selected>Nominal (2,200 kg)</option>
      <option value="light">Light (500 kg)</option>
      <option value="heavy">Heavy Overweight (9,500 kg)</option>
    </select>
  </label>
`;
appRoot.appendChild(testBar);

// Event listeners to dynamically update GameState when dropdowns change
function remountModule() {
  launchOrbit.unmount();
  uiRoot.innerHTML = "";
  launchOrbit.mount(sceneManager, gameState, uiRoot);
}

testBar.querySelector("#test-orbit-select").addEventListener("change", (e) => {
  gameState.setMission(TEST_MISSIONS[e.target.value]);
  remountModule();
});

testBar.querySelector("#test-craft-select").addEventListener("change", (e) => {
  gameState.setSpacecraft(TEST_SPACECRAFTS[e.target.value]);
  remountModule();
});

// ── 6. Log and Alert on Launch Event ─────────────────────────────────────────
gameState.subscribe((state) => {
  if (state.launch) {
    console.log("🚀 [LAUNCH EVENT TRIGGERED]:", state.launch);
    alert(
      `Launch Result:\n` +
      `• Success: ${state.launch.success ? "✅ PASSED" : "❌ FAILED"}\n` +
      `• Rocket: ${state.launch.rocketId}\n` +
      `• Delta-V Margin: ${state.launch.deltaVMarginMs?.toFixed(0) ?? 0} m/s\n` +
      `• Reason: ${state.launch.reason || state.launch.failureReason || "N/A"}`
    );
  }
});

// ── 7. Initial Mount & Render Loop ───────────────────────────────────────────
launchOrbit.mount(sceneManager, gameState, uiRoot);

let lastTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const deltaTime = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  launchOrbit.update(deltaTime);
  sceneManager.render();
}
requestAnimationFrame(animate);
