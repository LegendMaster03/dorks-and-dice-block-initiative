import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { chooseHealthEditor } from "../.test-dist/encounter-card-model.js";
import { createRenderLifecycle } from "../.test-dist/render-lifecycle.js";

function controlledLifecycle() {
    const queue = [];
    const lifecycle = createRenderLifecycle(callback => queue.push(callback));
    const flushOne = () => {
        const callback = queue.shift();
        assert.ok(callback, "expected one scheduled lifecycle pass");
        callback();
    };
    return { lifecycle, queue, flushOne };
}

test("coalesces requests and runs hooks in deterministic order", () => {
    const { lifecycle, queue, flushOne } = controlledLifecycle();
    const calls = [];
    lifecycle.registerAfterRender("later", 20, () => calls.push("later"));
    lifecycle.registerAfterRender("alpha", 10, () => calls.push("alpha"));
    lifecycle.registerAfterRender("beta", 10, () => calls.push("beta"));

    lifecycle.requestEnhancement();
    lifecycle.requestEnhancement();
    lifecycle.requestEnhancement();

    assert.equal(queue.length, 1);
    flushOne();
    assert.deepEqual(calls, ["alpha", "beta", "later"]);
    assert.equal(queue.length, 0);
});

test("a hook can not recursively schedule itself", () => {
    const { lifecycle, queue, flushOne } = controlledLifecycle();
    let passes = 0;
    lifecycle.registerAfterRender("self-trigger", 10, () => {
        passes += 1;
        lifecycle.requestEnhancement();
    });

    lifecycle.requestEnhancement();
    flushOne();

    assert.equal(passes, 1);
    assert.equal(queue.length, 0);
});

test("condition changes and initiative advancement settle without duplicate UI or handlers", () => {
    const { lifecycle, queue, flushOne } = controlledLifecycle();
    const state = {
        conditions: [],
        activeBlock: 0
    };
    const view = {
        conditionSignature: "",
        activeBlock: -1,
        controls: new Set(),
        handlerInstallations: 0,
        mutations: 0
    };

    lifecycle.registerAfterRender("condition-ui", 10, () => {
        const signature = JSON.stringify(state.conditions);
        if (view.conditionSignature !== signature) {
            view.conditionSignature = signature;
            view.mutations += 1;
            // This deliberately models the old observer feedback hazard. The
            // coordinator must not allow a hook's own DOM change to recurse.
            lifecycle.requestEnhancement();
        }
        if (view.activeBlock !== state.activeBlock) {
            view.activeBlock = state.activeBlock;
            view.mutations += 1;
            lifecycle.requestEnhancement();
        }
        if (!view.controls.has("condition-control")) {
            view.controls.add("condition-control");
            view.mutations += 1;
        }
        if (view.handlerInstallations === 0) view.handlerInstallations += 1;
    });

    lifecycle.requestEnhancement();
    flushOne();
    const initialMutations = view.mutations;
    assert.equal(queue.length, 0);

    lifecycle.requestEnhancement();
    flushOne();
    assert.equal(view.mutations, initialMutations, "unchanged state must be idempotent");
    assert.equal(view.controls.size, 1);
    assert.equal(view.handlerInstallations, 1);

    state.conditions.push({ id: "condition-1", name: "Prone" });
    lifecycle.requestEnhancement();
    flushOne();
    assert.equal(queue.length, 0, "adding a condition must settle after one pass");
    assert.equal(view.controls.size, 1);
    assert.equal(view.handlerInstallations, 1);

    state.activeBlock += 1;
    lifecycle.requestEnhancement();
    flushOne();
    assert.equal(queue.length, 0, "advancing with visible conditions must settle after one pass");
    assert.equal(view.controls.size, 1);
    assert.equal(view.handlerInstallations, 1);
});

test("card-owned HP editor survives later enhancement passes and runner rebuilds", async () => {
    const firstEditor = { id: "first-hp-editor" };
    const replacementEditor = { id: "replacement-hp-editor" };

    assert.equal(chooseHealthEditor(firstEditor, null), firstEditor, "first pass should take the editor from the health row");
    assert.equal(chooseHealthEditor(null, firstEditor), firstEditor, "later passes should preserve the card-owned editor");
    assert.equal(chooseHealthEditor(replacementEditor, firstEditor), replacementEditor, "a newly rendered health editor should replace stale ownership");

    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const polishSource = await readFile(path.resolve(testDirectory, "../src/encounter-runner-polish-ui.ts"), "utf8");
    assert.match(polishSource, /registerAfterRender\("preserve-runner-health-controls",\s*15/);
    assert.match(polishSource, /healthRow\.append\(ownedHealthEditor\)/);
    assert.match(polishSource, /chooseHealthEditor\(rowHealthEditor, ownedHealthEditor\)/);
});

test("combat dashboard uses a direct runner action row as its insertion reference", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.resolve(testDirectory, "../src/combat-state-ui.ts"), "utf8");

    assert.match(source, /runner\.querySelector<HTMLElement>\(":scope > \.bi-actions"\)/);
    assert.doesNotMatch(source, /runner\.querySelector\("\.bi-actions"\)/);
});

test("setup initiative modifier is restored to the primary Mod column after combat-stats enhancement", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.resolve(testDirectory, "../src/combatant-field-ui.ts"), "utf8");

    assert.match(source, /registerAfterRender\("combatant-fields",\s*20/);
    assert.match(source, /registerAfterRender\("combatant-field-placement",\s*130/);
    assert.match(source, /const details = blockTypeInput\?\.closest\("details"\)/);
    assert.match(source, /modifierField\.parentElement !== main/);
    assert.match(source, /initiativeWrap\.before\(modifierField\)/);
    assert.doesNotMatch(source, /primaryFieldsReady === "true"\) continue/);
});

test("setup AC is shown between initiative and HP without moving the combat-stats source field", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.resolve(testDirectory, "../src/encounter-setup-polish-ui.ts"), "utf8");

    assert.match(source, /registerAfterRender\("encounter-setup-polish",\s*135/);
    assert.match(source, /data-quick-stat='armor-class'/);
    assert.match(source, /sourceWrap\.hidden = true/);
    assert.match(source, /initiativeWrap\.after\(field\)/);
    assert.match(source, /setup-ac-header/);
    assert.match(source, /grid-template-columns:minmax\(16rem,34rem\) 5rem 13rem 4\.5rem 6rem auto/);
    assert.match(source, /\[data-combat-setup='standard'\]\{grid-column:5;grid-row:1\}/);
});

test("encounter AC metric is visually larger than the generic secondary metric", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.resolve(testDirectory, "../src/encounter-runner-polish-ui.ts"), "utf8");

    assert.match(source, /bi-card-secondary-stat>strong\{font-size:1\.05rem/);
    assert.match(source, /bi-card-secondary-stat\[data-stat='ac'\]>strong\{font-size:1\.45rem\}/);
});

test("one setup action builds blocks and continues into start or resume", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.resolve(testDirectory, "../src/encounter-setup-polish-ui.ts"), "utf8");

    assert.match(source, /\[data-action='preview'\]/);
    assert.match(source, /block-initiative:preview/);
    assert.match(source, /requiresAdjudication/);
    assert.match(source, /registerAfterRender\("encounter-start-flow",\s*170/);
    assert.match(source, /\^\(Start encounter\|Resume encounter\)\$/);
    assert.match(source, /action\.click\(\)/);
    assert.match(source, /button\.textContent = "Start encounter"/);
    assert.match(source, /button\.textContent = "Apply changes & resume"/);
});

test("encounter initiative header shows the rolled total without repeating the modifier", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const affordancesSource = await readFile(path.resolve(testDirectory, "../src/encounter-card-affordances-ui.ts"), "utf8");
    const quickStatsSource = await readFile(path.resolve(testDirectory, "../src/combatant-quick-stats-ui.ts"), "utf8");

    assert.match(affordancesSource, /bi-card-initiative-total/);
    assert.doesNotMatch(affordancesSource, /bi-card-initiative-modifier/);
    assert.match(affordancesSource, /suppressDuplicateInitiativeFact\(card\)/);
    assert.match(quickStatsSource, /appendFact\(facts,\s*"Init",\s*initiative/);
});

test("encounter runner exposes reversible advancement through stable action identifiers", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const appSource = await readFile(path.resolve(testDirectory, "../src/app.ts"), "utf8");
    const persistenceSource = await readFile(path.resolve(testDirectory, "../src/encounter-persistence.ts"), "utf8");

    assert.match(appSource, /runnerHistory\.push\(runnerSession\.state\)/);
    assert.match(appSource, /function undoRunnerAdvance\(\)/);
    assert.match(appSource, /dataset\.action = "previous-turn"/);
    assert.match(appSource, /dataset\.action = "next-turn"/);
    assert.match(persistenceSource, /\[data-action='next-turn'\]/);
});

test("enemy duplication does not reschedule enhancement for every input or change event", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.resolve(testDirectory, "../src/enemy-duplicate-ui.ts"), "utf8");

    assert.doesNotMatch(source, /root\.addEventListener\(\s*["']input["']/);
    assert.doesNotMatch(source, /root\.addEventListener\(\s*["']change["']/);
});

test("application frontend does not use MutationObserver as a render lifecycle", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const sourceDirectory = path.resolve(testDirectory, "../src");
    const names = await readdir(sourceDirectory);
    const offenders = [];

    for (const name of names.filter(name => name.endsWith(".ts"))) {
        const content = await readFile(path.join(sourceDirectory, name), "utf8");
        if (content.includes("MutationObserver")) offenders.push(name);
    }

    assert.deepEqual(offenders, []);
});

test("combat state integration prefers current dashboard rows by combatant identity", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.resolve(testDirectory, "../src/combatant-quick-stats-ui.ts"), "utf8");

    assert.match(source, /dashboard\.querySelector<HTMLElement>\(selector\)\s*\?\? root\.querySelector<HTMLElement>\(selector\)/);
    assert.match(source, /\.bi-health-row\[data-combatant-id=/);
    assert.match(source, /\.bi-kaiju-panel\[data-combatant-id=/);
    assert.doesNotMatch(source, /unassignedHealthRows|unassignedKaijuPanels/);
});
