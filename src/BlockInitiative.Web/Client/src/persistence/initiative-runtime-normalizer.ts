import type {
    CyclicMergePreview,
    InitiativeBlockPreview,
    InitiativeCombatantInput,
    InitiativeCombatantPreview,
    InitiativeIssuePreview,
    InitiativePreviewRequest,
    InitiativePreviewResponse,
    InitiativeTurnStateRequest,
    InitiativeTurnStateResponse,
    TacticalGroupInitiativeMode,
    TurnAdvancePreview,
    TurnBlockType
} from "../api";
import type {
    CombatantReorderRuntimeSnapshot
} from "../initiative/combatant-reorder-state";
import type {
    InitiativeMode
} from "../initiative/initiative-mode";
import type {
    PreviewDetail,
    StateDetail
} from "./encounter-schema";
import {
    isNullableString,
    normalizeList,
    nullablePositiveInteger,
    nullableString,
    positiveInteger,
    record,
    stringArray
} from "./normalization-primitives";

export function normalizePreviewDetail(
    value: unknown
): PreviewDetail | null {
    if (value === null
        || value === undefined) {
        return null;
    }

    const item = record(value);
    const request =
        normalizePreviewRequest(
            item?.request);
    const response =
        normalizePreviewResponse(
            item?.response);

    return request && response
        ? { request, response }
        : null;
}

export function normalizeStateDetail(
    value: unknown
): StateDetail | null {
    if (value === null
        || value === undefined) {
        return null;
    }

    const item = record(value);
    const request =
        normalizeStateRequest(
            item?.request);
    const response =
        normalizeStateResponse(
            item?.response);

    return request && response
        ? { request, response }
        : null;
}

export function normalizeReorderRuntime(
    value: unknown
): CombatantReorderRuntimeSnapshot {
    const item = record(value);
    const baselineRequest =
        normalizePreviewRequest(
            item?.baselineRequest);
    const baselineOrder =
        stringArray(item?.baselineOrder);
    const history =
        Array.isArray(item?.history)
            ? item.history.flatMap(order => {
                const normalized =
                    stringArray(order);
                return normalized
                    ? [normalized]
                    : [];
            })
            : [];

    return {
        baselineRequest,
        baselineOrder,
        history
    };
}

export function readInitiativeMode(
    value: unknown
): InitiativeMode | null {
    return value === "standard"
        ? "standard"
        : value === "block"
            ? "block"
            : null;
}

export function readGroupMode(
    value: unknown
): TacticalGroupInitiativeMode | null {
    return value === "individual"
        || value === "average"
        || value === "shared"
            ? value
            : null;
}

function normalizePreviewRequest(
    value: unknown
): InitiativePreviewRequest | null {
    const item = record(value);
    if (!item
        || !Array.isArray(item.combatants)) {
        return null;
    }

    const combatants =
        normalizeList(
            item.combatants,
            normalizeInitiativeCombatant);
    if (!combatants) return null;

    const manualOrderOverride =
        item.manualOrderOverride === null
            || item.manualOrderOverride === undefined
            ? null
            : stringArray(
                item.manualOrderOverride);
    if (item.manualOrderOverride !== null
        && item.manualOrderOverride !== undefined
        && manualOrderOverride === null) {
        return null;
    }

    return {
        combatants,
        manualOrderOverride,
        tacticalGroupMode:
            readGroupMode(
                item.tacticalGroupMode)
            ?? "average",
        initiativeMode:
            readInitiativeMode(
                item.initiativeMode)
            ?? "block"
    };
}

function normalizeStateRequest(
    value: unknown
): InitiativeTurnStateRequest | null {
    const base =
        normalizePreviewRequest(value);
    const item = record(value);
    if (!base || !item) return null;

    if (typeof item.advanceCount !== "number"
        || !Number.isInteger(item.advanceCount)
        || item.advanceCount < 0) {
        return null;
    }

    return {
        ...base,
        advanceCount: item.advanceCount,
        resumeRound:
            nullablePositiveInteger(
                item.resumeRound),
        resumeActiveCombatantId:
            nullableString(
                item.resumeActiveCombatantId),
        resumeCyclicMergeCompleted:
            typeof item.resumeCyclicMergeCompleted
                === "boolean"
                ? item.resumeCyclicMergeCompleted
                : false
    };
}

function normalizeInitiativeCombatant(
    value: unknown
): InitiativeCombatantInput | null {
    const item = record(value);
    if (!item
        || typeof item.id !== "string"
        || typeof item.name !== "string"
        || typeof item.allianceId !== "string"
        || typeof item.initiativeTotal !== "number"
        || !Number.isFinite(item.initiativeTotal)) {
        return null;
    }

    const blockType:
        TurnBlockType =
            item.blockType === "kaiju"
                ? "kaiju"
                : item.blockType === "mixed"
                    ? "mixed"
                    : "standard";

    return {
        id: item.id,
        name: item.name,
        allianceId: item.allianceId,
        initiativeTotal:
            item.initiativeTotal,
        initiativeModifier:
            typeof item.initiativeModifier
                === "number"
                && Number.isFinite(
                    item.initiativeModifier)
                ? item.initiativeModifier
                : null,
        controllerId:
            nullableString(item.controllerId),
        tacticalGroupId:
            nullableString(
                item.tacticalGroupId),
        blockType
    };
}

function normalizePreviewResponse(
    value: unknown
): InitiativePreviewResponse | null {
    const item = record(value);
    if (!item
        || !Array.isArray(item.orderedCombatants)
        || !Array.isArray(item.blocks)
        || !Array.isArray(item.issues)
        || typeof item.requiresAdjudication
            !== "boolean"
        || typeof item.usesManualOrderOverride
            !== "boolean") {
        return null;
    }

    const orderedCombatants =
        normalizeList(
            item.orderedCombatants,
            normalizeInitiativeCombatantPreview);
    const blocks =
        normalizeList(
            item.blocks,
            normalizeInitiativeBlockPreview);
    const issues =
        normalizeList(
            item.issues,
            normalizeInitiativeIssue);
    const cyclicMerge =
        normalizeCyclicMerge(
            item.cyclicMerge);

    if (!orderedCombatants
        || !blocks
        || !issues
        || cyclicMerge === undefined) {
        return null;
    }

    return {
        orderedCombatants,
        blocks,
        cyclicMerge,
        issues,
        requiresAdjudication:
            item.requiresAdjudication,
        usesManualOrderOverride:
            item.usesManualOrderOverride
    };
}

function normalizeStateResponse(
    value: unknown
): InitiativeTurnStateResponse | null {
    const item = record(value);
    if (!item
        || typeof item.round !== "number"
        || !Number.isInteger(item.round)
        || item.round < 1
        || !Array.isArray(item.blocks)
        || !isNullableString(
            item.activeBlockId)
        || typeof item.cyclicMergePending
            !== "boolean"
        || typeof item.cyclicMergeCompleted
            !== "boolean"
        || typeof item.lowerCyclicBlockSkippedRoundOne
            !== "boolean") {
        return null;
    }

    const blocks =
        normalizeList(
            item.blocks,
            normalizeInitiativeBlockPreview);
    const lastAdvance =
        normalizeTurnAdvance(
            item.lastAdvance);
    if (!blocks
        || lastAdvance === undefined) {
        return null;
    }

    return {
        round: item.round,
        activeBlockId:
            item.activeBlockId,
        blocks,
        cyclicMergePending:
            item.cyclicMergePending,
        cyclicMergeCompleted:
            item.cyclicMergeCompleted,
        lowerCyclicBlockSkippedRoundOne:
            item.lowerCyclicBlockSkippedRoundOne,
        lastAdvance
    };
}

function normalizeInitiativeCombatantPreview(
    value: unknown
): InitiativeCombatantPreview | null {
    const base =
        normalizeInitiativeCombatant(value);
    const item = record(value);
    if (!base
        || !item
        || typeof item.effectiveInitiative
            !== "number"
        || !Number.isFinite(
            item.effectiveInitiative)) {
        return null;
    }

    return {
        ...base,
        effectiveInitiative:
            item.effectiveInitiative,
        blockType:
            readTurnBlockType(
                item.blockType)
            ?? "standard"
    };
}

function normalizeInitiativeBlockPreview(
    value: unknown
): InitiativeBlockPreview | null {
    const item = record(value);
    if (!item
        || typeof item.id !== "string"
        || typeof item.allianceId !== "string"
        || typeof item.isMerged !== "boolean") {
        return null;
    }

    const memberIds =
        stringArray(item.memberIds);
    const memberOrder =
        stringArray(item.memberOrder);
    const sourceBlockIds =
        stringArray(item.sourceBlockIds);
    const blockType =
        readTurnBlockType(
            item.blockType);

    if (!memberIds
        || !memberOrder
        || !sourceBlockIds
        || !blockType) {
        return null;
    }

    return {
        id: item.id,
        allianceId: item.allianceId,
        blockType,
        memberIds,
        memberOrder,
        sourceBlockIds,
        isMerged: item.isMerged
    };
}

function normalizeInitiativeIssue(
    value: unknown
): InitiativeIssuePreview | null {
    const item = record(value);
    if (!item
        || typeof item.code !== "string"
        || typeof item.message !== "string") {
        return null;
    }

    const combatantIds =
        stringArray(item.combatantIds);
    if (!combatantIds) return null;

    return {
        code: item.code,
        message: item.message,
        combatantIds
    };
}

function normalizeCyclicMerge(
    value: unknown
): CyclicMergePreview | null | undefined {
    if (value === null
        || value === undefined) {
        return null;
    }

    const item = record(value);
    const blockType =
        readTurnBlockType(
            item?.blockType);
    if (!item
        || typeof item.topBlockId !== "string"
        || typeof item.bottomBlockId !== "string"
        || typeof item.allianceId !== "string"
        || !blockType) {
        return undefined;
    }

    return {
        topBlockId: item.topBlockId,
        bottomBlockId: item.bottomBlockId,
        allianceId: item.allianceId,
        blockType
    };
}

function normalizeTurnAdvance(
    value: unknown
): TurnAdvancePreview | null | undefined {
    if (value === null
        || value === undefined) {
        return null;
    }

    const item = record(value);
    if (!item
        || !positiveInteger(
            item.previousRound)
        || !positiveInteger(
            item.currentRound)
        || !isNullableString(
            item.previousBlockId)
        || !isNullableString(
            item.currentBlockId)
        || !isNullableString(
            item.skippedBlockId)
        || typeof item.roundAdvanced
            !== "boolean"
        || typeof item.cyclicMergeCompleted
            !== "boolean") {
        return undefined;
    }

    return {
        previousRound:
            item.previousRound,
        currentRound:
            item.currentRound,
        previousBlockId:
            item.previousBlockId,
        currentBlockId:
            item.currentBlockId,
        roundAdvanced:
            item.roundAdvanced,
        cyclicMergeCompleted:
            item.cyclicMergeCompleted,
        skippedBlockId:
            item.skippedBlockId
    };
}

function readTurnBlockType(
    value: unknown
): TurnBlockType | null {
    return value === "standard"
        || value === "kaiju"
        || value === "mixed"
            ? value
            : null;
}
