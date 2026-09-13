export type ConditionMatchKind = "resolved" | "source";

export interface RuleBrowserLink {
    toolSlug: string;
    toolRelativePath: string;
    routeIdentity: string;
}

export interface ConditionSearchMatch {
    kind: ConditionMatchKind;
    id: string;
    conceptKey: string | null;
    sourceEntityId: string;
    displayName: string;
    sourceCode: string;
    packageDisplayName: string;
    editionDisplayName: string;
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

const gateway = "/tool-host/rules-core/api/upstream";

export async function searchRulesCoreConditions(query: string, limit = 10): Promise<ConditionSearchMatch[]> {
    const normalized = query.trim();
    if (normalized.length < 2) return [];

    const encoded = encodeURIComponent(normalized);
    const resolvedUrl = `${gateway}/api/rules?entityType=condition&q=${encoded}&limit=${limit}`;
    const sourceUrl = `${gateway}/api/sources/entities?entityType=condition&q=${encoded}&limit=${limit}`;

    const [resolvedResult, sourceResult] = await Promise.allSettled([
        getJson<ResolvedCatalogResponse>(resolvedUrl, "Rules Core resolved condition search"),
        getJson<SourceEntitySummary[]>(sourceUrl, "Rules Core source condition search")
    ]);

    if (resolvedResult.status === "rejected" && sourceResult.status === "rejected") {
        throw new Error("Rules Core condition lookup is not available right now. You can still add the condition manually.");
    }

    const matches: ConditionSearchMatch[] = [];
    const seenSourceIds = new Set<string>();

    if (resolvedResult.status === "fulfilled") {
        const rules = Array.isArray(resolvedResult.value?.rules) ? resolvedResult.value.rules : [];
        for (const rule of rules) {
            if (typeof rule?.entityType !== "string" || rule.entityType.toLowerCase() !== "condition") continue;
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
            if (typeof entity?.entityType !== "string" || entity.entityType.toLowerCase() !== "condition") continue;
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

export function toHostedToolHref(link: RuleBrowserLink | null | undefined): string | null {
    const slug = link?.toolSlug?.trim();
    const relativePath = link?.toolRelativePath?.trim();
    if (!slug || !relativePath || !relativePath.startsWith("/")) return null;
    return `/tools/${encodeURIComponent(slug)}${relativePath}`;
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
            throw new Error("Rules Core condition lookup requires access to the Rules Core tool or source package.");
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
