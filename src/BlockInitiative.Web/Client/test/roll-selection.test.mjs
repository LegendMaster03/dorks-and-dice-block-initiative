import assert from "node:assert/strict";
import test from "node:test";

import {
    formatD20Selection,
    normalizeD20RollMode,
    rollD20,
    selectD20Roll
} from "../.test-dist/dice/roll-selection.js";

test("advantage selects the higher d20", () => {
    assert.deepEqual(selectD20Roll("advantage", 7, 16), {
        mode: "advantage",
        rolls: [7, 16],
        selectedIndex: 1,
        selected: 16,
        tied: false
    });
});

test("disadvantage selects the lower d20", () => {
    assert.equal(selectD20Roll("disadvantage", 7, 16).selected, 7);
});

test("emphasis selects the d20 furthest from ten", () => {
    assert.equal(selectD20Roll("emphasis", 4, 13).selected, 4);
    assert.equal(selectD20Roll("emphasis", 19, 2).selected, 19);
});

test("emphasis preserves an equal-distance tie explicitly", () => {
    const result = selectD20Roll("emphasis", 7, 13);
    assert.equal(result.selected, 7);
    assert.equal(result.tied, true);
    assert.match(formatD20Selection(result), /equal selection distance/);
});

test("normal rolls once while special modes roll twice", () => {
    const normalValues = [12];
    const normal = rollD20("normal", () => normalValues.shift());
    assert.deepEqual(normal.rolls, [12]);

    const advantageValues = [3, 18];
    const advantage = rollD20("advantage", () => advantageValues.shift());
    assert.deepEqual(advantage.rolls, [3, 18]);
    assert.equal(advantage.selected, 18);
});

test("unknown manual mode input safely falls back to normal", () => {
    assert.equal(normalizeD20RollMode("EMPHASIS"), "emphasis");
    assert.equal(normalizeD20RollMode("unexpected"), "normal");
});
