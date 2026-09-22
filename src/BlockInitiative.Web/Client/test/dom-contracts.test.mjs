import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";

import { collectEncounterCards, mountEncounterCardSlot, mountEncounterCardState, removeEncounterCardState, renderEncounterCard, renderEncounterCardMetrics } from "../.test-dist/encounter-card-renderer.js";
import { initializeHealthControlUi } from "../.test-dist/health-control-ui.js";
import { requestEnhancement } from "../.test-dist/render-lifecycle.js";

const { window, document } = parseHTML("<html><head></head><body><div id='tool-root' class='block-initiative-app'></div></body></html>");
const root = document.getElementById("tool-root");
assert.ok(root);

Object.assign(globalThis, {
    window,
    document,
    HTMLElement: window.HTMLElement,
    HTMLInputElement: window.HTMLInputElement,
    HTMLSelectElement: window.HTMLSelectElement,
    Element: window.Element,
    Node: window.Node,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    CSS: window.CSS
});

function settle() {
    requestEnhancement();
    return new Promise(resolve => setTimeout(resolve, 5));
}

test("health controls bind by semantic field identity instead of visible labels", async () => {
    root.innerHTML = `
<section data-combat-setup="standard">
  <div class="bi-combat-grid">
    <div class="bi-field" data-combat-field="max-hp">
      <label>Maximum hit points</label>
      <input type="number" data-combat-field="max-hp" value="20">
    </div>
    <div class="bi-field" data-combat-field="current-hp">
      <label>Current hit points</label>
      <input type="number" data-combat-field="current-hp">
    </div>
  </div>
</section>`;

    initializeHealthControlUi();
    await settle();

    const summary = root.querySelector("[data-role='hp-summary']");
    assert.ok(summary, "expected compact HP editor");
    assert.equal(summary.textContent, "20 / 20");

    const current = root.querySelector("input[data-combat-field='current-hp']");
    assert.ok(current);
    assert.equal(current.value, "20");
});

test("encounter card renderer owns canonical slot order and replacement", () => {
    const card = document.createElement("article");
    card.className = "bi-runner-member";

    const quickStats = document.createElement("section");
    const context = document.createElement("div");
    const identity = document.createElement("div");
    const metrics = document.createElement("div");
    const acted = document.createElement("label");
    const initiative = document.createElement("div");

    mountEncounterCardSlot(card, "quick-stats", quickStats);
    mountEncounterCardSlot(card, "context", context);
    mountEncounterCardSlot(card, "identity", identity);
    mountEncounterCardSlot(card, "metrics", metrics);
    mountEncounterCardSlot(card, "acted", acted);
    mountEncounterCardSlot(card, "initiative", initiative);

    assert.deepEqual(
        Array.from(card.children).map(element => element.dataset.cardSlot),
        ["identity", "initiative", "acted", "context", "metrics", "quick-stats"]
    );

    const replacement = document.createElement("section");
    mountEncounterCardSlot(card, "quick-stats", replacement);
    assert.equal(card.querySelectorAll(":scope > [data-card-slot='quick-stats']").length, 1);
    assert.equal(card.querySelector(":scope > [data-card-slot='quick-stats']"), replacement);
});


test("encounter card renderer reuses stateful cards across block rebuilds", () => {
    const stack = document.createElement("div");
    const first = renderEncounterCard(undefined, { id: "alpha", name: "Alpha", meta: [] });
    const hpEditor = document.createElement("div");
    hpEditor.className = "bi-hp-editor";
    const state = document.createElement("section");
    state.append(hpEditor);
    mountEncounterCardSlot(first, "state", state);
    stack.append(first);

    const reusable = collectEncounterCards(stack);
    stack.replaceChildren();

    const rebuilt = renderEncounterCard(reusable.get("alpha"), {
        id: "alpha",
        name: "Alpha renamed",
        meta: ["Enemy"]
    });
    stack.append(rebuilt);

    assert.equal(rebuilt, first);
    assert.equal(rebuilt.querySelector(".bi-hp-editor"), hpEditor);
    assert.equal(rebuilt.querySelector("[data-card-slot='identity'] strong")?.textContent, "Alpha renamed");
});


test("encounter card renderer owns keyed combat state within the state slot", () => {
    const card = renderEncounterCard(undefined, { id: "alpha", name: "Alpha", meta: [] });
    const firstHealth = document.createElement("article");
    const replacementHealth = document.createElement("article");
    const kaiju = document.createElement("section");

    mountEncounterCardState(card, "health", firstHealth);
    mountEncounterCardState(card, "kaiju", kaiju);
    mountEncounterCardState(card, "health", replacementHealth);

    const state = card.querySelector("[data-card-slot='state']");
    assert.ok(state);
    assert.equal(state.querySelectorAll(":scope > [data-card-state='health']").length, 1);
    assert.equal(state.querySelector(":scope > [data-card-state='health']"), replacementHealth);
    assert.equal(state.querySelector(":scope > [data-card-state='kaiju']"), kaiju);

    removeEncounterCardState(card, "health");
    assert.equal(state.querySelector("[data-card-state='health']"), null);
    assert.equal(state.querySelector("[data-card-state='kaiju']"), kaiju);
});


test("encounter card renderer owns AC speed and HP metric composition", () => {
    const card = renderEncounterCard(undefined, { id: "alpha", name: "Alpha", meta: [] });
    const healthRow = document.createElement("article");
    healthRow.className = "bi-health-row";
    const editor = document.createElement("div");
    editor.className = "bi-hp-editor";
    healthRow.append(editor);
    mountEncounterCardState(card, "health", healthRow);

    renderEncounterCardMetrics(card, {
        speed: "30 ft.",
        armorClass: "17",
        touchArmorClass: "13",
        flatFootedArmorClass: "15"
    });

    const metrics = card.querySelector("[data-card-slot='metrics']");
    assert.ok(metrics);
    assert.equal(metrics.querySelector("[data-stat='ac'] strong")?.textContent, "17");
    assert.equal(metrics.querySelector("[data-stat='touch-ac'] strong")?.textContent, "13");
    assert.equal(metrics.querySelector("[data-stat='flat-footed-ac'] strong")?.textContent, "15");
    assert.match(metrics.textContent ?? "", /Speed 30 ft\./);
    assert.equal(metrics.querySelector(".bi-hp-editor"), editor);
    assert.equal(healthRow.hidden, true);
});


test("encounter card renderer drops card-owned HP when health tracking is removed", () => {
    const card = renderEncounterCard(undefined, { id: "alpha", name: "Alpha", meta: [] });
    const healthRow = document.createElement("article");
    const editor = document.createElement("div");
    editor.className = "bi-hp-editor";
    healthRow.append(editor);
    mountEncounterCardState(card, "health", healthRow);

    renderEncounterCardMetrics(card, { speed: null, armorClass: "17" });
    assert.equal(card.querySelector(".bi-hp-editor"), editor);

    removeEncounterCardState(card, "health");
    renderEncounterCardMetrics(card, { speed: null, armorClass: "17" });

    assert.equal(card.querySelector(".bi-hp-editor"), null);
    assert.equal(card.querySelector(".bi-card-secondary-health"), null);
    assert.equal(card.querySelector("[data-stat='ac'] strong")?.textContent, "17");
});

test("compact HP damage can enter negative hit points", async () => {
    root.innerHTML = `
<section data-combat-setup="standard">
  <div class="bi-combat-grid">
    <div class="bi-field" data-combat-field="max-hp">
      <label>Max HP</label>
      <input type="number" data-combat-field="max-hp" value="10">
    </div>
    <div class="bi-field" data-combat-field="current-hp">
      <label>Current HP</label>
      <input type="number" data-combat-field="current-hp" value="2">
    </div>
  </div>
</section>`;

    await settle();

    const editor = root.querySelector(".bi-hp-editor");
    assert.ok(editor);

    const amount = editor.querySelector("input[title='Amount to add to or subtract from current HP']");
    assert.ok(amount);
    amount.value = "5";

    const subtract = Array.from(editor.querySelectorAll("button"))
        .find(button => button.getAttribute("aria-label") === "Subtract HP modifier");
    assert.ok(subtract);
    subtract.click();

    const current = root.querySelector("input[data-combat-field='current-hp']");
    assert.equal(current.value, "-3");
});

