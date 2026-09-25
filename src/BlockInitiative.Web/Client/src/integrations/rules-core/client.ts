export type RulesCoreMatchKind = "resolved";

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

    let result: ResolvedCatalogResponse;
    try {
        result = await getRulesCoreJson<ResolvedCatalogResponse>(
            resolvedPath,
            `Rules Core resolved ${entityType} search`);
    } catch {
        throw new Error(unavailableMessage);
    }

    const rules = Array.isArray(result?.rules) ? result.rules : [];
    return rules
        .filter(rule =>
            typeof rule?.entityType === "string"
            && rule.entityType.toLowerCase() === entityType.toLowerCase()
            && Boolean(rule.conceptKey)
            && Boolean(rule.sourceEntityId)
            && Boolean(rule.displayName))
        .slice(0, limit)
        .map(rule => ({
            kind: "resolved" as const,
            id: `rule:${rule.conceptKey}`,
            conceptKey: rule.conceptKey,
            sourceEntityId: rule.sourceEntityId,
            displayName: rule.displayName,
            sourceCode: rule.sourceCode ?? "",
            packageDisplayName: rule.packageDisplayName ?? "",
            editionDisplayName: rule.editionDisplayName ?? "",
            browserLink: rule.browserLink ?? null
        }));
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
