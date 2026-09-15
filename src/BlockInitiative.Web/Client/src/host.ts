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

export async function loadToolHostContext(url: string): Promise<ToolHostContext> {
    return await getJson<ToolHostContext>(url, "Tool Host context");
}

export async function loadToolHostCampaigns(
    context: ToolHostContext
): Promise<ToolHostCampaignSummary[]> {
    if (!context.user) return [];
    return await getJson<ToolHostCampaignSummary[]>(
        `${context.apiBaseUrl}/campaigns`,
        "Tool Host campaigns"
    );
}

export async function loadToolHostCampaignContext(
    context: ToolHostContext,
    campaignId: string
): Promise<ToolHostCampaignContext> {
    if (!context.user) {
        throw new Error("Campaign context requires a signed-in Dorks & Dice account.");
    }

    return await getJson<ToolHostCampaignContext>(
        `${context.apiBaseUrl}/campaigns/${encodeURIComponent(campaignId)}/context`,
        "Tool Host campaign context"
    );
}

export function initiativePreviewUrl(context: ToolHostContext | null): string {
    return toolApiUrl(context, "/api/initiative/preview");
}

export function initiativeStateUrl(context: ToolHostContext | null): string {
    return toolApiUrl(context, "/api/initiative/state");
}

function toolApiUrl(context: ToolHostContext | null, path: string): string {
    return context
        ? `${context.apiBaseUrl}/upstream${path}`
        : path;
}

async function getJson<T>(url: string, label: string): Promise<T> {
    const response = await fetch(url, {
        credentials: "same-origin",
        headers: {
            Accept: "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(`${label} returned HTTP ${response.status}.`);
    }

    return await response.json() as T;
}
