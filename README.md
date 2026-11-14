# Space Mission Design Game — 2026 NASA Space Apps Challenge

An interactive 3D web game built with **Three.js** and **Vite** where players design, configure, launch, and evaluate a complete space mission while balancing real-world engineering trade-offs across **budget, mass, power, communications, data rate, and orbital mechanics**.

---

## Project Overview

Players progress through four connected phases:

1. **Mission & Science Planning** — Choose a mission objective (e.g., Earth Observation LEO, Weather GEO, Lunar Orbiter) and select scientific payload instruments.
2. **Spacecraft Design** — Assemble a 3D spacecraft from modular subsystems (structure, solar panels, batteries, propulsion, antenna, avionics) and verify engineering compatibility.
3. **Launch & Orbit Simulation** — Pick a launch vehicle, check payload mass and $\Delta v$ margins, and watch the 3D launch and orbital insertion around Earth.
4. **Mission Evaluation** — Review mission success or failure, score breakdown, and engineering feedback on resource trade-offs.

---

## Tech Stack

| Tool | Purpose |
| :--- | :--- |
| **Three.js** | 3D rendering engine (`WebGLRenderer`, GLB models, orbit & spacecraft scenes) |
| **Vite** | Development server and production bundler |
| **Docker & Docker Compose** | Identical `node:24-alpine` dev environment across all team computers |
| **GitHub** | Version control, feature branches, and Pull Request reviews |
| **Vercel** | Cloud deployment for the production static bundle (`dist/`) |

---

## Team Ownership & Branches

Each team member owns an isolated module folder under `src/modules/` and develops on their dedicated branch. See **[tasks.md](./tasks.md)** for the full A-to-Z task breakdown.

| Member | Role | Owned Directory | Git Branch |
| :--- | :--- | :--- | :--- |
| **Member 1** | Mission & Science | `src/modules/mission-science/` | `feature/mission-science` |
| **Member 2** | Spacecraft Design | `src/modules/spacecraft-design/` | `feature/spacecraft-design` |
| **Member 3** | Launch & Orbit | `src/modules/launch-orbit/` | `feature/launch-orbit` |
| **Member 4** | Interface & Integration | `src/modules/game-interface/` | `feature/game-interface` |

---

## Architecture & Folder Structure

```text
NASA_SPACE_APPS_CHALLENGE/
├── public/
│   └── models/                  # Static 3D assets (.glb / .gltf)
│       └── space_craft.glb
├── src/
│   ├── main.js                  # Application bootstrap
│   ├── core/
│   │   ├── SceneManager.js      # Shared Three.js Scene, Camera, Renderer, resize loop
│   │   └── GameState.js         # Central reactive pub/sub state store
│   ├── modules/
│   │   ├── mission-science/     # Member 1: missions, instruments, scoring
│   │   ├── spacecraft-design/   # Member 2: component DB, 3D assembly, compatibility
│   │   ├── launch-orbit/        # Member 3: rockets, orbits, delta-v physics, 3D launch
│   │   └── game-interface/      # Member 4: phase flow, HUD, stepper, results modal
│   ├── shared/
│   │   ├── data/                # Shared physical/game constants (constants.js)
│   │   ├── interfaces/          # Cross-module contracts (MissionSpec, SpacecraftSpec, LaunchResult, GameModule)
│   │   └── utils/               # Shared helpers (AssetLoader.js, formatters.js)
│   └── styles/
│       └── main.css             # Global layout and UI theme variables
├── index.html
├── package.json
├── package-lock.json
├── Dockerfile                   # Multi-stage production Nginx build
├── compose.yaml                 # Local Node 24 Docker dev server
├── tasks.md                     # Detailed A-to-Z tasks per team member
└── README.md
```

### Cross-Module Data Flow

```text
Member 1 (MissionSpec) ──▶ GameState ──▶ Member 2 (SpacecraftSpec + 3D model)
                               │
                               ▼
Member 3 (LaunchResult) ◀── GameState ◀── Member 4 (GameFlowController & HUD)
                               │
                               ▼
                   Member 1 (MissionEvaluator) ──▶ Results Screen
```

---

## Getting Started (Docker)

You do **not** need Node.js installed locally; everything runs inside Docker using `node:24-alpine`.

1. **Start the development server:**
   ```bash
   docker compose up
   ```
   *(Or run in the background with `docker compose up -d`.)*
2. **Open the game in your browser:**
   `http://localhost:5173`
3. **Stop the server:**
   ```bash
   docker compose down
   ```

> **Linux without `sudo`:** If Docker fails with a socket permission error, initialize rootless Docker once with `dockerd-rootless-setuptool.sh install` and ensure `DOCKER_HOST=unix:///run/user/$(id -u)/docker.sock` is set.

---

## Team Git & Collaboration Rules

- **Never push directly to `main`** — keep `main` stable and merge via Pull Requests.
- **Work on your own module branch** (`feature/mission-science`, `feature/spacecraft-design`, `feature/launch-orbit`, `feature/game-interface`).
- **Agree before editing `src/shared/` or `src/core/`** — changes there affect all four members.
- **Dependencies:** Install packages inside Docker (`docker compose exec game npm install <pkg>`) and commit **both** `package.json` and `package-lock.json`.

---

## Deployment (Vercel)

1. Import the GitHub repository into **Vercel**.
2. Use the Vite preset:
   - **Framework:** `Vite`
   - **Install command:** `npm install`
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
3. Alternatively, build a standalone production container using `Dockerfile`:
   ```bash
   docker build -t space-mission-game .
   docker run -p 8080:80 space-mission-game
   ```

---

## Challenge Context & Resources

- **Event:** 2026 NASA Space Apps Challenge — *Space Mission Design Game*
- **NASA 3D Resources:** https://science.nasa.gov/3d-resources/
- **Full A-to-Z Roadmap & Member Checklists:** [tasks.md](./tasks.md)
