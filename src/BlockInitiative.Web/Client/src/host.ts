export interface ToolHostUserContext {
    id: string;
    displayName: string;
}

export interface ToolHostContext {
    toolSlug: string;
    siteMode: string;
    apiBaseUrl: string;
    user: ToolHostUserContext | null;
}

export interface ToolHostCampaignSummary {
    id: string;
    name: string;
    role: "DM" | "Player" | string;
}

export interface ToolHostCampaignParticipant {
    participantId: string;
    displayName: string;
    userId: string | null;
}

export interface ToolHostCampaignCharacter {
    characterId: string;
    ownerUserId: string;
    name: string;
}

export interface ToolHostCampaignContext {
    campaignId: string;
    name: string;
    requestingUserRoles: string[];
    participants: ToolHostCampaignParticipant[];
    characters: ToolHostCampaignCharacter[];
}

const contextCache = new Map<string, ToolHostContext>();
const contextRequests =
    new Map<string, Promise<ToolHostContext>>();

export async function loadToolHostContext(
    url: string
): Promise<ToolHostContext> {
    const cached = contextCache.get(url);
    if (cached) return cached;

    let request = contextRequests.get(url);
    if (!request) {
        request = getJsonWithRetry<ToolHostContext>(
            url,
            "Tool Host context"
        )
            .then(context => {
                contextCache.set(url, context);
                return context;
            })
            .finally(() => {
                contextRequests.delete(url);
            });
        contextRequests.set(url, request);
    }

    return await request;
}

export async function loadToolHostCampaigns(
    context: ToolHostContext
): Promise<ToolHostCampaignSummary[]> {
    if (!context.user) return [];
    return await getJsonWithRetry<ToolHostCampaignSummary[]>(
        `${context.apiBaseUrl}/campaigns`,
        "Tool Host campaigns"
    );
}

export async function loadToolHostCampaignContext(
    context: ToolHostContext,
    campaignId: string
): Promise<ToolHostCampaignContext> {
    if (!context.user) {
        throw new Error(
            "Campaign context requires a signed-in Dorks & Dice account.");
    }

    return await getJsonWithRetry<ToolHostCampaignContext>(
        `${context.apiBaseUrl}/campaigns/${encodeURIComponent(campaignId)}/context`,
        "Tool Host campaign context"
    );
}

export function initiativePreviewUrl(
    context: ToolHostContext | null
): string {
    return toolApiUrl(
        context,
        "/api/initiative/preview");
}

export function initiativeStateUrl(
    context: ToolHostContext | null
): string {
    return toolApiUrl(
        context,
        "/api/initiative/state");
}

function toolApiUrl(
    context: ToolHostContext | null,
    path: string
): string {
    return context
        ? `${context.apiBaseUrl}/upstream${path}`
        : path;
}

async function getJsonWithRetry<T>(
    url: string,
    label: string,
    attempts = 3
): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getJson<T>(url, label);
        } catch (error) {
            lastError = error;
            if (attempt === attempts) break;
            await delay(150 * attempt);
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error(`${label} is unavailable.`);
}

async function getJson<T>(
    url: string,
    label: string
): Promise<T> {
    let response: Response;
    try {
        response = await fetch(url, {
            credentials: "same-origin",
            headers: {
                Accept: "application/json"
            }
        });
    } catch (error) {
        throw new Error(
            `${label} is not available right now.`,
            { cause: error });
    }

    if (!response.ok) {
        throw new Error(
            `${label} returned HTTP ${response.status}.`);
    }

    try {
        return await response.json() as T;
    } catch (error) {
        throw new Error(
            `${label} returned an unreadable response.`,
            { cause: error });
    }
}

function delay(milliseconds: number): Promise<void> {
    return new Promise(resolve =>
        window.setTimeout(resolve, milliseconds));
}
