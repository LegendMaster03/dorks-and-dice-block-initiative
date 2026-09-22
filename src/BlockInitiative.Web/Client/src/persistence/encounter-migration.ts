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
    SavedCombatant,
    SavedCondition,
    SavedControl,
    SavedEncounter,
    SavedEnemyGroup,
    SavedKaijuRuntime,
    SavedOtherBlock,
    SavedOtherSide,
    SavedRunnerCombat,
    SavedRulesCoreLink,
    StateDetail
} from "./encounter-schema";

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
        normalizeList(candidate.players, normalizeCombatant);
    const enemyGroups =
        normalizeList(
            candidate.enemyGroups,
            normalizeEnemyGroup);
    const kaiju =
        normalizeList(candidate.kaiju, normalizeCombatant);
    const otherSides =
        normalizeList(
            candidate.otherSides,
            normalizeOtherSide);
    if (!players || !enemyGroups || !kaiju || !otherSides) {
        return null;
    }

    const preview =
        normalizePreviewDetail(candidate.preview);
    const state =
        normalizeStateDetail(candidate.state);
    const inferredMode =
        readInitiativeMode(candidate.initiativeMode)
        ?? state?.request.initiativeMode
        ?? preview?.request.initiativeMode
        ?? "block";

    return {
        version: 2,
        savedAt: candidate.savedAt,
        view: candidate.view,
        campaignId:
            nullableString(candidate.campaignId),
        initiativeMode: inferredMode,
        groupMode:
            readGroupMode(candidate.groupMode)
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

function normalizeCombatant(
    value: unknown
): SavedCombatant | null {
    const item = record(value);
    if (!item
        || typeof item.id !== "string"
        || !item.id.trim()
        || typeof item.name !== "string") {
        return null;
    }

    return {
        id: item.id,
        name: item.name,
        initiative: stringOrEmpty(item.initiative),
        modifier: stringOrEmpty(item.modifier),
        armorClass: stringOrEmpty(item.armorClass),
        touchArmorClass:
            stringOrEmpty(item.touchArmorClass),
        flatFootedArmorClass:
            stringOrEmpty(item.flatFootedArmorClass),
        blockType:
            item.blockType === "kaiju"
                ? "kaiju"
                : "standard",
        controllerId:
            stringOrEmpty(item.controllerId),
        rulesReference:
            stringOrEmpty(item.rulesReference),
        campaignCharacterId:
            nullableString(item.campaignCharacterId),
        campaignId:
            nullableString(item.campaignId),
        templateId:
            nullableString(item.templateId),
        instanceNumber:
            nullableString(item.instanceNumber),
        autoName:
            nullableString(item.autoName),
        monsterMetaText:
            stringOrEmpty(item.monsterMetaText),
        setupAreaCount:
            nonNegativeInteger(
                item.setupAreaCount),
        setupControls:
            normalizeListOrEmpty(
                item.setupControls,
                normalizeControl),
        conditions:
            normalizeListOrEmpty(
                item.conditions,
                normalizeCondition)
    };
}

function normalizeControl(
    value: unknown
): SavedControl | null {
    const item = record(value);
    if (!item
        || typeof item.key !== "string"
        || typeof item.value !== "string") {
        return null;
    }

    return {
        key: item.key,
        value: item.value,
        checked:
            typeof item.checked === "boolean"
                ? item.checked
                : null
    };
}

function normalizeCondition(
    value: unknown
): SavedCondition | null {
    const item = record(value);
    if (!item
        || typeof item.name !== "string") {
        return null;
    }

    return {
        name: item.name,
        note: stringOrEmpty(item.note),
        href: nullableString(item.href)
    };
}

function normalizeEnemyGroup(
    value: unknown
): SavedEnemyGroup | null {
    const item = record(value);
    if (!item
        || typeof item.groupId !== "string"
        || typeof item.name !== "string"
        || !Array.isArray(item.members)) {
        return null;
    }

    const members =
        normalizeList(
            item.members,
            normalizeCombatant);
    if (!members) return null;

    return {
        groupId: item.groupId,
        name: item.name,
        sharedRoll:
            stringOrEmpty(item.sharedRoll),
        members
    };
}

function normalizeOtherSide(
    value: unknown
): SavedOtherSide | null {
    const item = record(value);
    if (!item
        || typeof item.sideKey !== "string"
        || typeof item.name !== "string"
        || !Array.isArray(item.blocks)) {
        return null;
    }

    const blocks =
        normalizeList(
            item.blocks,
            normalizeOtherBlock);
    if (!blocks) return null;

    return {
        sideKey: item.sideKey,
        name: item.name,
        blocks
    };
}

function normalizeOtherBlock(
    value: unknown
): SavedOtherBlock | null {
    const item = record(value);
    if (!item
        || typeof item.groupId !== "string"
        || typeof item.name !== "string"
        || !Array.isArray(item.members)) {
        return null;
    }

    const members =
        normalizeList(
            item.members,
            normalizeCombatant);
    if (!members) return null;

    return {
        groupId: item.groupId,
        name: item.name,
        blockType:
            item.blockType === "kaiju"
                ? "kaiju"
                : "standard",
        members
    };
}

function normalizeRunnerCombat(
    value: unknown
): SavedRunnerCombat {
    const runtime = record(value);
    return {
        standard:
            normalizeStandardRuntimeMap(
                runtime?.standard),
        kaiju:
            normalizeKaijuRuntimeMap(
                runtime?.kaiju)
    };
}

function normalizeStandardRuntimeMap(
    value: unknown
): SavedRunnerCombat["standard"] {
    const source = record(value);
    if (!source) return {};

    const result:
        SavedRunnerCombat["standard"] = {};
    for (const [id, raw] of Object.entries(source)) {
        const item = record(raw);
        if (!item) continue;
        result[id] = {
            currentHp:
                stringOrEmpty(item.currentHp),
            maxHp:
                stringOrEmpty(item.maxHp)
        };
    }
    return result;
}

function normalizeKaijuRuntimeMap(
    value: unknown
): SavedRunnerCombat["kaiju"] {
    const source = record(value);
    if (!source) return {};

    const result:
        SavedRunnerCombat["kaiju"] = {};
    for (const [id, raw] of Object.entries(source)) {
        const item = record(raw);
        if (!item) continue;

        const areas =
            normalizeKaijuAreas(item.areas);
        result[id] = {
            chaosCurrent:
                stringOrEmpty(item.chaosCurrent),
            chaosMax:
                stringOrEmpty(item.chaosMax),
            behaviourPhase:
                stringOrEmpty(item.behaviourPhase),
            finishingTarget:
                stringOrEmpty(item.finishingTarget),
            finishingDamageThisTurn:
                stringOrEmpty(
                    item.finishingDamageThisTurn),
            defeatedRound:
                nullablePositiveInteger(
                    item.defeatedRound),
            areas
        } satisfies SavedKaijuRuntime;
    }
    return result;
}

function normalizeKaijuAreas(
    value: unknown
): SavedKaijuRuntime["areas"] {
    if (!Array.isArray(value)) return [];

    return value.flatMap(raw => {
        const item = record(raw);
        if (!item) return [];
        return [{
            name:
                typeof item.name === "string"
                    ? item.name
                    : "Vulnerable Area",
            currentHp:
                stringOrEmpty(item.currentHp),
            maxHp:
                stringOrEmpty(item.maxHp),
            targetable:
                item.targetable !== false
        }];
    });
}

function normalizeRulesCoreLinks(
    value: unknown
): SavedRulesCoreLink[] {
    if (!Array.isArray(value)) return [];

    return value.flatMap(raw => {
        const item = record(raw);
        if (!item
            || typeof item.templateId !== "string"
            || !item.templateId.trim()) {
            return [];
        }

        return [{
            ...item,
            templateId: item.templateId.trim()
        } as SavedRulesCoreLink];
    });
}

function normalizeActedRounds(
    value: unknown
): Record<string, number> {
    const source = record(value);
    if (!source) return {};

    const result: Record<string, number> = {};
    for (const [id, round] of Object.entries(source)) {
        if (Number.isInteger(round)
            && (round as number) >= 1) {
            result[id] = round as number;
        }
    }
    return result;
}

function normalizeReorderRuntime(
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

function normalizePreviewDetail(
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

function normalizeStateDetail(
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

function normalizePreviewRequest(
    value: unknown
): InitiativePreviewRequest | null {
    const item = record(value);
    if (!item || !Array.isArray(item.combatants)) {
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

    const advanceCount = item.advanceCount;

    return {
        ...base,
        advanceCount,
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
        || typeof item.requiresAdjudication !== "boolean"
        || typeof item.usesManualOrderOverride !== "boolean") {
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
        || !isNullableString(item.activeBlockId)
        || typeof item.cyclicMergePending !== "boolean"
        || typeof item.cyclicMergeCompleted !== "boolean"
        || typeof item.lowerCyclicBlockSkippedRoundOne !== "boolean") {
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
        || typeof item.effectiveInitiative !== "number"
        || !Number.isFinite(item.effectiveInitiative)) {
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
        || !positiveInteger(item.previousRound)
        || !positiveInteger(item.currentRound)
        || !isNullableString(item.previousBlockId)
        || !isNullableString(item.currentBlockId)
        || !isNullableString(item.skippedBlockId)
        || typeof item.roundAdvanced !== "boolean"
        || typeof item.cyclicMergeCompleted !== "boolean") {
        return undefined;
    }

    return {
        previousRound: item.previousRound,
        currentRound: item.currentRound,
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


function readInitiativeMode(
    value: unknown
): InitiativeMode | null {
    return value === "standard"
        ? "standard"
        : value === "block"
            ? "block"
            : null;
}

function readGroupMode(
    value: unknown
): TacticalGroupInitiativeMode | null {
    return value === "individual"
        || value === "average"
        || value === "shared"
            ? value
            : null;
}

function isSavedView(
    value: unknown
): value is SavedEncounter["view"] {
    return value === "setup"
        || value === "preview"
        || value === "running"
        || value === "editing";
}

function normalizeList<T>(
    value: unknown[],
    normalize: (item: unknown) => T | null
): T[] | null {
    const result: T[] = [];
    for (const item of value) {
        const normalized = normalize(item);
        if (!normalized) return null;
        result.push(normalized);
    }
    return result;
}

function normalizeListOrEmpty<T>(
    value: unknown,
    normalize: (item: unknown) => T | null
): T[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap(item => {
        const normalized = normalize(item);
        return normalized ? [normalized] : [];
    });
}

function stringArray(
    value: unknown
): string[] | null {
    if (!Array.isArray(value)
        || value.some(
            item => typeof item !== "string")) {
        return null;
    }
    return [...value] as string[];
}

function record(
    value: unknown
): Record<string, unknown> | null {
    return typeof value === "object"
        && value !== null
        && !Array.isArray(value)
            ? value as Record<string, unknown>
            : null;
}

function stringOrEmpty(
    value: unknown
): string {
    return typeof value === "string"
        ? value
        : "";
}

function nullableString(
    value: unknown
): string | null {
    return typeof value === "string"
        ? value
        : null;
}

function isNullableString(
    value: unknown
): value is string | null {
    return value === null
        || typeof value === "string";
}

function positiveInteger(
    value: unknown
): value is number {
    return typeof value === "number"
        && Number.isInteger(value)
        && value >= 1;
}

function nonNegativeInteger(
    value: unknown
): number {
    return typeof value === "number"
        && Number.isInteger(value)
        && value >= 0
            ? value
            : 0;
}

function nullablePositiveInteger(
    value: unknown
): number | null {
    return typeof value === "number"
        && Number.isInteger(value)
        && value >= 1
            ? value
            : null;
}
