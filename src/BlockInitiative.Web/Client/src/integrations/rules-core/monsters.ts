import { projectMonsterCombatStats } from "../../roster/monster-combat-stats.js";
import type { MonsterCombatStats } from "../../roster/monster-combat-stats.js";
import { getRulesCoreJson, nativeRulesetId, searchRulesCoreEntity } from "./client.js";
import type { RuleBrowserLink, RulesCoreSearchMatch } from "./client.js";

export type MonsterSearchMatch = RulesCoreSearchMatch;

export interface MonsterTemplate {
    match: MonsterSearchMatch;
    name: string;
    maxHp: number | null;
    initiativeModifier: number | null;
    armorClass: string | null;
    touchArmorClass: string | null;
    flatFootedArmorClass: string | null;
    challengeRating: string | null;
    combatStats: MonsterCombatStats;
    document: Record<string, unknown>;
    browserLink: RuleBrowserLink | null;
}

interface NativeMonsterDetail {
    rulesetId: string;
    rule: {
        id: string;
        name: string;
        kind: string;
        definition: unknown;
    };
}

export async function searchRulesCoreMonsters(
    query: string,
    limit = 8
): Promise<MonsterSearchMatch[]> {
    return searchRulesCoreEntity(["monster"], query, limit);
}

export async function loadMonsterTemplate(
    match: MonsterSearchMatch
): Promise<MonsterTemplate> {
    if (match.rulesetId !== nativeRulesetId || match.category !== "monster"
        || !/^monster\.[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(match.ruleId)) {
        throw new Error("Rules Core returned an invalid native monster identity.");
    }

    const detail = await getRulesCoreJson<NativeMonsterDetail>(
        `/api/rulesets/${encodeURIComponent(match.rulesetId)}/rules/${encodeURIComponent(match.ruleId)}`,
        "Rules Core monster details");
    if (detail?.rulesetId !== match.rulesetId
        || detail.rule?.id !== match.ruleId
        || detail.rule?.kind !== "monster"
        || !isRecord(detail.rule.definition)) {
        throw new Error("Rules Core returned a mismatched native monster definition.");
    }

    // Native records contain metadata at the root and a mechanical definition below it.
    const native = detail.rule.definition;
    if (native.id !== match.ruleId || native.kind !== "monster"
        || !isRecord(native.definition)) {
        throw new Error("Rules Core returned an invalid native monster stat block.");
    }

    const document = native.definition;
    const combatStats = projectMonsterCombatStats(document);
    const name = detail.rule.name?.trim() || match.displayName;
    const template: MonsterTemplate = {
        match,
        name,
        maxHp: combatStats.maxHp,
        initiativeModifier: combatStats.initiativeModifier,
        armorClass: combatStats.armorClass,
        touchArmorClass: combatStats.touchArmorClass,
        flatFootedArmorClass: combatStats.flatFootedArmorClass,
        challengeRating: readChallengeRating(document.cr),
        combatStats,
        document,
        browserLink: null
    };
    announceTemplateLink(template);
    return template;
}

function announceTemplateLink(template: MonsterTemplate): void {
    window.dispatchEvent(new CustomEvent("block-initiative:rules-core-template-link", {
        detail: {
            templateId: template.match.id,
            browserLink: template.browserLink,
            combatStats: template.combatStats
        }
    }));
}

function readChallengeRating(value: unknown): string | null {
    if (typeof value === "number" || typeof value === "string") return String(value);
    if (!isRecord(value)) return null;
    const cr = value.cr;
    return typeof cr === "number" || typeof cr === "string" ? String(cr) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
