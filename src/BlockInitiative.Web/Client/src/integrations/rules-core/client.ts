export type RulesCoreMatchKind = "resolved" | "source";

export interface RuleBrowserLink {
    toolSlug: string;
    toolRelativePath: string;
    routeIdentity: string;
}

export interface RulesCoreSearchMatch {
    kind: RulesCoreMatchKind;
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

export async function searchRulesCoreEntity(
    entityType: string,
    query: string,
    limit: number,
    unavailableMessage: string
): Promise<RulesCoreSearchMatch[]> {
    const normalized = query.trim();
    if (normalized.length < 2) return [];

    const encodedType = encodeURIComponent(entityType);
    const encodedQuery = encodeURIComponent(normalized);
    const resolvedPath = `/api/rules?entityType=${encodedType}&q=${encodedQuery}&limit=${limit}`;
    const sourcePath = `/api/sources/entities?entityType=${encodedType}&q=${encodedQuery}&limit=${limit}`;

    const [resolvedResult, sourceResult] = await Promise.allSettled([
        getRulesCoreJson<ResolvedCatalogResponse>(
            resolvedPath,
            `Rules Core resolved ${entityType} search`),
        getRulesCoreJson<SourceEntitySummary[]>(
            sourcePath,
            `Rules Core source ${entityType} search`)
    ]);

    if (resolvedResult.status === "rejected" && sourceResult.status === "rejected") {
        throw new Error(unavailableMessage);
    }

    const matches: RulesCoreSearchMatch[] = [];
    const seenSourceIds = new Set<string>();

    if (resolvedResult.status === "fulfilled") {
        const rules = Array.isArray(resolvedResult.value?.rules)
            ? resolvedResult.value.rules
            : [];

        for (const rule of rules) {
            if (typeof rule?.entityType !== "string"
                || rule.entityType.toLowerCase() !== entityType.toLowerCase()) continue;
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
            if (typeof entity?.entityType !== "string"
                || entity.entityType.toLowerCase() !== entityType.toLowerCase()) continue;
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

export async function getRulesCoreJson<T>(
    path: string,
    label: string,
    accessDeniedMessage = "Rules Core access is required for this operation."
): Promise<T> {
    let response: Response;
    try {
        response = await fetch(`${gateway}${path}`, {
            credentials: "same-origin",
            headers: { Accept: "application/json" }
        });
    } catch {
        throw new Error(`${label} is not available right now.`);
    }

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error(accessDeniedMessage);
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

export function toHostedToolHref(link: RuleBrowserLink | null | undefined): string | null {
    const slug = link?.toolSlug?.trim();
    const relativePath = link?.toolRelativePath?.trim();
    if (!slug || !relativePath || !relativePath.startsWith("/")) return null;
    return `/tools/${encodeURIComponent(slug)}${relativePath}`;
}
