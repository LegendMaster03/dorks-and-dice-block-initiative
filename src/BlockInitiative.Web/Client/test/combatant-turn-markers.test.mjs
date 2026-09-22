import assert from "node:assert/strict";
import test from "node:test";

import {
    captureActedRounds,
    clearActedRounds,
    isCombatantActed,
    pruneActedRounds,
    restoreActedRounds,
    setCombatantActed
} from "../.test-dist/combatant-turn-markers.js";

test("acted markers round-trip through persistence", () => {
    clearActedRounds();
    setCombatantActed("a", 3, true);
    setCombatantActed("a", 4, true);
    setCombatantActed("b", 4, true);

    const saved = captureActedRounds();
    clearActedRounds();
    assert.equal(isCombatantActed("a", 3), false);

    restoreActedRounds(saved);
    assert.equal(isCombatantActed("a", 3), true);
    assert.equal(isCombatantActed("a", 4), true);
    assert.equal(isCombatantActed("b", 4), true);
});

test("acted markers reject invalid restored rounds and prune removed combatants", () => {
    clearActedRounds();
    restoreActedRounds({
        keep: [2, 3],
        removed: [5],
        zero: [0],
        fractional: [1.5]
    });

    assert.equal(isCombatantActed("zero", 0), false);
    assert.equal(isCombatantActed("fractional", 1.5), false);

    setCombatantActed("keep", 3, false);
    assert.equal(isCombatantActed("keep", 2), true);
    assert.equal(isCombatantActed("keep", 3), false);

    pruneActedRounds(new Set(["keep"]));
    assert.deepEqual(
        captureActedRounds(),
        { keep: [2] });
});
