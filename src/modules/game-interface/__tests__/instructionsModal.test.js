/**
 * @file src/modules/game-interface/__tests__/instructionsModal.test.js
 * @goal Unit tests for InstructionsModal sections, phase-aware opening, tab switching, and close lifecycle.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { InstructionsModal, INSTRUCTION_SECTIONS } from "../ui/InstructionsModal.js";

function makeMockContainer() {
  const listeners = new Map();
  return {
    innerHTML: "",
    addEventListener(type, fn) {
      listeners.set(type, fn);
    },
    removeEventListener(type, fn) {
      if (listeners.get(type) === fn) listeners.delete(type);
    },
    dispatchClick(target) {
      listeners.get("click")?.({ target });
    },
  };
}

test("INSTRUCTION_SECTIONS covers overview, all four phases, and 3D controls", () => {
  const ids = INSTRUCTION_SECTIONS.map((s) => s.id);
  assert.deepEqual(ids, ["overview", "mission", "spacecraft", "launch", "results", "controls"]);
  for (const section of INSTRUCTION_SECTIONS) {
    assert.ok(section.title.length > 0);
    assert.ok(section.cards.length >= 2);
  }
});

test("InstructionsModal opens to the active phase section by default and toggles cleanly", () => {
  const container = makeMockContainer();
  let currentPhase = "spacecraft";
  const modal = new InstructionsModal(container, () => currentPhase);
  modal.mount();

  assert.equal(modal.isOpen(), false);
  modal.open();
  assert.equal(modal.isOpen(), true);
  assert.match(container.innerHTML, /Spacecraft Engineering/);

  modal.setSection("launch");
  assert.match(container.innerHTML, /Launch Vehicle &amp; Flight Operations/);

  modal.close();
  assert.equal(modal.isOpen(), false);
  assert.equal(container.innerHTML, "");

  currentPhase = "results";
  modal.toggle();
  assert.equal(modal.isOpen(), true);
  assert.match(container.innerHTML, /Results &amp; Iteration/);

  modal.destroy();
  assert.equal(container.innerHTML, "");
});

test("InstructionsModal closes on backdrop or close-button click and switches on tab click", () => {
  const container = makeMockContainer();
  const modal = new InstructionsModal(container, () => "overview");
  modal.mount();
  modal.open("overview");

  container.dispatchClick({
    classList: { contains: () => false },
    closest: (sel) => (sel === "[data-inst-tab]" ? { dataset: { instTab: "controls" } } : null),
  });
  assert.match(container.innerHTML, /Camera Controls &amp; Keyboard Shortcuts/);

  container.dispatchClick({
    classList: { contains: () => false },
    closest: (sel) => (sel === "[data-inst-close]" ? {} : null),
  });
  assert.equal(modal.isOpen(), false);
  assert.equal(container.innerHTML, "");
});
