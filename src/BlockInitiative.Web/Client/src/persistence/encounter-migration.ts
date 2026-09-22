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
    SavedEncounter,
    SavedRunnerCombat,
    StateDetail
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
            && candidate.version !== 2
            && candidate.version !== 3
            && candidate.version !== 4)
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
    const runnerCombat =
        normalizeRunnerCombat(
            candidate.runnerCombat);
    migrateLegacyFinishingDamage(
        runnerCombat,
        state);

    const initiativeMode =
        readInitiativeMode(
            candidate.initiativeMode)
        ?? state?.request.initiativeMode
        ?? preview?.request.initiativeMode
        ?? "block";

    return {
        version: 4,
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
        runnerCombat,
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


function migrateLegacyFinishingDamage(
    runnerCombat: SavedRunnerCombat,
    state: StateDetail | null
): void {
    if (!state?.response.activeBlockId) return;

    const active =
        state.response.blocks.find(
            block =>
                block.id
                === state.response.activeBlockId);
    const anchor =
        active?.memberOrder[0];
    if (!anchor) return;

    const key =
        `${state.response.round}:${anchor}`;

    for (const runtime
        of Object.values(runnerCombat.kaiju)) {
        if (Object.keys(
            runtime.finishingDamageByTurn).length > 0) {
            continue;
        }

        const raw =
            runtime.finishingDamageThisTurn.trim();
        if (!raw) continue;

        const damage = Number(raw);
        if (!Number.isInteger(damage)
            || damage < 0) {
            continue;
        }

        runtime.finishingDamageByTurn[key] =
            damage;
    }
}
