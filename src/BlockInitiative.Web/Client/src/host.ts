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
