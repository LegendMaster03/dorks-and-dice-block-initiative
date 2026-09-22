import assert from "node:assert/strict";
import test from "node:test";

import {
    addCondition,
    conditionLabel,
    conditionsFor,
    pruneConditions,
    updateConditionLevel,
    updateConditionNote
} from "../.test-dist/conditions/condition-model.js";

test("conditions expose structured levels without losing notes", () => {
    addCondition("monster-1", {
        id: "condition-1",
        name: "Exhaustion",
        level: null,
        note: "until long rest",
        browserLink: null,
        browserHref: null,
        origin: "manual"
    });

    updateConditionLevel(
        "monster-1",
        "condition-1",
        2);
    updateConditionNote(
        "monster-1",
        "condition-1",
        "until long rest");

    const [condition] =
        conditionsFor("monster-1");
    assert.equal(condition.level, 2);
    assert.equal(
        conditionLabel(condition),
        "Exhaustion · Level 2 · until long rest");
});

test("condition pruning removes only combatants no longer in the encounter", () => {
    addCondition("monster-2", {
        id: "condition-2",
        name: "Custom state",
        level: 3,
        note: "",
        browserLink: null,
        browserHref: null,
        origin: "manual"
    });

    pruneConditions(
        new Set(["monster-1"]));

    assert.equal(
        conditionsFor("monster-2").length,
        0);
    assert.equal(
        conditionsFor("monster-1").length,
        1);
});
