import type {
    SavedCombatant,
    SavedCondition,
    SavedControl,
    SavedEnemyGroup,
    SavedKaijuRuntime,
    SavedOtherBlock,
    SavedOtherSide,
    SavedRunnerCombat,
    SavedRulesCoreLink
} from "./encounter-schema";
import {
    nonNegativeInteger,
    normalizeList,
    normalizeListOrEmpty,
    nullablePositiveInteger,
    nullableString,
    record,
    stringOrEmpty
} from "./normalization-primitives.js";

export function normalizeSavedCombatants(
    value: unknown[]
): SavedCombatant[] | null {
    return normalizeList(
        value,
        normalizeCombatant);
}

export function normalizeEnemyGroups(
    value: unknown[]
): SavedEnemyGroup[] | null {
    return normalizeList(
        value,
        normalizeEnemyGroup);
}

export function normalizeOtherSides(
    value: unknown[]
): SavedOtherSide[] | null {
    return normalizeList(
        value,
        normalizeOtherSide);
}

export function normalizeRunnerCombat(
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

export function normalizeRulesCoreLinks(
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

export function normalizeActedRounds(
    value: unknown
): Record<string, number[]> {
    const source = record(value);
    if (!source) return {};

    const result: Record<string, number[]> = {};
    for (const [id, raw] of Object.entries(source)) {
        const candidates =
            Array.isArray(raw)
                ? raw
                : [raw];
        const rounds =
            [...new Set(
                candidates.filter(
                    (round): round is number =>
                        typeof round === "number"
                        && Number.isInteger(round)
                        && round >= 1))]
                .sort(
                    (left, right) => left - right);
        if (rounds.length > 0) {
            result[id] = rounds;
        }
    }
    return result;
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
            nullableString(
                item.campaignCharacterId),
        campaignId:
            nullableString(item.campaignId),
        templateId:
            nullableString(item.templateId),
        instanceNumber:
            nullableString(item.instanceNumber),
        autoName:
            nullableString(item.autoName),
        manualDuplicateKey:
            nullableString(
                item.manualDuplicateKey),
        manualDuplicateBase:
            nullableString(
                item.manualDuplicateBase),
        manualDuplicateIndex:
            nullableString(
                item.manualDuplicateIndex),
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

    const browserLink =
        normalizeBrowserLink(
            item.browserLink);

    return {
        id:
            typeof item.id === "string"
            && item.id.trim()
                ? item.id
                : crypto.randomUUID(),
        name: item.name,
        level:
            nullablePositiveInteger(
                item.level),
        note: stringOrEmpty(item.note),
        browserLink,
        browserHref:
            nullableString(
                item.browserHref)
            ?? nullableString(item.href),
        origin:
            item.origin === "rules-core"
            || item.origin === "source"
            || item.origin === "manual"
                ? item.origin
                : nullableString(item.href)
                    ? "rules-core"
                    : "manual"
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
        normalizeSavedCombatants(
            item.members);
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
        normalizeSavedCombatants(
            item.members);
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
            finishingDamageByTurn:
                normalizeTurnDamageMap(
                    item.finishingDamageByTurn),
            defeatedRound:
                nullablePositiveInteger(
                    item.defeatedRound),
            areas:
                normalizeKaijuAreas(
                    item.areas)
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


function normalizeBrowserLink(
    value: unknown
): import("../integrations/rules-core/client").RuleBrowserLink | null {
    const item = record(value);
    if (!item
        || typeof item.toolSlug !== "string"
        || typeof item.toolRelativePath !== "string"
        || typeof item.routeIdentity !== "string") {
        return null;
    }

    return {
        toolSlug: item.toolSlug,
        toolRelativePath: item.toolRelativePath,
        routeIdentity: item.routeIdentity
    };
}

function normalizeTurnDamageMap(
    value: unknown
): Record<string, number> {
    const source = record(value);
    if (!source) return {};

    const result: Record<string, number> = {};
    for (const [key, raw] of Object.entries(source)) {
        if (typeof raw === "number"
            && Number.isInteger(raw)
            && raw >= 0) {
            result[key] = raw;
        }
    }
    return result;
}
