/**
 * @file src/main.js
 * @owner Member 2 (Spacecraft Design) — Standalone Test Harness on feature/spacecraft-design
 * @goal Mounts the Spacecraft Design 3D assembly bay with sample mission presets so Member 2
 *       can visually build, rotate, and test spacecraft compatibility directly in the browser.
 *       (Member 4 will replace this entry point with initGame() during final integration.)
 */

import "./styles/main.css";
import { SceneManager } from "./core/SceneManager.js";
import { GameState } from "./core/GameState.js";
import * as spacecraftDesign from "./modules/spacecraft-design/index.js";

const SAMPLE_MISSIONS = {
  none: null,
  leo: {
    missionId: "earth-climate-leo",
    title: "Earth Climate Monitor (LEO)",
    targetOrbitId: "LEO",
    budgetMillions: 55,
    minSciencePoints: 50,
    requiredDataRateKbps: 256,
    targetDistanceKm: 550,
    instruments: [
      {
        id: "multispectral-cam",
        name: "Multispectral Imager",
        massKg: 28,
        powerWatts: 75,
        dataRateKbps: 256,
        costMillions: 5.0,
        sciencePoints: 55,
      },
    ],
  },
  geo: {
    missionId: "weather-geo",
    title: "Global Weather Relay (GEO)",
    targetOrbitId: "GEO",
    budgetMillions: 95,
    minSciencePoints: 75,
    requiredDataRateKbps: 2048,
    targetDistanceKm: 35786,
    instruments: [
      {
        id: "ir-sounder",
        name: "IR Atmospheric Sounder",
        massKg: 65,
        powerWatts: 180,
        dataRateKbps: 1500,
        costMillions: 12.0,
        sciencePoints: 80,
      },
    ],
  },
  lunar: {
    missionId: "lunar-mapper",
    title: "Lunar Surface Mapper",
    targetOrbitId: "LUNAR",
    budgetMillions: 140,
    minSciencePoints: 110,
    requiredDataRateKbps: 8000,
    targetDistanceKm: 384400,
    instruments: [
      {
        id: "sar-radar",
        name: "Lunar SAR Radar",
        massKg: 140,
        powerWatts: 420,
        dataRateKbps: 6000,
        costMillions: 18.0,
        sciencePoints: 120,
      },
    ],
  },
};

const appRoot = document.getElementById("app") || document.body;
const sceneManager = new SceneManager(appRoot);
const gameState = new GameState();
gameState.setMission(SAMPLE_MISSIONS.leo);

const uiRoot = document.createElement("div");
appRoot.appendChild(uiRoot);

// Lightweight mission-context switcher for testing compatibility rules in browser
const testBar = document.createElement("div");
testBar.style.cssText =
  "position:fixed;top:16px;left:16px;z-index:20;display:flex;gap:8px;align-items:center;" +
  "padding:8px 12px;border-radius:10px;background:rgba(11,17,32,0.85);backdrop-filter:blur(10px);" +
  "border:1px solid rgba(56,189,248,0.28);color:#e2e8f0;font-size:12px;";
testBar.innerHTML = `
  <span style="color:#38bdf8;font-weight:700;">TEST MISSION:</span>
  <select id="test-mission-select" style="background:#0f172a;color:#f8fafc;border:1px solid #334155;border-radius:6px;padding:4px 8px;">
    <option value="leo" selected>Earth Climate Monitor (LEO · 550 km)</option>
    <option value="geo">Global Weather Relay (GEO · 35,786 km)</option>
    <option value="lunar">Lunar Surface Mapper (384,400 km)</option>
    <option value="none">Free Build (No Mission Constraints)</option>
  </select>
`;
appRoot.appendChild(testBar);

testBar.querySelector("#test-mission-select").addEventListener("change", (e) => {
  gameState.setMission(SAMPLE_MISSIONS[e.target.value]);
});

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
