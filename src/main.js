/**
 * @file src/main.js
 * @owner Member 4 (Interface & Integration)
 * @goal Application entry point bootstrapping the integrated 4-phase NASA Space Mission
 *       Design & Physics Simulation Game.
 */

import "./styles/main.css";
import { initGame } from "./modules/game-interface/index.js";

const appRoot = document.getElementById("app") || document.body;
initGame(appRoot);
