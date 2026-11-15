/**
 * @file src/modules/game-interface/ui/StartScreen.js
 * @owner Member 4 (Interface & Integration)
 * @goal Minimalist sci-fi main menu overlay featuring the ORBIT CRAFT logo,
 *       outer HUD viewport frame, and single central START MISSION button.
 */

export class StartScreen {
  /**
   * @param {HTMLElement} container
   * @param {() => void} onStartMission
   */
  constructor(container, onStartMission) {
    this.container = container;
    this.onStartMission = onStartMission;
    this._root = null;
    this._started = false;
  }

  /** Render the start screen overlay and bind the START MISSION button. */
  mount() {
    this.destroy();

    const root = document.createElement("section");
    root.className = "oc-start-screen";
    root.setAttribute("aria-label", "ORBIT CRAFT Main Menu");

    root.innerHTML = `
      <!-- Outer HUD Viewport Frame -->
      <div class="oc-hud-frame" aria-hidden="true">
        <div class="oc-frame-edge oc-frame-top">
          <span class="oc-frame-tab oc-frame-tab-left"></span>
          <span class="oc-frame-ticks"></span>
          <span class="oc-frame-tab oc-frame-tab-right"></span>
        </div>
        <div class="oc-frame-edge oc-frame-bottom">
          <span class="oc-frame-tab oc-frame-tab-left"></span>
          <span class="oc-frame-ticks"></span>
          <span class="oc-frame-tab oc-frame-tab-right"></span>
        </div>
        <div class="oc-frame-side oc-frame-left"></div>
        <div class="oc-frame-side oc-frame-right"></div>
      </div>

      <!-- Centerpiece: ORBIT CRAFT Logo + Single START MISSION CTA -->
      <div class="oc-start-center">
        <h1 class="oc-logo" aria-label="ORBIT CRAFT">
          <span class="oc-logo-orbit">
            <svg class="oc-logo-emblem" viewBox="0 0 120 110" aria-hidden="true">
              <defs>
                <linearGradient id="oc-o-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#EAF4FF" />
                  <stop offset="100%" stop-color="#A8C8EE" />
                </linearGradient>
                <linearGradient id="oc-arc-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#FF9D24" />
                  <stop offset="60%" stop-color="#FFB94D" />
                  <stop offset="100%" stop-color="#FFE099" />
                </linearGradient>
              </defs>
              <!-- Outer stylized aperture ring for "O" -->
              <path
                d="M62 20 C36 20 18 39 18 61 C18 83 35 98 60 98 C86 98 103 80 103 58 C103 45 96 34 86 27 L77 39 C83 44 87 50 87 58 C87 72 76 83 60 83 C44 83 34 73 34 60 C34 46 46 35 62 35 C66 35 70 36 73 37 L80 24 C74 21 68 20 62 20 Z"
                fill="url(#oc-o-grad)"
              />
              <!-- Inner aperture fins -->
              <path d="M51 44 L73 46 L63 54 Z" fill="#19BFFF" opacity="0.88" />
              <path d="M44 68 L54 48 L56 62 Z" fill="#EAF4FF" opacity="0.72" />
              <path d="M76 66 L56 76 L67 61 Z" fill="#EAF4FF" opacity="0.72" />
              <!-- Sweeping Stellar Gold orbital swoosh -->
              <path
                d="M9 82 C-2 72 28 48 97 22 C63 40 24 66 18 77 C16 81 19 85 26 85 C17 87 12 85 9 82 Z"
                fill="url(#oc-arc-grad)"
              />
              <!-- 4-point Stellar Gold star at tip of orbit -->
              <path
                d="M101 5 L104 16 L115 19 L104 22 L101 33 L98 22 L87 19 L98 16 Z"
                fill="#FFCA63"
              />
            </svg>
            <span class="oc-logo-rbit">RBIT</span>
            <svg class="oc-sparkle oc-sparkle-cyan" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" fill="#19BFFF" />
            </svg>
          </span>

          <span class="oc-logo-craft-row">
            <span class="oc-wing oc-wing-left" aria-hidden="true"></span>
            <span class="oc-logo-craft">CRAFT</span>
            <span class="oc-wing oc-wing-right" aria-hidden="true"></span>
          </span>
        </h1>

        <button type="button" class="oc-start-btn" data-action="start-mission">
          <svg class="oc-btn-frame" viewBox="0 0 380 84" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="oc-btn-stroke" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#19BFFF" />
                <stop offset="50%" stop-color="#1677FF" />
                <stop offset="100%" stop-color="#19BFFF" />
              </linearGradient>
            </defs>
            <!-- Chamfered outer HUD border -->
            <polygon
              points="26,4 354,4 374,24 374,60 354,80 26,80 6,60 6,24"
              fill="rgba(16, 29, 51, 0.86)"
              stroke="url(#oc-btn-stroke)"
              stroke-width="2.2"
            />
            <!-- Inner hairline bevel -->
            <polygon
              points="31,10 349,10 368,28 368,56 349,74 31,74 12,56 12,28"
              fill="none"
              stroke="rgba(25, 191, 255, 0.35)"
              stroke-width="1"
            />
            <!-- Left & right thick cyan accent brackets -->
            <polyline points="24,4 6,24 6,60 24,80" fill="none" stroke="#19BFFF" stroke-width="4" />
            <polyline points="356,4 374,24 374,60 356,80" fill="none" stroke="#19BFFF" stroke-width="4" />
            <!-- Top-left & bottom-right diagonal HUD hash marks -->
            <path d="M40,7 L46,13 M49,7 L55,13 M58,7 L64,13" stroke="#19BFFF" stroke-width="2.5" />
            <path d="M316,71 L322,77 M325,71 L331,77 M334,71 L340,77" stroke="#19BFFF" stroke-width="2.5" />
          </svg>
          <span class="oc-start-btn-content">
            <svg class="oc-play-icon" viewBox="0 0 24 24" aria-hidden="true">
              <polygon points="6,4 20,12 6,20" fill="currentColor" />
            </svg>
            <span>START MISSION</span>
          </span>
        </button>
      </div>
    `;

    const btn = root.querySelector('[data-action="start-mission"]');
    btn?.addEventListener("click", () => this._handleStart());

    this.container.appendChild(root);
    this._root = root;
  }

  _handleStart() {
    if (this._started) return;
    this._started = true;

    if (this._root) {
      this._root.classList.add("oc-start-leaving");
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const delay = prefersReducedMotion ? 0 : 280;
    setTimeout(() => {
      this.destroy();
      this.onStartMission?.();
    }, delay);
  }

  /** Remove the start screen overlay cleanly. */
  destroy() {
    if (this._root) {
      this._root.remove();
      this._root = null;
    }
  }
}
