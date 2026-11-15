/**
 * @file src/modules/game-interface/__tests__/startScreen.test.js
 * @owner Member 4 (Interface & Integration)
 * @goal Headless unit tests for StartScreenScene (3D Earth, Moon, spacecraft, space station)
 *       and StartScreen UI (ORBIT CRAFT logo + single START MISSION button).
 */

import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { StartScreenScene } from "../models/StartScreenScene.js";
import { StartScreen } from "../ui/StartScreen.js";

test("StartScreenScene mounts spacecraft, space station, Earth horizon, and Moon then unmounts cleanly", () => {
  const scene = new THREE.Scene();
  let cameraSet = false;
  const mockSceneManager = {
    scene,
    addObject: (obj) => scene.add(obj),
    removeObject: (obj) => scene.remove(obj),
    setCamera: () => {
      cameraSet = true;
    },
  };

  const startScene = new StartScreenScene(mockSceneManager);
  startScene.mount();

  assert.ok(cameraSet, "Expected camera framing to be set on mount");
  const root = scene.getObjectByName("orbit-craft-start-scene");
  assert.ok(root, "Expected orbit-craft-start-scene group in scene");
  assert.ok(root.getObjectByName("start-spacecraft"), "Expected spacecraft in start scene");
  assert.ok(root.getObjectByName("start-space-station"), "Expected space station in start scene");
  assert.ok(root.getObjectByName("start-earth-horizon"), "Expected Earth horizon in start scene");
  assert.ok(root.getObjectByName("planet:moon"), "Expected Moon in start scene");

  startScene.update(0.016);
  startScene.unmount();
  assert.equal(scene.getObjectByName("orbit-craft-start-scene"), undefined);
});

test("StartScreen renders only the ORBIT CRAFT logo and single START MISSION button", () => {
  const prevDocument = globalThis.document;
  const createdNodes = [];
  const listeners = {};
  let appendedChild = null;

  const mockButton = {
    addEventListener: (type, fn) => {
      listeners[type] = fn;
    },
  };

  const mockSection = {
    className: "",
    attributes: {},
    innerHTML: "",
    classList: {
      classes: new Set(),
      add(cls) {
        this.classes.add(cls);
      },
    },
    setAttribute(k, v) {
      this.attributes[k] = v;
    },
    querySelector(sel) {
      return sel === '[data-action="start-mission"]' ? mockButton : null;
    },
    remove() {
      appendedChild = null;
    },
  };

  globalThis.document = {
    createElement(tag) {
      createdNodes.push(tag);
      return mockSection;
    },
  };

  try {
    let started = false;
    const mockContainer = {
      appendChild(node) {
        appendedChild = node;
      },
    };

    const screen = new StartScreen(mockContainer, () => {
      started = true;
    });
    screen.mount();

    assert.equal(appendedChild, mockSection);
    assert.ok(mockSection.innerHTML.includes("START MISSION"));
    assert.ok(mockSection.innerHTML.includes("RBIT") && mockSection.innerHTML.includes("CRAFT"));

    // Verify only one <button> exists on the main menu
    const buttonMatches = mockSection.innerHTML.match(/<button\b/g) ?? [];
    assert.equal(buttonMatches.length, 1, "Main menu must contain only one button");

    assert.equal(typeof listeners.click, "function");
    listeners.click();
    assert.ok(mockSection.classList.classes.has("oc-start-leaving"));

    // Immediate cleanup works cleanly
    screen.destroy();
    assert.equal(appendedChild, null);
    assert.equal(started, false); // fires after transition timeout when unreduced
  } finally {
    globalThis.document = prevDocument;
  }
});
