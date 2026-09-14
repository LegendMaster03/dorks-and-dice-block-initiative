import assert from "node:assert/strict";
import test from "node:test";

import {
    moveCombatant,
    moveCombatantByOffset,
    sameMembers,
    sameOrder
} from "../.test-dist/combatant-reorder.js";

test("moves a combatant before or after another combatant without losing members", () => {
    const order = ["p1", "p2", "e1", "e2"];

    assert.deepEqual(moveCombatant(order, "e2", "p1", "before"), ["e2", "p1", "p2", "e1"]);
    assert.deepEqual(moveCombatant(order, "p1", "e1", "after"), ["p2", "e1", "p1", "e2"]);
    assert.deepEqual(order, ["p1", "p2", "e1", "e2"]);
});

test("keyboard offset movement crosses initiative block boundaries one position at a time", () => {
    const order = ["p1", "p2", "e1", "e2"];

    assert.deepEqual(moveCombatantByOffset(order, "e1", -1), ["p1", "e1", "p2", "e2"]);
    assert.deepEqual(moveCombatantByOffset(order, "p2", 1), ["p1", "e1", "p2", "e2"]);
    assert.deepEqual(moveCombatantByOffset(order, "p1", -1), order);
    assert.deepEqual(moveCombatantByOffset(order, "e2", 1), order);
});

test("order comparisons distinguish sequence from membership", () => {
    const original = ["a", "b", "c"];
    const reordered = ["c", "a", "b"];

    assert.equal(sameMembers(original, reordered), true);
    assert.equal(sameOrder(original, reordered), false);
    assert.equal(sameOrder(original, ["a", "b", "c"]), true);
    assert.equal(sameMembers(original, ["a", "b", "d"]), false);
});

test("rejects malformed orders with duplicate members", () => {
    assert.throws(
        () => moveCombatant(["a", "a", "b"], "a", "b", "after"),
        /duplicate combatants/i);
});
