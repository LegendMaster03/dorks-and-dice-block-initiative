import assert from "node:assert/strict";
import test from "node:test";

import {
    normalizeSavedEncounter
} from "../.test-dist/persistence/encounter-migration.js";

function legacyEncounter(overrides = {}) {
    return {
        version: 1,
        savedAt: "2026-09-21T12:00:00.000Z",
        view: "running",
        campaignId: null,
        groupMode: "average",
        players: [],
        enemyGroups: [],
        kaiju: [],
        otherSides: [],
        preview: null,
        state: null,
        runnerCombat: {},
        rulesCoreLinks: [],
        ...overrides
    };
}

test("v1 encounters migrate to complete v2 defaults", () => {
    const migrated =
        normalizeSavedEncounter(
            legacyEncounter());

    assert.ok(migrated);
    assert.equal(migrated.version, 2);
    assert.equal(migrated.initiativeMode, "block");
    assert.deepEqual(
        migrated.runnerCombat,
        { standard: {}, kaiju: {} });
    assert.deepEqual(migrated.actedRounds, {});
    assert.deepEqual(
        migrated.reorderRuntime,
        {
            baselineRequest: null,
            baselineOrder: null,
            history: []
        });
});

test("legacy initiative mode is inferred from saved state", () => {
    const migrated =
        normalizeSavedEncounter(
            legacyEncounter({
                state: {
                    request: {
                        combatants: [],
                        initiativeMode: "standard",
                        tacticalGroupMode: "average",
                        manualOrderOverride: null,
                        advanceCount: 0
                    },
                    response: {
                        round: 1,
                        activeBlockId: null,
                        blocks: [],
                        cyclicMergePending: false,
                        cyclicMergeCompleted: false,
                        lowerCyclicBlockSkippedRoundOne: false,
                        lastAdvance: null
                    }
                }
            }));

    assert.ok(migrated);
    assert.equal(
        migrated.initiativeMode,
        "standard");
});

test("malformed nested combatants reject the save instead of reaching restore", () => {
    const migrated =
        normalizeSavedEncounter(
            legacyEncounter({
                players: [{ name: "Missing ID" }]
            }));

    assert.equal(migrated, null);
});
