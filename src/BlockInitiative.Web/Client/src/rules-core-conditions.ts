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
    rules: Array<{
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
        getJson<ResolvedCatalogResponse>(resolvedUrl),
        getJson<SourceEntitySummary[]>(sourceUrl)
    ]);

    if (resolvedResult.status === "rejected" && sourceResult.status === "rejected") {
        throw resolvedResult.reason instanceof Error
            ? resolvedResult.reason
            : new Error("Rules Core condition search is unavailable.");
    }

    const matches: ConditionSearchMatch[] = [];
    const seenSourceIds = new Set<string>();

    if (resolvedResult.status === "fulfilled") {
        for (const rule of resolvedResult.value.rules ?? []) {
            if (rule.entityType.toLowerCase() !== "condition") continue;
            matches.push({
                kind: "resolved",
                id: `rule:${rule.conceptKey}`,
                conceptKey: rule.conceptKey,
                sourceEntityId: rule.sourceEntityId,
                displayName: rule.displayName,
                sourceCode: rule.sourceCode,
                packageDisplayName: rule.packageDisplayName,
                editionDisplayName: rule.editionDisplayName,
                browserLink: rule.browserLink ?? null
            });
            seenSourceIds.add(rule.sourceEntityId);
            if (matches.length >= limit) return matches;
        }
    }

    if (sourceResult.status === "fulfilled") {
        for (const entity of sourceResult.value ?? []) {
            if (entity.entityType.toLowerCase() !== "condition" || seenSourceIds.has(entity.entityId)) continue;
            matches.push({
                kind: "source",
                id: `source:${entity.entityId}`,
                conceptKey: null,
                sourceEntityId: entity.entityId,
                displayName: entity.name,
                sourceCode: entity.sourceCode,
                packageDisplayName: entity.packageDisplayName,
                editionDisplayName: entity.editionDisplayName,
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

async function getJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error("Rules Core condition search requires access to the Rules Core tool or source package.");
        }
        throw new Error(`Rules Core returned HTTP ${response.status}.`);
    }

    return await response.json() as T;
}
