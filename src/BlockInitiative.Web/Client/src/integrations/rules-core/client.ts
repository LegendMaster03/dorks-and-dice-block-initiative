/** The first playable native ruleset. Other rulesets require an explicit selection contract. */
export const nativeRulesetId = "first-party-001";

export interface RuleBrowserLink {
    toolSlug: string;
    toolRelativePath: string;
    routeIdentity: string;
}

export interface RulesCoreSearchMatch {
    id: string;
    rulesetId: string;
    ruleId: string;
    displayName: string;
    category: string;
    /** Exact native catalog snapshot used to populate this match. */
    fingerprint: string | null;
}

interface NativeRulesetsResponse {
    rulesets: Array<{ id: string; capabilities: { read: boolean } }>;
}

interface NativeRulesPage {
    rulesetId: string;
    fingerprint: string;
    total: number;
    rules: Array<{ id: string; name: string; kind: string }>;
}

const gateway = "/tool-host/registrations/rules-core/api/upstream";
const safeRuleId = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
const fingerprintPattern = /^[a-f0-9]{64}$/i;

/**
 * Read the live native catalog through the user-authenticated Site gateway.
 * The current fingerprint identifies a version; it is not an access grant.
 */
async function ensureNativeRuleset(): Promise<void> {
    const response = await getRulesCoreJson<NativeRulesetsResponse>(
        "/api/consumer/v1/rulesets", "Rules Core ruleset catalog");
    if (!Array.isArray(response.rulesets)
        || !response.rulesets.some(item =>
            item?.id === nativeRulesetId && item.capabilities?.read === true)) {
        throw new Error("Rules Core has not loaded the selected ruleset.");
    }
}

export async function searchRulesCoreEntity(
    categories: readonly string[],
    query: string,
    limit: number
): Promise<RulesCoreSearchMatch[]> {
    const term = query.trim();
    if (term.length < 2) return [];
    if (term.length > 200) {
        throw new Error("Rules Core searches can not exceed 200 characters.");
    }
    const pageSize = Math.max(1, Math.min(100, Math.trunc(limit) || 1));
    await ensureNativeRuleset();
    const pages = await Promise.all(categories.map(category =>
        getRulesCoreJson<NativeRulesPage>(
            `/api/consumer/v1/rulesets/${nativeRulesetId}/rules?category=${encodeURIComponent(category)}`
                + `&q=${encodeURIComponent(term)}&limit=${pageSize}&offset=0`,
            `Rules Core ${category} search`)));
    return pages.flatMap((page, index) => {
        if (page?.rulesetId !== nativeRulesetId || !Array.isArray(page.rules)
            || !fingerprintPattern.test(page.fingerprint ?? "")) {
            throw new Error("Rules Core returned an invalid native search response.");
        }
        return page.rules
            .filter(rule => rule?.kind === categories[index]
                && typeof rule.id === "string" && safeRuleId.test(rule.id)
                && typeof rule.name === "string" && rule.name.trim())
            .map(rule => ({
                id: `native:${nativeRulesetId}:${rule.id}`,
                rulesetId: nativeRulesetId,
                ruleId: rule.id,
                displayName: rule.name,
                category: rule.kind,
                fingerprint: page.fingerprint
            }));
    }).sort((left, right) => left.displayName.localeCompare(right.displayName))
        .slice(0, pageSize);
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

/** Retain navigation already recorded in old saves. Native API supplies no browser links. */
export function toHostedToolHref(link: RuleBrowserLink | null | undefined): string | null {
    const slug = link?.toolSlug?.trim();
    const relativePath = link?.toolRelativePath?.trim();
    if (!slug || !relativePath || !relativePath.startsWith("/")) return null;
    return `/tools/${encodeURIComponent(slug)}${relativePath}`;
}
