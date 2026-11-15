/**
 * @file src/main.js
 * @owner Member 4 (Interface & Integration)
 * @goal Application entry point bootstrapping the integrated 4-phase NASA Space Mission
 *       Design & Physics Simulation Game.
 */

import "./styles/main.css";
import { initGame } from "./modules/game-interface/index.js";

const appRoot = document.getElementById("app") || document.body;

// Check if developer wants the standalone Launch & Orbit test harness:
const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
const isLaunchTestMode = urlParams?.get("mode") === "launch-test";

if (isLaunchTestMode) {
  // ── Standalone Launch & Orbit Test Harness ─────────────────────────────────
  const { SceneManager } = await import("./core/SceneManager.js");
  const { GameState } = await import("./core/GameState.js");
  const launchOrbit = await import("./modules/launch-orbit/index.js");

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

  const sceneManager = new SceneManager(appRoot);
  const gameState = new GameState();

  gameState.setMission(TEST_MISSIONS.leo);
  gameState.setSpacecraft(TEST_SPACECRAFTS.nominal);

  const uiRoot = document.createElement("div");
  uiRoot.id = "launch-ui-root";
  appRoot.appendChild(uiRoot);

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

  gameState.subscribe((state) => {
    if (state.launch) {
      console.log("🚀 [LAUNCH EVENT TRIGGERED]:", state.launch);
    }
  });

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
} else {
  // ── Standard Full Game Bootstrap ───────────────────────────────────────────
  initGame(appRoot);
}

