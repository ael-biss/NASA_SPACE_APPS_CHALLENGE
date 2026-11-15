/**
 * @file src/shared/i18n/strings.en.js
 * @goal Centralized English UI strings for New Player Guidance (Welcome, Spotlight Tour,
 *       Contextual Hints, Glossary labels, Help Panel, and Progressive Difficulty Nudge).
 *       Structured for drop-in translation (e.g. French, Arabic RTL).
 */

export const STRINGS_EN = {
  locale: "en",
  dir: "ltr",

  welcome: {
    badge: "Mission Control · First Flight",
    title: "New to space engineering?",
    body: "Take the 2-minute guided tour on an Easy Landsat-class Earth mission with a forgiving budget.",
    tutorialBadge: "Tutorial Mission",
    startBtn: "Start Tour",
    skipBtn: "Skip",
    dismissBtn: "Don't show again",
  },

  controls: {
    helpBtnLabel: "?",
    helpBtnTitle: "Open Help, Glossary & Replay Tutorial",
    hintLabel: "Hint",
    muteLabel: "SFX",
    mutedLabel: "Muted",
    muteTitle: "Mute Sound Effects",
    unmuteTitle: "Unmute Sound Effects",
  },

  tour: {
    stepCounter: "{current} / {total}",
    announcement: "Step {current} of {total}: {title}. {body}",
    actionRequiredNotice: "Complete this action in the UI to continue.",
    backBtn: "Back",
    nextBtn: "Next",
    finishBtn: "Finish",
    skipBtn: "Skip tour",
    ariaRegionLabel: "Guided tutorial spotlight",
    steps: [
      {
        id: "mission-list",
        phase: "mission",
        title: "Choose a Real NASA Mission",
        body: "Each card is a real type of NASA mission. Difficulty and science points show how hard and how rewarding it is.",
      },
      {
        id: "topbar-hud",
        phase: "mission",
        title: "Mission Control Bar",
        body: "This is your control panel: budget, mass, power, and status. Keep an eye on it all game.",
      },
      {
        id: "select-mission-btn",
        phase: "mission",
        title: "Confirm Mission & Build Craft",
        body: "Pick a mission, then build your spacecraft.",
        actionRequired: "proceed-spacecraft",
      },
      {
        id: "subsystem-tabs",
        phase: "spacecraft",
        title: "Spacecraft Subsystems",
        body: "A spacecraft is a set of systems. Each tab is one system.",
      },
      {
        id: "structure-card",
        phase: "spacecraft",
        title: "Structural Bus & Load Limit",
        body: "The bus holds everything together. It has a max load. Exceed it and the chassis can collapse during launch.",
        actionRequired: "select-bus",
      },
      {
        id: "power-bar",
        phase: "spacecraft",
        title: "Power Draw vs Generation",
        body: "Draw is what your systems use. Generation is what your panels make. Generation must be higher than draw.",
      },
      {
        id: "antenna-tab",
        phase: "spacecraft",
        title: "Watch Red Warning Dots",
        body: "A red dot means a problem here. Your antenna must reach your target. The Moon is 384,400 km away.",
      },
      {
        id: "validation-alerts",
        phase: "spacecraft",
        title: "Engineering Warnings",
        body: "Read the warnings. They tell you exactly what to fix.",
      },
      {
        id: "view-controls-3d",
        phase: "spacecraft",
        title: "Inspect Your 3D Spacecraft",
        body: "Drag to rotate, scroll to zoom.",
      },
      {
        id: "auto-fix-btn",
        phase: "spacecraft",
        title: "Instant Auto-Fix Helper",
        body: "Stuck? Let the game suggest the cheapest fix.",
      },
      {
        id: "launch-vehicle-cards",
        phase: "launch",
        title: "Choose Your Rocket",
        body: "Cap is how much mass the rocket can lift. ΔV is its speed budget. Your payload must fit under Cap.",
        actionRequired: "select-rocket",
      },
      {
        id: "launch-metrics-panel",
        phase: "launch",
        title: "Pre-Launch Readiness Check",
        body: "Green = OK. Red = problem. Your mission needs enough ΔV to reach its orbit.",
      },
      {
        id: "launch-controls",
        phase: "launch",
        title: "Launch & Time Warp",
        body: "Press Launch and watch the live telemetry. Use time warp to speed it up.",
      },
      {
        id: "results-modal",
        phase: "results",
        title: "Mission Debrief & Score",
        body: "Your score, what passed, and what failed, with the fix.",
      },
      {
        id: "results-actions",
        phase: "results",
        title: "Iterate or Start Fresh",
        body: "Modify Spacecraft keeps your design so you can improve it. New Mission starts fresh.",
      },
    ],
  },

  hints: {
    chipPrefix: "💡",
    dismissLabel: "Dismiss hint",
    structuralOverload: "Your payload is heavier than this bus can carry. Try a bigger bus or remove parts.",
    powerDeficit: "Your systems draw more watts than solar panels generate. Upgrade panels or cut heavy draw.",
    antennaShort: "This antenna cannot reach the target orbit. Switch to a longer-range dish on the Antenna tab.",
    rocketPayload: "Your spacecraft + fairing exceeds this rocket's payload Cap. Pick a heavier launch vehicle.",
    dvInsufficient: "Not enough ΔV for orbit capture. Choose a higher-ΔV rocket or a lighter, higher-Isp thruster.",
    budgetExceeded: "Total mission cost exceeds the budget cap. Trim costly upgrades or use Auto-Fix for cheaper parts.",
    idlePrompt: "Need help? Press ?",
    repeatedFailure: "Same failure twice ({cause}) — exact fix: {fix}",
  },

  glossaryUi: {
    learnMoreLabel: "Learn more:",
    closeLabel: "Close definition",
  },

  nudge: {
    tutorialComplete: "Mission complete! Next challenge: {nextMissionName} (Medium).",
    launchNextBtn: "Launch Next Challenge →",
  },

  helpPanel: {
    title: "Mission Control Help",
    closeLabel: "Close help panel",
    replayTourBtn: "Replay Tutorial",
    settingsHeading: "Settings",
    hintsToggle: "Contextual Hints",
    hintsOn: "On",
    hintsOff: "Off",
    howToPlayHeading: "How to Play (4 Steps)",
    howToPlaySteps: [
      {
        num: "1",
        title: "Pick a Mission",
        body: "Select a target orbit and compatible science instruments within the mission budget.",
      },
      {
        num: "2",
        title: "Build Your Spacecraft",
        body: "Balance structural load, solar power, batteries, antenna range, thermal radiators, and shielding.",
      },
      {
        num: "3",
        title: "Choose a Rocket & Launch",
        body: "Match rocket payload capacity and ΔV to the orbit, then monitor live ascent telemetry.",
      },
      {
        num: "4",
        title: "Review & Iterate",
        body: "Inspect your score, compare against real NASA missions, and use Retry with Fixes to improve.",
      },
    ],
    controlsHeading: "Controls",
    controlsList: [
      { key: "Left-Drag", desc: "Rotate 3D camera around Earth or spacecraft" },
      { key: "Scroll", desc: "Zoom camera in and out" },
      { key: "Enter / →", desc: "Advance to next tutorial step" },
      { key: "← / Esc", desc: "Previous step / Skip tutorial or close Help" },
    ],
    glossaryHeading: "Aerospace Glossary",
    glossarySearchPlaceholder: "Search terms (e.g. ΔV, TWR, LEO, MLI)...",
    glossaryEmpty: "No matching terms found.",
  },
};
