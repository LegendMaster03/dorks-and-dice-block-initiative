export interface InitiativeCombatantInput {
    id: string;
    name: string;
    allianceId: string;
    initiativeTotal: number;
    initiativeModifier: number | null;
    controllerId: string | null;
    tacticalGroupId: string | null;
}

export interface InitiativePreviewRequest {
    combatants: InitiativeCombatantInput[];
    manualOrderOverride?: string[] | null;
}

export interface InitiativeCombatantPreview extends InitiativeCombatantInput {
    effectiveInitiative: number;
}

export interface InitiativeBlockPreview {
    id: string;
    allianceId: string;
    memberIds: string[];
    memberOrder: string[];
    sourceBlockIds: string[];
    isMerged: boolean;
}

export interface CyclicMergePreview {
    topBlockId: string;
    bottomBlockId: string;
    allianceId: string;
}

export interface InitiativeIssuePreview {
    code: string;
    message: string;
    combatantIds: string[];
}

export interface InitiativePreviewResponse {
    orderedCombatants: InitiativeCombatantPreview[];
    blocks: InitiativeBlockPreview[];
    cyclicMerge: CyclicMergePreview | null;
    issues: InitiativeIssuePreview[];
    requiresAdjudication: boolean;
    usesManualOrderOverride: boolean;
}

export async function previewInitiative(
    url: string,
    request: InitiativePreviewRequest
): Promise<InitiativePreviewResponse> {
    const response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify(request)
    });

    if (!response.ok) {
        let detail = `Initiative preview returned HTTP ${response.status}.`;
        try {
            const payload = await response.json() as { error?: string };
            if (payload.error) {
                detail = payload.error;
            }
        } catch {
            // Keep the HTTP fallback when the response is not JSON.
        }

        throw new Error(detail);
    }

    return await response.json() as InitiativePreviewResponse;
}
