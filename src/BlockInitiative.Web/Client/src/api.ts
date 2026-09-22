import { initializeFrontendRuntime } from "./frontend-runtime";
import { getInitiativeMode, initializeInitiativeModeUi } from "./initiative/initiative-mode";
import type { InitiativeMode } from "./initiative/initiative-mode";

export type { InitiativeMode } from "./initiative/initiative-mode";
export type TurnBlockType = "standard" | "kaiju" | "mixed";
export type TacticalGroupInitiativeMode = "individual" | "average" | "shared";

export interface InitiativeCombatantInput {
    id: string;
    name: string;
    allianceId: string;
    initiativeTotal: number;
    initiativeModifier: number | null;
    controllerId: string | null;
    tacticalGroupId: string | null;
    blockType?: TurnBlockType;
}

export interface InitiativePreviewRequest {
    combatants: InitiativeCombatantInput[];
    manualOrderOverride?: string[] | null;
    tacticalGroupMode?: TacticalGroupInitiativeMode;
    initiativeMode?: InitiativeMode;
}

export interface InitiativeTurnStateRequest extends InitiativePreviewRequest {
    advanceCount: number;
    resumeRound?: number | null;
    resumeActiveCombatantId?: string | null;
    resumeCyclicMergeCompleted?: boolean;
}

export interface InitiativeCombatantPreview extends InitiativeCombatantInput {
    effectiveInitiative: number;
    blockType: TurnBlockType;
}

export interface InitiativeBlockPreview {
    id: string;
    allianceId: string;
    blockType: TurnBlockType;
    memberIds: string[];
    memberOrder: string[];
    sourceBlockIds: string[];
    isMerged: boolean;
}

export interface CyclicMergePreview {
    topBlockId: string;
    bottomBlockId: string;
    allianceId: string;
    blockType: TurnBlockType;
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

export interface TurnAdvancePreview {
    previousRound: number;
    currentRound: number;
    previousBlockId: string | null;
    currentBlockId: string | null;
    roundAdvanced: boolean;
    cyclicMergeCompleted: boolean;
    skippedBlockId: string | null;
}

export interface InitiativeTurnStateResponse {
    round: number;
    activeBlockId: string | null;
    blocks: InitiativeBlockPreview[];
    cyclicMergePending: boolean;
    cyclicMergeCompleted: boolean;
    lowerCyclicBlockSkippedRoundOne: boolean;
    lastAdvance: TurnAdvancePreview | null;
}

let runtimeManualOrder: string[] | null = null;

export function setRuntimeManualOrder(order: readonly string[] | null): void {
    runtimeManualOrder = order ? [...order] : null;
}

export function getRuntimeManualOrder(): string[] | null {
    return runtimeManualOrder ? [...runtimeManualOrder] : null;
}

export async function previewInitiative(
    url: string,
    request: InitiativePreviewRequest
): Promise<InitiativePreviewResponse> {
    const effectiveRequest = withRuntimeSettings(request);
    const response = await postJson<InitiativePreviewResponse>(url, effectiveRequest, "Initiative preview");
    window.dispatchEvent(new CustomEvent("block-initiative:preview", {
        detail: { request: effectiveRequest, response }
    }));
    return response;
}

export async function loadInitiativeTurnState(
    url: string,
    request: InitiativeTurnStateRequest
): Promise<InitiativeTurnStateResponse> {
    const effectiveRequest = withRuntimeSettings(request);
    const response = await postJson<InitiativeTurnStateResponse>(url, effectiveRequest, "Initiative state");
    window.dispatchEvent(new CustomEvent("block-initiative:state", {
        detail: { request: effectiveRequest, response }
    }));
    return response;
}

function withRuntimeSettings<T extends InitiativePreviewRequest>(request: T): T {
    const withMode = {
        ...request,
        initiativeMode: getInitiativeMode()
    };

    if (!runtimeManualOrder) return withMode;

    const combatantIds = request.combatants.map(combatant => combatant.id);
    if (!sameMembers(runtimeManualOrder, combatantIds)) {
        runtimeManualOrder = null;
        return withMode;
    }

    return {
        ...withMode,
        manualOrderOverride: [...runtimeManualOrder]
    };
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
    if (left.length !== right.length) return false;
    const expected = new Set(left);
    return expected.size === left.length && right.every(id => expected.has(id));
}

async function postJson<T>(
    url: string,
    request: unknown,
    label: string
): Promise<T> {
    try {
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
            let detail =
                `${label} returned HTTP ${response.status}.`;
            try {
                const payload =
                    await response.json() as { error?: string };
                if (payload.error) {
                    detail = payload.error;
                }
            } catch {
                // Keep the HTTP fallback when the response is not JSON.
            }

            throw new Error(detail);
        }

        return await response.json() as T;
    } catch (error) {
        window.dispatchEvent(
            new CustomEvent(
                "block-initiative:api-error",
                { detail: { label, error } }));
        throw error;
    }
}

// api.ts is evaluated as an app.ts dependency before the encounter workspace is
// mounted. Defer the one-time runtime bootstrap to the next task so app.ts can
// synchronously create its initial application-owned DOM first. This preserves
// the current Embedded Module host contract without using DOM mutation as the
// mounting signal.
window.setTimeout(() => {
    initializeInitiativeModeUi();
    initializeFrontendRuntime();
}, 0);
