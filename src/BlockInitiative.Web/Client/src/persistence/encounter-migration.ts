import {
    normalizePreviewDetail,
    normalizeReorderRuntime,
    normalizeStateDetail,
    readGroupMode,
    readInitiativeMode
} from "./initiative-runtime-normalizer.js";
import {
    normalizeActedRounds,
    normalizeEnemyGroups,
    normalizeOtherSides,
    normalizeRulesCoreLinks,
    normalizeRunnerCombat,
    normalizeSavedCombatants
} from "./encounter-roster-normalizer.js";
import type {
    SavedEncounter
} from "./encounter-schema";
import {
    nullableString,
    record
} from "./normalization-primitives.js";

export function normalizeSavedEncounter(
    value: unknown
): SavedEncounter | null {
    const candidate = record(value);
    if (!candidate
        || (candidate.version !== 1
            && candidate.version !== 2)
        || typeof candidate.savedAt !== "string"
        || !isSavedView(candidate.view)
        || !Array.isArray(candidate.players)
        || !Array.isArray(candidate.enemyGroups)
        || !Array.isArray(candidate.kaiju)
        || !Array.isArray(candidate.otherSides)) {
        return null;
    }

    const players =
        normalizeSavedCombatants(
            candidate.players);
    const enemyGroups =
        normalizeEnemyGroups(
            candidate.enemyGroups);
    const kaiju =
        normalizeSavedCombatants(
            candidate.kaiju);
    const otherSides =
        normalizeOtherSides(
            candidate.otherSides);

    if (!players
        || !enemyGroups
        || !kaiju
        || !otherSides) {
        return null;
    }

    const preview =
        normalizePreviewDetail(
            candidate.preview);
    const state =
        normalizeStateDetail(
            candidate.state);
    const initiativeMode =
        readInitiativeMode(
            candidate.initiativeMode)
        ?? state?.request.initiativeMode
        ?? preview?.request.initiativeMode
        ?? "block";

    return {
        version: 2,
        savedAt: candidate.savedAt,
        view: candidate.view,
        campaignId:
            nullableString(
                candidate.campaignId),
        initiativeMode,
        groupMode:
            readGroupMode(
                candidate.groupMode)
            ?? "average",
        players,
        enemyGroups,
        kaiju,
        otherSides,
        preview,
        state,
        runnerCombat:
            normalizeRunnerCombat(
                candidate.runnerCombat),
        rulesCoreLinks:
            normalizeRulesCoreLinks(
                candidate.rulesCoreLinks),
        actedRounds:
            normalizeActedRounds(
                candidate.actedRounds),
        reorderRuntime:
            normalizeReorderRuntime(
                candidate.reorderRuntime)
    };
}

function isSavedView(
    value: unknown
): value is SavedEncounter["view"] {
    return value === "setup"
        || value === "preview"
        || value === "running"
        || value === "editing";
}
