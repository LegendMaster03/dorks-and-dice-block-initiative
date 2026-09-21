import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(testDirectory, "../src/encounter-persistence.ts");

async function source() {
    return await readFile(sourcePath, "utf8");
}

test("encounter persistence uses durable browser storage and an explicit reset", async () => {
    const text = await source();

    assert.match(text, /localStorage\.setItem\(storageKey/);
    assert.match(text, /localStorage\.getItem\(storageKey/);
    assert.match(text, /localStorage\.removeItem\(storageKey/);
    assert.doesNotMatch(text, /sessionStorage/);
    assert.match(text, /Reset encounter/);
    assert.match(text, /window\.confirm\(/);
    assert.match(text, /window\.location\.reload\(\)/);
});

test("encounter persistence captures progression, health, conditions, and campaign context", async () => {
    const text = await source();

    assert.match(text, /block-initiative:preview/);
    assert.match(text, /block-initiative:state/);
    assert.match(text, /block-initiative:campaign-change/);
    assert.match(text, /block-initiative:rules-core-template-link/);
    assert.match(text, /\.bi-health-row/);
    assert.match(text, /\.bi-kaiju-panel/);
    assert.match(text, /\.bi-condition-chip-wrap/);
    assert.match(text, /data-role='campaign-select'/);
    assert.match(text, /setRuntimeManualOrder/);
});

test("restore replays the saved active turn instead of silently starting over", async () => {
    const text = await source();

    assert.match(text, /sameTurnTarget/);
    assert.match(text, /\[data-action='next-turn'\]/);
    assert.doesNotMatch(text, /find\(button => button\.textContent\?\.trim\(\) === "Next block"\)/);
    assert.match(text, /maxReplayAdvances/);
    assert.match(text, /Saved encounter restored/);
});

test("named encounter saves are separate from automatic recovery", async () => {
    const text = await source();

    assert.match(text, /named-encounters:v1/);
    assert.match(text, /dataset\.action = "save-named-encounter"/);
    assert.match(text, /dataset\.action = "load-named-encounter"/);
    assert.match(text, /dataset\.action = "delete-named-encounter"/);
    assert.match(text, /Named saves are kept/);
    assert.match(text, /readNamedEncounters/);
    assert.match(text, /writeNamedEncounters/);
});
