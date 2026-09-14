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

test("initiative modifier stays in combat quick stats instead of the rolled-initiative header", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const affordancesSource = await readFile(path.resolve(testDirectory, "../src/encounter-card-affordances-ui.ts"), "utf8");
    const quickStatsSource = await readFile(path.resolve(testDirectory, "../src/combatant-quick-stats-ui.ts"), "utf8");

    assert.doesNotMatch(affordancesSource, /bi-card-initiative-modifier/);
    assert.doesNotMatch(affordancesSource, /suppressDuplicateInitiativeFact/);
    assert.match(quickStatsSource, /appendFact\(facts,\s*"Init",\s*initiative/);
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
