import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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
    assert.match(capture, /runnerCard\(root, combatant\.id\)/);
    assert.match(capture, /data-card-state='kaiju'/);
    assert.match(capture, /"current-hp"/);
    assert.match(capture, /"max-hp"/);
    assert.match(capture, /\.bi-condition-chip-wrap/);
    assert.match(capture, /kaijuList[\s\S]*directCards\(kaijuList\)\.map\(captureCombatant\)/);
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

    assert.match(storage, /named-encounters:v1/);
    assert.match(coordinator, /dataset\.action = "save-named-encounter"/);
    assert.match(coordinator, /dataset\.action = "load-named-encounter"/);
    assert.match(coordinator, /dataset\.action = "delete-named-encounter"/);
    assert.match(coordinator, /Named saves are kept/);
    assert.match(storage, /export function readNamedEncounters/);
    assert.match(storage, /export function writeNamedEncounters/);
});
