import assert from "node:assert/strict";
import test from "node:test";

import {
    captureCombatantReorderRuntime,
    clearCombatantReorderHistory,
    combatantReorderBaselineOrder,
    combatantReorderHistory,
    popCombatantReorderHistory,
    pushCombatantReorderHistory,
    resetCombatantReorderRuntime,
    restoreCombatantReorderRuntime
} from "../.test-dist/initiative/combatant-reorder-state.js";

const request = {
    combatants: [
        {
            id: "a",
            name: "A",
            allianceId: "players",
            initiativeTotal: 20,
            initiativeModifier: null,
            controllerId: null,
            tacticalGroupId: null,
            blockType: "standard"
        },
        {
            id: "b",
            name: "B",
            allianceId: "enemies",
            initiativeTotal: 10,
            initiativeModifier: null,
            controllerId: null,
            tacticalGroupId: null,
            blockType: "standard"
        }
    ],
    tacticalGroupMode: "average",
    initiativeMode: "block",
    manualOrderOverride: null
};

test("combatant reorder runtime round-trips baseline and history", () => {
    resetCombatantReorderRuntime(
        request,
        ["a", "b"]);
    pushCombatantReorderHistory(
        ["a", "b"]);

    const saved =
        captureCombatantReorderRuntime();

    clearCombatantReorderHistory();
    restoreCombatantReorderRuntime(saved);

    assert.deepEqual(
        combatantReorderBaselineOrder(),
        ["a", "b"]);
    assert.deepEqual(
        combatantReorderHistory(),
        [["a", "b"]]);
    assert.deepEqual(
        popCombatantReorderHistory(),
        ["a", "b"]);
    assert.deepEqual(
        combatantReorderHistory(),
        []);
});
