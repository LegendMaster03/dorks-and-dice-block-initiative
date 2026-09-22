import assert from "node:assert/strict";
import test from "node:test";

import {
    readAutomaticEncounter,
    readNamedEncounters
} from "../.test-dist/persistence/encounter-storage.js";

const automaticV4 =
    "dorks-and-dice:block-initiative:encounter:v4";
const automaticV3 =
    "dorks-and-dice:block-initiative:encounter:v3";
const namedV4 =
    "dorks-and-dice:block-initiative:named-encounters:v4";
const namedV3 =
    "dorks-and-dice:block-initiative:named-encounters:v3";

class MemoryStorage {
    #values = new Map();

    getItem(key) {
        return this.#values.has(key)
            ? this.#values.get(key)
            : null;
    }

    setItem(key, value) {
        this.#values.set(key, String(value));
    }

    removeItem(key) {
        this.#values.delete(key);
    }
}

function legacyEncounter() {
    return {
        version: 3,
        savedAt: "2026-09-22T12:00:00.000Z",
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
        runnerCombat: {
            standard: {},
            kaiju: {}
        },
        rulesCoreLinks: [],
        actedRounds: {},
        reorderRuntime: {
            baselineRequest: null,
            baselineOrder: null,
            history: []
        }
    };
}

function withStorage(callback) {
    const previousWindow = globalThis.window;
    const localStorage = new MemoryStorage();
    globalThis.window = { localStorage };

    try {
        callback(localStorage);
    } finally {
        if (previousWindow === undefined) {
            delete globalThis.window;
        } else {
            globalThis.window = previousWindow;
        }
    }
}

test("malformed current automatic save falls back to valid legacy storage", () => {
    withStorage(localStorage => {
        localStorage.setItem(automaticV4, "{");
        localStorage.setItem(
            automaticV3,
            JSON.stringify(legacyEncounter()));

        const restored = readAutomaticEncounter();

        assert.ok(restored);
        assert.equal(restored.version, 4);
        assert.equal(
            localStorage.getItem(automaticV3),
            null);
        assert.equal(
            JSON.parse(
                localStorage.getItem(automaticV4)).version,
            4);
    });
});

test("malformed current named storage falls back to valid legacy saves", () => {
    withStorage(localStorage => {
        const encounter = legacyEncounter();
        localStorage.setItem(namedV4, "{");
        localStorage.setItem(
            namedV3,
            JSON.stringify([{
                id: "legacy-1",
                name: "Recovered",
                savedAt: encounter.savedAt,
                encounter
            }]));

        const restored = readNamedEncounters();

        assert.equal(restored.length, 1);
        assert.equal(restored[0].name, "Recovered");
        assert.equal(
            localStorage.getItem(namedV3),
            null);
        assert.equal(
            JSON.parse(
                localStorage.getItem(namedV4))[0]
                .encounter.version,
            4);
    });
});

test("valid empty current named storage does not resurrect legacy saves", () => {
    withStorage(localStorage => {
        const encounter = legacyEncounter();
        localStorage.setItem(namedV4, "[]");
        localStorage.setItem(
            namedV3,
            JSON.stringify([{
                id: "legacy-1",
                name: "Old",
                savedAt: encounter.savedAt,
                encounter
            }]));

        assert.deepEqual(
            readNamedEncounters(),
            []);
        assert.notEqual(
            localStorage.getItem(namedV3),
            null);
    });
});
