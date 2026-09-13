export type MonsterMatchKind = "resolved" | "source";

export interface RuleBrowserLink {
    toolSlug: string;
    toolRelativePath: string;
    routeIdentity: string;
}

export interface MonsterSearchMatch {
    kind: MonsterMatchKind;
    id: string;
    conceptKey: string | null;
    sourceEntityId: string;
    displayName: string;
    sourceCode: string;
    packageDisplayName: string;
    editionDisplayName: string;
    browserLink: RuleBrowserLink | null;
}

export interface MonsterTemplate {
    match: MonsterSearchMatch;
    name: string;
    maxHp: number | null;
    initiativeModifier: number | null;
    armorClass: string | null;
    challengeRating: string | null;
    document: Record<string, unknown>;
    browserLink: RuleBrowserLink | null;
}

interface ResolvedCatalogResponse {
    rules?: Array<{
        conceptKey: string;
        entityType: string;
        displayName: string;
        sourceEntityId: string;
        sourceCode: string;
        packageDisplayName: string;
        editionDisplayName: string;
        browserLink?: RuleBrowserLink | null;
    }>;
}

interface SourceEntitySummary {
    entityId: string;
    entityType: string;
    name: string;
    sourceCode: string;
    packageDisplayName: string;
    editionDisplayName: string;
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

interface SourceEntityDetail {
    entityId?: string;
    name?: string;
    sourceCode?: string;
    packageDisplayName?: string;
    editionDisplayName?: string;
    document?: unknown;
}

const gateway = "/tool-host/rules-core/api/upstream";

export async function searchRulesCoreMonsters(query: string, limit = 8): Promise<MonsterSearchMatch[]> {
    const normalized = query.trim();
    if (normalized.length < 2) return [];

    const encoded = encodeURIComponent(normalized);
    const resolvedUrl = `${gateway}/api/rules?entityType=monster&q=${encoded}&limit=${limit}`;
    const sourceUrl = `${gateway}/api/sources/entities?entityType=monster&q=${encoded}&limit=${limit}`;

    const [resolvedResult, sourceResult] = await Promise.allSettled([
        getJson<ResolvedCatalogResponse>(resolvedUrl, "Rules Core resolved monster search"),
        getJson<SourceEntitySummary[]>(sourceUrl, "Rules Core source monster search")
    ]);

    if (resolvedResult.status === "rejected" && sourceResult.status === "rejected") {
        throw new Error("Rules Core monster lookup is not available right now. You can keep using a manual monster name.");
    }

    const matches: MonsterSearchMatch[] = [];
    const seenSourceIds = new Set<string>();

    if (resolvedResult.status === "fulfilled") {
        const rules = Array.isArray(resolvedResult.value?.rules) ? resolvedResult.value.rules : [];
        for (const rule of rules) {
            if (typeof rule?.entityType !== "string" || rule.entityType.toLowerCase() !== "monster") continue;
            if (!rule.conceptKey || !rule.sourceEntityId || !rule.displayName) continue;
            matches.push({
                kind: "resolved",
                id: `rule:${rule.conceptKey}`,
                conceptKey: rule.conceptKey,
                sourceEntityId: rule.sourceEntityId,
                displayName: rule.displayName,
                sourceCode: rule.sourceCode ?? "",
                packageDisplayName: rule.packageDisplayName ?? "",
                editionDisplayName: rule.editionDisplayName ?? "",
                browserLink: rule.browserLink ?? null
            });
            seenSourceIds.add(rule.sourceEntityId);
            if (matches.length >= limit) return matches;
        }
    }

    if (sourceResult.status === "fulfilled") {
        const entities = Array.isArray(sourceResult.value) ? sourceResult.value : [];
        for (const entity of entities) {
            if (typeof entity?.entityType !== "string" || entity.entityType.toLowerCase() !== "monster") continue;
            if (!entity.entityId || !entity.name || seenSourceIds.has(entity.entityId)) continue;
            matches.push({
                kind: "source",
                id: `source:${entity.entityId}`,
                conceptKey: null,
                sourceEntityId: entity.entityId,
                displayName: entity.name,
                sourceCode: entity.sourceCode ?? "",
                packageDisplayName: entity.packageDisplayName ?? "",
                editionDisplayName: entity.editionDisplayName ?? "",
                browserLink: null
            });
            if (matches.length >= limit) break;
        }
    }

    return matches;
}

export async function loadMonsterTemplate(match: MonsterSearchMatch): Promise<MonsterTemplate> {
    let template: MonsterTemplate;

    if (match.kind === "resolved" && match.conceptKey) {
        const detail = await getJson<ResolvedRuleDetail>(
            `${gateway}/api/rules/${encodeURIComponent(match.conceptKey)}`,
            "Rules Core monster details");
        template = templateFromDocument(
            match,
            typeof detail.displayName === "string" && detail.displayName.trim() ? detail.displayName : match.displayName,
            isRecord(detail.document) ? detail.document : {},
            detail.browserLink ?? match.browserLink ?? null);
    } else {
        const detail = await getJson<SourceEntityDetail>(
            `${gateway}/api/sources/entities/${encodeURIComponent(match.sourceEntityId)}`,
            "Rules Core monster details");
        template = templateFromDocument(
            match,
            typeof detail.name === "string" && detail.name.trim() ? detail.name : match.displayName,
            isRecord(detail.document) ? detail.document : {},
            null);
    }

    announceTemplateLink(template);
    return template;
}

function templateFromDocument(
    match: MonsterSearchMatch,
    fallbackName: string,
    document: Record<string, unknown>,
    browserLink: RuleBrowserLink | null
): MonsterTemplate {
    const name = typeof document.name === "string" && document.name.trim()
        ? document.name.trim()
        : fallbackName;

    return {
        match,
        name,
        maxHp: readHitPoints(document.hp),
        initiativeModifier: readInitiativeModifier(document),
        armorClass: readArmorClass(document.ac),
        challengeRating: readChallengeRating(document.cr),
        document,
        browserLink
    };
}

function announceTemplateLink(template: MonsterTemplate): void {
    // browserLink is intentionally optional. Current Rules Core deployments can
    // continue supplying the existing monster payload; newer deployments add
    // navigation without changing the monster-loading contract.
    window.dispatchEvent(new CustomEvent("block-initiative:rules-core-template-link", {
        detail: {
            templateId: template.match.id,
            browserLink: template.browserLink
        }
    }));
}

function readHitPoints(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (!isRecord(value)) return null;
    const average = value.average;
    return typeof average === "number" && Number.isFinite(average) ? average : null;
}

function readInitiativeModifier(document: Record<string, unknown>): number | null {
    const explicit = readExplicitInitiative(document.initiative);
    if (explicit !== null) return explicit;

    const dexterity = document.dex;
    if (typeof dexterity !== "number" || !Number.isFinite(dexterity)) return null;
    return Math.floor((dexterity - 10) / 2);
}

function readExplicitInitiative(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") return parseSignedNumber(value);
    if (!isRecord(value)) return null;

    for (const key of ["bonus", "mod", "modifier", "initiativeBonus"]) {
        const candidate = value[key];
        if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
        if (typeof candidate === "string") {
            const parsed = parseSignedNumber(candidate);
            if (parsed !== null) return parsed;
        }
    }

    return null;
}

function readArmorClass(value: unknown): string | null {
    if (typeof value === "number" || typeof value === "string") return String(value);
    if (!Array.isArray(value) || value.length === 0) return null;

    const first = value[0];
    if (typeof first === "number" || typeof first === "string") return String(first);
    if (isRecord(first)) {
        const ac = first.ac;
        if (typeof ac === "number" || typeof ac === "string") return String(ac);
    }

    return null;
}

function readChallengeRating(value: unknown): string | null {
    if (typeof value === "number" || typeof value === "string") return String(value);
    if (!isRecord(value)) return null;
    const cr = value.cr;
    return typeof cr === "number" || typeof cr === "string" ? String(cr) : null;
}

function parseSignedNumber(value: string): number | null {
    const match = value.trim().match(/[+-]?\d+(?:\.\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getJson<T>(url: string, label: string): Promise<T> {
    let response: Response;
    try {
        response = await fetch(url, {
            credentials: "same-origin",
            headers: { Accept: "application/json" }
        });
    } catch {
        throw new Error(`${label} is not available right now.`);
    }

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error("Rules Core monster lookup requires access to the Rules Core tool or source package.");
        }
        throw new Error(`${label} returned HTTP ${response.status}.`);
    }

    const body = await response.text();
    if (!body.trim()) throw new Error(`${label} returned an empty response.`);
    try {
        return JSON.parse(body) as T;
    } catch {
        throw new Error(`${label} returned an unreadable response.`);
    }
}
