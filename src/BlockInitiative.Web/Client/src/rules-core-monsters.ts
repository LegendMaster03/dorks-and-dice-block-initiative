export type MonsterMatchKind = "resolved" | "source";

export interface MonsterSearchMatch {
    kind: MonsterMatchKind;
    id: string;
    conceptKey: string | null;
    sourceEntityId: string;
    displayName: string;
    sourceCode: string;
    packageDisplayName: string;
    editionDisplayName: string;
}

export interface MonsterTemplate {
    match: MonsterSearchMatch;
    name: string;
    maxHp: number | null;
    initiativeModifier: number | null;
    armorClass: string | null;
    challengeRating: string | null;
    document: Record<string, unknown>;
}

interface ResolvedCatalogResponse {
    rules: Array<{
        conceptKey: string;
        entityType: string;
        displayName: string;
        sourceEntityId: string;
        sourceCode: string;
        packageDisplayName: string;
        editionDisplayName: string;
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
    conceptKey: string;
    displayName: string;
    sourceEntityId: string;
    sourceCode: string;
    packageDisplayName: string;
    editionDisplayName: string;
    document: Record<string, unknown>;
}

interface SourceEntityDetail {
    entityId: string;
    name: string;
    sourceCode: string;
    packageDisplayName: string;
    editionDisplayName: string;
    document: Record<string, unknown>;
}

const gateway = "/tool-host/rules-core/api/upstream";

export async function searchRulesCoreMonsters(query: string, limit = 8): Promise<MonsterSearchMatch[]> {
    const normalized = query.trim();
    if (normalized.length < 2) return [];

    const encoded = encodeURIComponent(normalized);
    const resolvedUrl = `${gateway}/api/rules?entityType=monster&q=${encoded}&limit=${limit}`;
    const sourceUrl = `${gateway}/api/sources/entities?entityType=monster&q=${encoded}&limit=${limit}`;

    const [resolvedResult, sourceResult] = await Promise.allSettled([
        getJson<ResolvedCatalogResponse>(resolvedUrl),
        getJson<SourceEntitySummary[]>(sourceUrl)
    ]);

    if (resolvedResult.status === "rejected" && sourceResult.status === "rejected") {
        throw resolvedResult.reason instanceof Error
            ? resolvedResult.reason
            : new Error("Rules Core monster search is unavailable.");
    }

    const matches: MonsterSearchMatch[] = [];
    const seenSourceIds = new Set<string>();

    if (resolvedResult.status === "fulfilled") {
        for (const rule of resolvedResult.value.rules ?? []) {
            if (rule.entityType.toLowerCase() !== "monster") continue;
            matches.push({
                kind: "resolved",
                id: `rule:${rule.conceptKey}`,
                conceptKey: rule.conceptKey,
                sourceEntityId: rule.sourceEntityId,
                displayName: rule.displayName,
                sourceCode: rule.sourceCode,
                packageDisplayName: rule.packageDisplayName,
                editionDisplayName: rule.editionDisplayName
            });
            seenSourceIds.add(rule.sourceEntityId);
            if (matches.length >= limit) return matches;
        }
    }

    if (sourceResult.status === "fulfilled") {
        for (const entity of sourceResult.value ?? []) {
            if (entity.entityType.toLowerCase() !== "monster" || seenSourceIds.has(entity.entityId)) continue;
            matches.push({
                kind: "source",
                id: `source:${entity.entityId}`,
                conceptKey: null,
                sourceEntityId: entity.entityId,
                displayName: entity.name,
                sourceCode: entity.sourceCode,
                packageDisplayName: entity.packageDisplayName,
                editionDisplayName: entity.editionDisplayName
            });
            if (matches.length >= limit) break;
        }
    }

    return matches;
}

export async function loadMonsterTemplate(match: MonsterSearchMatch): Promise<MonsterTemplate> {
    if (match.kind === "resolved" && match.conceptKey) {
        const detail = await getJson<ResolvedRuleDetail>(
            `${gateway}/api/rules/${encodeURIComponent(match.conceptKey)}`);
        return templateFromDocument(match, detail.displayName, detail.document);
    }

    const detail = await getJson<SourceEntityDetail>(
        `${gateway}/api/sources/entities/${encodeURIComponent(match.sourceEntityId)}`);
    return templateFromDocument(match, detail.name, detail.document);
}

function templateFromDocument(
    match: MonsterSearchMatch,
    fallbackName: string,
    document: Record<string, unknown>
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
        document
    };
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

async function getJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error("Rules Core search requires access to the Rules Core tool or source package.");
        }
        throw new Error(`Rules Core returned HTTP ${response.status}.`);
    }

    return await response.json() as T;
}
