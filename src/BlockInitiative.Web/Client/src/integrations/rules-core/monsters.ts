import { projectMonsterCombatStats } from "../../roster/monster-combat-stats";
import type { MonsterCombatStats } from "../../roster/monster-combat-stats";
import { getRulesCoreJson, searchRulesCoreEntity } from "./client";
import type { RuleBrowserLink, RulesCoreSearchMatch } from "./client";

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

interface ResolvedRuleDetail {
    conceptKey?: string;
    displayName?: string;
    sourceEntityId?: string;
    sourceCode?: string;
    packageDisplayName?: string;
    editionDisplayName?: string;
    document?: unknown;
    browserLink?: RuleBrowserLink | null;
}

export async function searchRulesCoreMonsters(
    query: string,
    limit = 8
): Promise<MonsterSearchMatch[]> {
    return await searchRulesCoreEntity(
        "monster",
        query,
        limit,
        "Rules Core monster lookup is not available right now. "
            + "You can keep using a manual monster name.");
}

export async function loadMonsterTemplate(
    match: MonsterSearchMatch
): Promise<MonsterTemplate> {
    if (!match.conceptKey) {
        throw new Error("Rules Core returned a monster without a resolved concept identity.");
    }

    const detail = await getRulesCoreJson<ResolvedRuleDetail>(
        `/api/rules/${encodeURIComponent(match.conceptKey)}`,
        "Rules Core monster details",
        "Rules Core monster lookup requires access to the effective Rules Core ruling.");
    const template = templateFromDocument(
        match,
        typeof detail.displayName === "string" && detail.displayName.trim()
            ? detail.displayName
            : match.displayName,
        isRecord(detail.document) ? detail.document : {},
        detail.editionDisplayName ?? match.editionDisplayName,
        detail.browserLink ?? match.browserLink ?? null);

    announceTemplateLink(template);
    return template;
}

function templateFromDocument(
    match: MonsterSearchMatch,
    fallbackName: string,
    document: Record<string, unknown>,
    editionDisplayName: string,
    browserLink: RuleBrowserLink | null
): MonsterTemplate {
    const name = typeof document.name === "string" && document.name.trim()
        ? document.name.trim()
        : fallbackName;
    const combatStats = projectMonsterCombatStats(document, editionDisplayName);

    return {
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
        browserLink
    };
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
