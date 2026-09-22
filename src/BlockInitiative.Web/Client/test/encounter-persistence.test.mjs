import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
    EncounterChangeTracker,
    persistAutomaticEncounterIfChanged
} from "../.test-dist/persistence/encounter-change-tracker.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

async function source(relativePath) {
    return await readFile(
        path.resolve(testDirectory, relativePath),
        "utf8");
}

test("encounter persistence uses durable browser storage and an explicit reset", async () => {
    const coordinator = await source("../src/encounter-persistence.ts");
    const storage = await source("../src/persistence/encounter-storage.ts");

    assert.match(storage, /localStorage\.setItem\(/);
    assert.match(storage, /localStorage\.getItem\(/);
    assert.match(storage, /localStorage\.removeItem\(/);
    assert.doesNotMatch(storage, /sessionStorage/);
    assert.match(coordinator, /Reset encounter/);
    assert.match(coordinator, /window\.confirm\(/);
    assert.match(coordinator, /window\.location\.reload\(\)/);
});

test("encounter snapshot captures progression, health, conditions, campaign context, and Kaiju state", async () => {
    const coordinator = await source("../src/encounter-persistence.ts");
    const capture = await source("../src/persistence/encounter-capture.ts");
    const restore = await source("../src/persistence/encounter-restore.ts");

    assert.match(coordinator, /block-initiative:preview/);
    assert.match(coordinator, /block-initiative:state/);
    assert.match(coordinator, /block-initiative:campaign-change/);
    assert.match(coordinator, /block-initiative:rules-core-template-link/);
    assert.match(capture, /readKaijuRuntimeMetadata/);
    assert.match(capture, /runtime\.chaosCurrent/);
    assert.match(capture, /"current-hp"/);
    assert.match(capture, /"max-hp"/);
    assert.match(capture, /conditionsFor\(combatantId\)/);
    assert.match(capture, /setup-armor-class/);
    assert.match(capture, /setup-touch-armor-class/);
    assert.match(capture, /setup-flat-footed-armor-class/);
    assert.match(capture, /touch-armor-class/);
    assert.match(capture, /flat-footed-armor-class/);
    assert.match(capture, /kaijuList[\s\S]*directCards\(kaijuList\)\.map\(captureCombatant\)/);
    assert.match(restore, /restoreArmorClasses/);
    assert.match(restore, /combatant\.armorClass \?\? ""/);
    assert.match(restore, /combatant\.touchArmorClass \?\? ""/);
    assert.match(restore, /combatant\.flatFootedArmorClass \?\? ""/);
    assert.match(restore, /setup-touch-armor-class/);
    assert.match(restore, /setup-flat-footed-armor-class/);
    assert.match(restore, /data-role='campaign-select'/);
    assert.match(restore, /setRuntimeManualOrder/);
});

test("restore replays the saved active turn instead of silently starting over", async () => {
    const coordinator = await source("../src/encounter-persistence.ts");
    const restore = await source("../src/persistence/encounter-restore.ts");

    assert.match(restore, /sameTurnTarget/);
    assert.match(restore, /next-turn/);
    assert.doesNotMatch(
        restore,
        /find\(button => button\.textContent\?\.trim\(\) === "Next block"\)/);
    assert.match(restore, /maxReplayAdvances/);
    assert.match(coordinator, /Saved encounter restored/);
});

test("named encounter saves are separate from automatic recovery", async () => {
    const coordinator = await source("../src/encounter-persistence.ts");
    const storage = await source("../src/persistence/encounter-storage.ts");

    assert.match(storage, /named-encounters:v4/);
    assert.match(storage, /named-encounters:v3/);
    assert.match(storage, /named-encounters:v2/);
    assert.match(storage, /named-encounters:v1/);
    assert.match(coordinator, /dataset\.action = "save-named-encounter"/);
    assert.match(coordinator, /dataset\.action = "load-named-encounter"/);
    assert.match(coordinator, /dataset\.action = "delete-named-encounter"/);
    assert.match(coordinator, /Named saves are kept/);
    assert.match(storage, /export function readNamedEncounters/);
    assert.match(storage, /export function writeNamedEncounters/);
});


function persistenceSnapshot(overrides = {}) {
    return {
        version: 4,
        savedAt: "2026-09-21T12:00:00.000Z",
        view: "setup",
        campaignId: null,
        initiativeMode: "block",
        groupMode: "average",
        players: [],
        enemyGroups: [],
        kaiju: [],
        otherSides: [],
        preview: null,
        state: null,
        runnerCombat: { standard: {}, kaiju: {} },
        rulesCoreLinks: [],
        actedRounds: {},
        reorderRuntime: {
            baselineRequest: null,
            baselineOrder: null,
            history: []
        },
        ...overrides
    };
}

test("passive initial page capture does not create automatic encounter state", () => {
    const initial = persistenceSnapshot();
    const tracker = new EncounterChangeTracker(initial);
    const writes = [];

    const result = persistAutomaticEncounterIfChanged(
        { ...initial, savedAt: "2026-09-21T12:01:00.000Z" },
        tracker,
        snapshot => {
            writes.push(snapshot);
            return true;
        });

    assert.equal(result, "unchanged");
    assert.equal(writes.length, 0);
});

test("restoration does not rewrite an unchanged saved encounter", () => {
    const restored = persistenceSnapshot({
        view: "running",
        players: [{ id: "player-1", name: "Aster" }]
    });
    const tracker = new EncounterChangeTracker(restored);
    let writeCount = 0;

    const result = persistAutomaticEncounterIfChanged(
        { ...restored, savedAt: "2026-09-21T12:02:00.000Z" },
        tracker,
        () => {
            writeCount += 1;
            return true;
        });

    assert.equal(result, "unchanged");
    assert.equal(writeCount, 0);
});

test("real encounter mutation saves once and only then signals a saved result", () => {
    const initial = persistenceSnapshot();
    const tracker = new EncounterChangeTracker(initial);
    const writes = [];
    const changed = persistenceSnapshot({
        savedAt: "2026-09-21T12:03:00.000Z",
        players: [{ id: "player-1", name: "Aster" }]
    });

    const firstResult = persistAutomaticEncounterIfChanged(
        changed,
        tracker,
        snapshot => {
            writes.push(snapshot);
            return true;
        });
    const repeatedResult = persistAutomaticEncounterIfChanged(
        { ...changed, savedAt: "2026-09-21T12:04:00.000Z" },
        tracker,
        snapshot => {
            writes.push(snapshot);
            return true;
        });

    assert.equal(firstResult, "saved");
    assert.equal(repeatedResult, "unchanged");
    assert.equal(writes.length, 1);
});

test("restore completion keeps its restoration message until a real mutation", async () => {
    const coordinator = await source("../src/encounter-persistence.ts");
    const completion = coordinator.match(
        /onComplete: \(\) => \{[\s\S]*?\n        \},\n        onFailure:/)?.[0] ?? "";

    assert.match(completion, /Saved encounter restored/);
    assert.doesNotMatch(completion, /scheduleSave/);
    assert.match(coordinator, /if \(result === "unchanged"\) return;/);
    assert.match(coordinator, /if \(result === "saved"\)/);
});
