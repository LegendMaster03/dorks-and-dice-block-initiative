import { postRulesCoreJson } from "./client";

export type DiceSelectionMode =
    | "normal"
    | "advantage"
    | "disadvantage"
    | "emphasis";

export interface RulesCoreDiceOutcome {
    rolls: number[];
    selectedRollIndex: number | null;
    selectedRoll: number | null;
    candidateRollIndices: number[];
    requiresChoice: boolean;
    total: number | null;
}

export interface RulesCoreDiceBatch {
    sides: number;
    selectionMode: DiceSelectionMode;
    modifier: number;
    repeat: number;
    outcomes: RulesCoreDiceOutcome[];
}

export async function rollRulesCoreD20(
    repeat = 1,
    selectionMode: DiceSelectionMode = "normal"
): Promise<RulesCoreDiceBatch> {
    const result = await postRulesCoreJson<
        {
            sides: number;
            selectionMode: DiceSelectionMode;
            modifier: number;
            repeat: number;
        },
        RulesCoreDiceBatch
    >(
        "/api/rules/dice/roll",
        {
            sides: 20,
            selectionMode,
            modifier: 0,
            repeat
        },
        "Rules Core dice roller",
        "The Rules Core dice roller is not available for this session.");

    if (result.sides !== 20
        || result.selectionMode !== selectionMode
        || result.repeat !== repeat
        || !Array.isArray(result.outcomes)
        || result.outcomes.length !== repeat) {
        throw new Error("Rules Core dice roller returned an invalid response.");
    }

    return result;
}
