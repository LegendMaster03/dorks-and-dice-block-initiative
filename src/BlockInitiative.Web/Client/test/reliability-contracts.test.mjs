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

test("Kaiju evaluation coalesces stale requests and retries URL resolution", async () => {
    const kaiju = await source("../src/combat/kaiju-combat-state.ts");

    assert.match(kaiju, /evaluationRevisions/);
    assert.match(kaiju, /performLatestKaijuEvaluation/);
    assert.match(
        kaiju,
        /currentState !== state[\s\S]*performLatestKaijuEvaluation/);
    assert.match(kaiju, /resolvingEvaluateUrl = null/);
    assert.match(kaiju, /POSITIVE_TRACKER_LIMITS/);
    assert.match(kaiju, /NON_NEGATIVE_TRACKER_LIMITS/);
    assert.doesNotMatch(kaiju, /Math\.trunc\(/);
});

test("failed turn advance re-renders the existing runner state", async () => {
    const runner =
        await source("../src/application/encounter-runner.ts");
    const advance =
        runner.match(
            /private async advance\(\): Promise<void> \{[\s\S]*?\n    \}\n\n    private undoAdvance/)?.[0]
        ?? "";

    assert.match(
        advance,
        /catch \(error\) \{[\s\S]*this\.render\(\);[\s\S]*showError\(error\)/);
});

test("restore failures release persistence and legacy shared saves migrate", async () => {
    const api = await source("../src/api.ts");
    const coordinator =
        await source("../src/encounter-persistence.ts");
    const restore =
        await source("../src/persistence/encounter-restore.ts");

    assert.match(api, /block-initiative:api-error/);
    assert.match(coordinator, /restoreSession\.handleApiFailure/);
    assert.match(restore, /public handleApiFailure/);
    assert.match(restore, /const maxReplayAdvances = 10_000/);
    assert.match(
        restore,
        /mode === "shared"[\s\S]*\? "average"/);
    assert.match(
        restore,
        /migrateLegacySharedRoll[\s\S]*saved\.sharedRoll/);
});

test("complete runtime persistence includes turn markers and Kaiju metadata", async () => {
    const schema =
        await source("../src/persistence/encounter-schema.ts");
    const capture =
        await source("../src/persistence/encounter-capture.ts");
    const restore =
        await source("../src/persistence/encounter-restore.ts");

    assert.match(schema, /actedRounds/);
    assert.match(schema, /defeatedRound/);
    assert.match(capture, /captureActedRounds/);
    assert.match(capture, /readKaijuRuntimeMetadata/);
    assert.match(restore, /restoreActedRounds/);
    assert.match(restore, /restoreKaijuRuntimeMetadata/);
});

test("removed combatants are pruned from module-owned runtime maps", async () => {
    const combat =
        await source("../src/combat-state-ui.ts");
    const conditions =
        await source("../src/conditions/condition-tracking-ui.ts");
    const quickStats =
        await source("../src/combatant-quick-stats-ui.ts");

    assert.match(combat, /pruneStandardCombatStates/);
    assert.match(combat, /pruneKaijuCombatStates/);
    assert.match(conditions, /pruneConditions/);
    assert.match(quickStats, /pruneActedRounds/);
});
