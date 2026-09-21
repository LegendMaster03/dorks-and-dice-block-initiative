import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";

import { initializeConditionLayoutUi } from "../.test-dist/condition-layout-ui.js";
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

test("condition layout matches combatants by identity even when health rows are out of order", async () => {
    root.innerHTML = `
<section data-combat-dashboard>
  <div data-condition-dashboard>
    <article class="bi-condition-dashboard-row" data-combatant-id="alpha">
      <div data-condition-editor-for="alpha"><button>Alpha condition</button></div>
    </article>
    <article class="bi-condition-dashboard-row" data-combatant-id="beta">
      <div data-condition-editor-for="beta"><button>Beta condition</button></div>
    </article>
  </div>
  <article class="bi-health-row" data-combatant-id="beta"></article>
  <article class="bi-health-row" data-combatant-id="alpha"></article>
</section>`;

    initializeConditionLayoutUi();
    window.dispatchEvent(new CustomEvent("block-initiative:preview", {
        detail: {
            response: {
                orderedCombatants: [
                    { id: "alpha", name: "Alpha", allianceId: "enemies", blockType: "standard" },
                    { id: "beta", name: "Beta", allianceId: "enemies", blockType: "standard" }
                ]
            }
        }
    }));
    await settle();

    const alpha = root.querySelector(".bi-health-row[data-combatant-id='alpha']");
    const beta = root.querySelector(".bi-health-row[data-combatant-id='beta']");
    assert.ok(alpha?.querySelector("[data-condition-editor-for='alpha']"));
    assert.ok(beta?.querySelector("[data-condition-editor-for='beta']"));
    assert.equal(alpha?.querySelector("[data-condition-editor-for='beta']"), null);
    assert.equal(beta?.querySelector("[data-condition-editor-for='alpha']"), null);
});
