# Space Mission Design Game — A-to-Z Team Tasks

This document breaks down the entire project from **Phase 0 (Setup)** to **Phase 4 (Launch & Deployment)** so all four team members can work independently on their own branches and integrate cleanly.

---

## Table of Contents
- [Phase A — Project Infrastructure (Done / Team Setup)](#phase-a--project-infrastructure-done--team-setup)
- [Phase B — Shared Foundation (All 4 Members Together)](#phase-b--shared-foundation-all-4-members-together)
- [Phase C — Member 1: Mission & Science](#phase-c--member-1-mission--science)
- [Phase D — Member 2: Spacecraft Design](#phase-d--member-2-spacecraft-design)
- [Phase E — Member 3: Launch & Orbit](#phase-e--member-3-launch--orbit)
- [Phase F — Member 4: Interface & Integration](#phase-f--member-4-interface--integration)
- [Phase G — End-to-End Integration, Testing & Deployment (X to Z)](#phase-g--end-to-end-integration-testing--deployment-x-to-z)

---

## Phase A — Project Infrastructure (Done / Team Setup)

- [x] **A1.** Initialize Vite + Three.js project (`package.json`, `index.html`, `src/main.js`, `src/styles/main.css`).
- [x] **A2.** Configure Docker (`compose.yaml`, `Dockerfile`, `.dockerignore`) and confirm `http://localhost:5173` renders the rotating Three.js test cube.
- [x] **A3.** Create shared folders (`src/core/`, `src/modules/`, `src/shared/`, `public/models/`) with file headers and signatures.
- [ ] **A4.** Commit baseline infrastructure to `main` and push to GitHub:
  ```bash
  git add .
  git commit -m "Initial Three.js project setup and module skeletons"
  git push -u origin main
  ```
- [ ] **A5.** Create and push the 4 feature branches:
  ```bash
  git branch feature/mission-science
  git branch feature/spacecraft-design
  git branch feature/launch-orbit
  git branch feature/game-interface
  git push -u origin feature/mission-science feature/spacecraft-design feature/launch-orbit feature/game-interface
  ```
- [ ] **A6.** Confirm all 4 team members can clone the repo, switch to their branch (`git switch feature/<your-module>`), and run `docker compose up`.

---

## Phase B — Shared Foundation (All 4 Members Together)

Before diverging into feature branches, verify and finalize the shared contracts so every module expects the exact same fields and units.

- [ ] **B1. Lock Shared Data Contracts (`src/shared/interfaces/`):**
  - `MissionSpec.js`: `missionId`, `title`, `targetOrbitId`, `budgetMillions`, `minSciencePoints`, `requiredDataRateKbps`, `targetDistanceKm`, `instruments[]`.
  - `SpacecraftSpec.js`: `selection`, `dryMassKg`, `propellantMassKg`, `totalMassKg`, `powerGeneratedWatts`, `powerConsumedWatts`, `ispSeconds`, `maxDataRateKbps`, `maxRangeKm`, `costMillions`, `isValid`, `errors[]`, `warnings[]`.
  - `LaunchResult.js`: `rocketId`, `targetOrbitId`, `success`, `achievedAltitudeKm`, `remainingDeltaVMs`, `launchCostMillions`, `failureReason`.
  - `GameModule.js`: `mount(sceneManager, gameState, uiContainer)`, `update(deltaTime)`, `unmount()`.
- [ ] **B2. Implement `AssetLoader` (`src/shared/utils/AssetLoader.js`):**
  - Implement cached `GLTFLoader` + `DRACOLoader` loading from `/models/*.glb` and return `gltf.scene.clone()` so 3D parts can be reused cleanly.
  - Decide on Draco decoder source (local files in `public/draco/` or CDN).
- [ ] **B3. Verify Shared Constants (`src/shared/data/constants.js`):**
  - Agree on units across the whole team: mass in **kg**, power in **Watts**, cost in **$M**, $\Delta v$ in **m/s**, distance/altitude in **km**, data rate in **kbps**.
- [ ] **B4. Decide Spacecraft 3D Modeling Approach (Member 2 leads, team aligns):**
  - **Option A (Recommended):** Modular separate parts (bus, solar panels, engine, antenna) snapped together in 3D.
  - **Option B:** Prebuilt spacecraft models with customizable attributes/skins.

---

## Phase C — Member 1: Mission & Science
**Branch:** `feature/mission-science` | **Folder:** `src/modules/mission-science/`

### C1. Mission Scenarios Catalog (`data/missions.js`)
- [ ] Define 4–5 distinct playable missions in `MISSIONS`:
  1. **Earth Climate Monitor** (`LEO`, ~500 km, low cost, moderate science target).
  2. **Global Weather Relay** (`GEO`, ~35,786 km, long-range comms, high data rate).
  3. **Navigation Constellation Test** (`MEO`, ~20,200 km, radiation-hardened needs).
  4. **Lunar Surface Mapper** (`LUNAR`, ~384,400 km, strict mass/$\Delta v$/deep-space antenna requirements).
- [ ] Include educational descriptions explaining *why* each orbit & constraint matters.
- [ ] Implement `getMissions()` and `getMissionById(missionId)`.

### C2. Scientific Instruments Database (`data/instruments.js`)
- [ ] Define 6–8 scientific instruments in `INSTRUMENTS` (e.g., *Multispectral Imager*, *IR Spectrometer*, *SAR Radar*, *Magnetometer*, *Laser Altimeter*, *Dust Analyzer*).
- [ ] Balance trade-offs for every instrument: `massKg`, `powerWatts`, `dataRateKbps`, `costMillions`, `sciencePoints`, plus compatible mission types / short description.
- [ ] Implement `getInstruments()` and `getInstrumentById(instrumentId)`.

### C3. Mission Planner UI (`ui/MissionPlanner.js`)
- [ ] Implement `mount()` to render mission selection cards and multi-select instrument toggles.
- [ ] Display live totals for selected instruments: total payload mass, total payload power draw, total data rate, total payload cost, and projected science points vs. `minSciencePoints`.
- [ ] On every selection change, build a `MissionSpec` (`createDefaultMissionSpec()`) and publish it via `gameState.setMission(spec)`.
- [ ] Add a "Proceed to Spacecraft Design" validation indicator (`validateMissionSpec(spec)`).
- [ ] Implement `destroy()` to clean up DOM and event listeners cleanly.

### C4. Mission Evaluation & Scoring (`logic/MissionEvaluator.js`)
- [ ] Implement `checkRequirements(missionSpec, spacecraftSpec, launchResult)` checking:
  - Total Cost (`spacecraftSpec.costMillions + payloadCost + launchResult.launchCostMillions <= missionSpec.budgetMillions`)
  - Power Balance (`spacecraftSpec.powerGeneratedWatts >= spacecraftSpec.powerConsumedWatts`)
  - Comms Range & Data Rate (`maxRangeKm >= targetDistanceKm` and `maxDataRateKbps >= requiredDataRateKbps`)
  - Science Value (`sum(instruments.sciencePoints) >= minSciencePoints`)
  - Launch Outcome (`launchResult.success === true` and target orbit reached)
- [ ] Implement `calculateScore(...)` returning `{ score (0–100), grade (S/A/B/C/F), summary, checks[] }` with clear explanations of what succeeded or failed.

### C5. Module Lifecycle & 3D Preview (`index.js`)
- [ ] Implement `mount(sceneManager, gameState, uiContainer)`: show a subtle 3D target visual (e.g., rotating globe/target marker) in `sceneManager` and mount `MissionPlanner`.
- [ ] Implement `update(deltaTime)` and `unmount()` (remove 3D preview objects and call `planner.destroy()`).
- [ ] Verify `evaluateMission(gameState)` integrates cleanly with Member 4's Results screen.

---

## Phase D — Member 2: Spacecraft Design
**Branch:** `feature/spacecraft-design` | **Folder:** `src/modules/spacecraft-design/`

### D1. Component Database (`data/components.js`)
- [ ] Populate `SPACECRAFT_COMPONENTS` across all 6 categories:
  - **Structures:** CubeSat 6U Bus, SmallSat Bus, Medium Modular Bus, Heavy Deep-Space Bus (include `massKg`, `costMillions`, `maxPayloadMassKg`, `attachmentPoints`).
  - **Solar Panels:** Fixed Body Panels, Twin Deployable Wings, High-Efficiency Triple-Junction Arrays (`massKg`, `powerGeneratedWatts`, `costMillions`).
  - **Batteries:** Compact Li-Ion, Dual Redundant Pack, Deep-Space High-Capacity (`massKg`, `capacityWh`, `costMillions`).
  - **Propulsion:** Cold Gas Thruster, Hydrazine Monopropellant, Bipropellant Engine, Xenon Ion Thruster (`dryMassKg`, `propellantMassKg`, `ispSeconds`, `thrustN`, `powerWatts`, `costMillions`).
  - **Antennas:** S-Band Patch, X-Band Dish, Ka-Band Deep-Space Dish (`massKg`, `powerWatts`, `maxRangeKm`, `maxDataRateKbps`, `costMillions`).
  - **Avionics:** Standard Flight Computer, Radiation-Hardened Avionics (`massKg`, `powerWatts`, `costMillions`).
- [ ] Implement `getComponentsByCategory()` and `getComponentById()`.

### D2. Modular 3D Component Builders (`models/`)
- [ ] `Structure.js`: Build/load 3D chassis mesh (or integrate/split `public/models/space_craft.glb`) and return accurate `getAttachmentPoints()` vectors for left/right wings, bottom engine, and top antenna.
- [ ] `SolarPanels.js`: Build 3D solar wings with metallic frames + solar cell materials; implement `setDeployed(isDeployed)` hinge rotation.
- [ ] `Propulsion.js`: Build 3D thruster nozzle + propellant tank; implement `setThrustActive(active)` to show/hide glowing exhaust plume during Member 3's orbit burn.
- [ ] `Antenna.js`: Build 3D patch or parabolic dish antenna mesh.
- [ ] `Spacecraft.js`: Implement `assemble(selection)` to clear previous meshes, build all selected parts, snap them to `Structure.getAttachmentPoints()`, and return one unified `THREE.Group`. Implement `dispose()` to free GPU geometries/materials.

### D3. Configuration & Engineering Calculations (`logic/SpacecraftConfig.js`)
- [ ] Implement `setComponent(category, componentId)` and `setInstruments(gameState.mission?.instruments)`.
- [ ] Implement `computeMetrics()` summing:
  - `dryMassKg` (structure + subsystems + mission instruments)
  - `propellantMassKg`
  - `totalMassKg` (`dryMassKg + propellantMassKg`)
  - `powerGeneratedWatts` vs. `powerConsumedWatts` (avionics + antenna + propulsion + instruments)
  - `ispSeconds`, `maxDataRateKbps`, `maxRangeKm`, `costMillions`.
- [ ] Implement `toSpacecraftSpec(missionSpec)` combining metrics + `Compatibility.validate(...)` and publishing to `gameState.setSpacecraft(spec)`.

### D4. Compatibility Rules (`logic/Compatibility.js`)
- [ ] Implement `validate(metrics, missionSpec)` checking:
  - All 6 required subsystems are selected.
  - Payload + subsystem mass does not exceed `structure.maxPayloadMassKg`.
  - Power generated ≥ power consumed (error if deficit, warning if margin < 15%).
  - Antenna `maxRangeKm` ≥ `missionSpec.targetDistanceKm` and `maxDataRateKbps` ≥ `missionSpec.requiredDataRateKbps`.
  - Combined hardware + mission payload cost within `missionSpec.budgetMillions`.

### D5. Configurator UI & Assembly Bay Scene (`ui/SpacecraftConfigurator.js` & `index.js`)
- [ ] Build category tabs (Structure, Solar Panels, Batteries, Propulsion, Antenna, Avionics) with component cards showing stats & cost.
- [ ] Render live mass, power balance bar, and compatibility error/warning badges in `updateStats(spacecraftSpec)`.
- [ ] In `index.js`: set up studio lighting + `OrbitControls` around the live 3D `Spacecraft` model so swapping any component updates the 3D view immediately.
- [ ] Export `buildSpacecraftModel(spacecraftSpec)` so Member 3 can spawn the player's exact spacecraft in orbit.

---

## Phase E — Member 3: Launch & Orbit
**Branch:** `feature/launch-orbit` | **Folder:** `src/modules/launch-orbit/`

### E1. Launch Vehicles & Orbits Databases (`data/rockets.js`, `data/orbits.js`)
- [ ] Populate `ROCKETS` with 3–4 rockets (e.g., *MicroLaunch SmallSat*, *Medium Orbital LV*, *Heavy Lift LV*, *Super-Heavy Deep Space*) with `maxPayloadLeoKg`, `launcherDeltaVMs`, `fairingDiameterM`, and `costMillions`.
- [ ] Populate `ORBITS` (`LEO`, `MEO`, `GEO`, `LUNAR`) matching Member 1's `targetOrbitId` keys, with `altitudeKm`, `requiredDeltaVMs`, `orbitalPeriodSec` (visual), `orbitRadius3D`, and educational descriptions.

### E2. Orbital & Rocket Physics (`logic/OrbitMechanics.js`)
- [ ] Implement `calculateRequiredDeltaV(orbit)` returning target $\Delta v$ in m/s.
- [ ] Implement `calculateSpacecraftDeltaV(spacecraftSpec)` using Tsiolkovsky's rocket equation:
  $$\Delta v = I_{sp} \cdot g_0 \cdot \ln\left(\frac{m_{\text{total}}}{m_{\text{dry}}}\right)$$
  using `PHYSICS.STANDARD_GRAVITY_MS2` from `src/shared/data/constants.js`.
- [ ] Implement `simulateLaunch(rocket, spacecraftSpec, targetOrbit)`:
  - Check `spacecraftSpec.totalMassKg <= rocket.maxPayloadLeoKg` (fail if too heavy).
  - Check `rocket.launcherDeltaVMs + spacecraftDeltaV >= requiredDeltaV` (fail if insufficient $\Delta v$).
  - Return a complete `LaunchResult` (`success`, `achievedAltitudeKm`, `remainingDeltaVMs`, `launchCostMillions`, `failureReason`).

### E3. 3D Planet & Orbit Visualization (`models/PlanetScene.js`)
- [ ] Implement `buildEarth()`: 3D Earth sphere (textured or procedural shader/materials), subtle atmosphere halo, directional sunlight, and starfield background.
- [ ] Implement `buildOrbitRing(orbit)`: circular/elliptical visual orbit ring scaled to the target orbit.
- [ ] Implement `update(deltaTime)` (gentle Earth rotation) and `dispose()`.

### E4. Launch & Orbital Insertion Animation (`models/LaunchAnimation.js`)
- [ ] Implement `start(rocket, spacecraftGroup, orbit, launchResult)`:
  - Phase 1: Rocket ascends from Earth surface along launch trajectory.
  - Phase 2: Stage separation / fairing release reveals the player's 3D spacecraft (`buildSpacecraftModel(gameState.spacecraft)`).
  - Phase 3: If `launchResult.success`, deploy solar panels (`setDeployed(true)`), fire thruster (`setThrustActive(true)` briefly), and place spacecraft in continuous orbit along the orbit ring. If failed, animate sub-orbital decay/failure state.
- [ ] Implement `update(deltaTime)` and `isComplete()`.

### E5. Launch Control UI & Module Integration (`ui/LaunchControlPanel.js` & `index.js`)
- [ ] Render rocket selection cards, payload mass check (`spacecraft.totalMassKg / rocket.maxPayloadLeoKg`), $\Delta v$ budget bar, remaining mission budget check, and **Launch Mission** button.
- [ ] Implement `updateTelemetry(telemetry)` showing live altitude, velocity, flight stage, and remaining $\Delta v$ during the animation.
- [ ] In `index.js`, wire `OrbitMechanics`, `PlanetScene`, `LaunchAnimation`, `LaunchControlPanel`, publish `gameState.setLaunch(result)`, and clean everything up in `unmount()`.

---

## Phase F — Member 4: Interface & Integration
**Branch:** `feature/game-interface` | **Folder:** `src/modules/game-interface/`

### F1. Global Theme & Layout Styling (`src/styles/main.css`)
- [ ] Design clean space-mission HUD layout: full-screen 3D canvas behind non-blocking UI overlays (top bar for HUD + Stepper, side panel for module controls, center modal for Results).
- [ ] Make layout responsive for desktop, tablet, and mobile viewports.

### F2. Persistent Resource HUD (`ui/ResourceHUD.js`)
- [ ] Subscribe to `GameState` (`this.gameState.subscribe(...)`) and display live:
  - **Mission Name & Target Orbit**
  - **Budget Used / Budget Cap** (`$X.XM / $Y.YM`) with color status (green/amber/red)
  - **Spacecraft Mass** (`kg`)
  - **Power Balance** (`+W` or `-W` deficit)
  - **Engineering Readiness** (Valid / Errors count)

### F3. Phase Navigation Stepper (`ui/PhaseStepper.js`)
- [ ] Render the 4-step workflow bar: **1. Mission** → **2. Spacecraft** → **3. Launch & Orbit** → **4. Results**.
- [ ] Visually distinguish completed, active, and locked steps, and forward clicks to `GameFlowController`.

### F4. Phase Orchestration (`logic/GameFlowController.js`)
- [ ] Implement `canAdvanceTo(targetPhase)`:
  - Block entering `spacecraft` until `validateMissionSpec(gameState.mission).valid`.
  - Block entering `launch` until `gameState.spacecraft?.isValid`.
  - Block entering `results` until `gameState.launch` exists.
- [ ] Implement `setPhase(phase)` to call `activeModule.unmount()`, clear `moduleContainer`, mount the target module (`mission-science`, `spacecraft-design`, or `launch-orbit`), or open `MissionResultsModal`.
- [ ] Forward `update(deltaTime)` from the `requestAnimationFrame` loop to the active module.

### F5. Results Modal & App Bootstrap (`ui/MissionResultsModal.js`, `index.js`, `src/main.js`)
- [ ] Build `MissionResultsModal.show(evaluationResult, actions)` displaying the score, grade, pass/fail checklist from `mission-science.evaluateMission(gameState)`, and **Modify Spacecraft** / **New Mission** buttons.
- [ ] Implement `initGame(rootElement)` in `src/modules/game-interface/index.js` connecting `SceneManager`, `GameState`, `ResourceHUD`, `PhaseStepper`, `GameFlowController`, and the `requestAnimationFrame` loop.
- [ ] Update `src/main.js` (once modules are ready to integrate) to call `initGame(document.getElementById("app"))` instead of the Phase 0 rotating cube.

---

## Phase G — End-to-End Integration, Testing & Deployment (X to Z)

- [ ] **X. Merge Feature Branches via Pull Requests:**
  - Review and merge `feature/mission-science`, `feature/spacecraft-design`, `feature/launch-orbit`, and `feature/game-interface` into `main` in order (or resolve shared changes cleanly).
- [ ] **Y. Full Playthrough QA Checklist:**
  - Play through all missions from Step 1 to Step 4 without console errors.
  - Test failure edge cases: power deficit, overweight rocket, insufficient $\Delta v$, out-of-range antenna, over-budget design, and switching back from Launch → Spacecraft → Launch (verifying no leaked 3D objects or duplicate listeners).
  - Run `docker compose exec game npm run build` and `docker compose exec game npm run preview` to test the production bundle.
- [ ] **Z. Deploy to Vercel & Finalize Demo:**
  - Connect the GitHub repository to Vercel (`Framework: Vite`, `Build: npm run build`, `Output: dist`).
  - Test the live HTTPS Vercel URL on desktop and mobile devices.
  - Record demo video / screenshots and finalize hackathon submission.
