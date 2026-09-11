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

export async function loadToolHostContext(url: string): Promise<ToolHostContext> {
    const response = await fetch(url, {
        credentials: "same-origin",
        headers: {
            Accept: "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(`Tool Host context returned HTTP ${response.status}.`);
    }

    return await response.json() as ToolHostContext;
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
