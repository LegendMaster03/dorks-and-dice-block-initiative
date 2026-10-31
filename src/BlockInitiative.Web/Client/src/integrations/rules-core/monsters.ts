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
    fingerprint: string;
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

/**
 * One validated native monster detail reader for new selections and saved
 * encounter rehydration. No legacy source or resolved-rule fallback.
 */
async function readNativeMonsterDocument(
    match: MonsterSearchMatch
): Promise<{ name: string; document: Record<string, unknown> }> {
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
    if (match.fingerprint !== null && detail.fingerprint !== match.fingerprint) {
        throw new Error("Rules Core changed since this monster was selected. Search again.");
    }
    if (!/^[a-f0-9]{64}$/i.test(detail.fingerprint ?? "")) {
        throw new Error("Rules Core returned an invalid catalog fingerprint.");
    }

    const native = detail.rule.definition;
    if (native.id !== match.ruleId || native.kind !== "monster"
        || !isRecord(native.definition)) {
        throw new Error("Rules Core returned an invalid native monster stat block.");
    }
    return {
        name: typeof detail.rule.name === "string" && detail.rule.name.trim()
            ? detail.rule.name.trim() : match.displayName,
        document: native.definition
    };
}

export async function loadMonsterTemplate(
    match: MonsterSearchMatch
): Promise<MonsterTemplate> {
    const { name, document } = await readNativeMonsterDocument(match);
    const combatStats = projectMonsterCombatStats(document);
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

/** Rehydrate current native references without touching historical rule: or source: IDs. */
export async function loadNativeMonsterCombatStats(
    templateId: string
): Promise<MonsterCombatStats | null> {
    const parsed = /^native:(first-party-001):(monster\.[a-z0-9-]+(?:\.[a-z0-9-]+)*)$/.exec(templateId);
    if (!parsed) return null;

    const match: MonsterSearchMatch = {
        id: templateId,
        rulesetId: parsed[1],
        ruleId: parsed[2],
        category: "monster",
        displayName: "",
        fingerprint: null
    };
    try {
        const { document } = await readNativeMonsterDocument(match);
        return projectMonsterCombatStats(document);
    } catch (error) {
        // Native entries removed from the catalog are not resolvable; the
        // saved encounter remains usable with its captured local values.
        if (error instanceof Error && /returned HTTP 404\./.test(error.message)) {
            return null;
        }
        throw error;
    }
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
