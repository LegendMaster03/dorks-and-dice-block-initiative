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

test("v1 encounters migrate to complete v3 defaults", () => {
    const migrated =
        normalizeSavedEncounter(
            legacyEncounter());

    assert.ok(migrated);
    assert.equal(migrated.version, 3);
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

test("malformed nested turn-state blocks are not passed to restore", () => {
    const migrated =
        normalizeSavedEncounter(
            legacyEncounter({
                state: {
                    request: {
                        combatants: [],
                        initiativeMode: "block",
                        tacticalGroupMode: "average",
                        manualOrderOverride: null,
                        advanceCount: 0
                    },
                    response: {
                        round: 1,
                        activeBlockId: "bad",
                        blocks: [{ id: "bad" }],
                        cyclicMergePending: false,
                        cyclicMergeCompleted: false,
                        lowerCyclicBlockSkippedRoundOne: false,
                        lastAdvance: null
                    }
                }
            }));

    assert.ok(migrated);
    assert.equal(migrated.state, null);
});



test("v2 acted markers and condition links migrate into v3 state", () => {
    const migrated =
        normalizeSavedEncounter({
            ...legacyEncounter(),
            version: 2,
            actedRounds: {
                "monster-1": 4
            },
            players: [{
                id: "monster-1",
                name: "Aster",
                conditions: [{
                    name: "Exhaustion",
                    note: "legacy",
                    href: "/tools/rules-core/conditions/exhaustion"
                }]
            }]
        });

    assert.ok(migrated);
    assert.deepEqual(
        migrated.actedRounds,
        { "monster-1": [4] });
    assert.equal(
        migrated.players[0].conditions[0].browserHref,
        "/tools/rules-core/conditions/exhaustion");
    assert.equal(
        migrated.players[0].conditions[0].origin,
        "rules-core");
});
