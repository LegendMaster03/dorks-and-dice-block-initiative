import { initializeCombatStateUi } from "./combat-state-ui";
import { initializeCombatantFieldUi } from "./combatant-field-ui";
import { initializeEnemyDuplicateUi } from "./enemy-duplicate-ui";
import { initializeHealthControlUi } from "./health-control-ui";
import { initializeInitiativeRollUi } from "./initiative-roll-ui";
import { initializeKaijuLayoutUi } from "./kaiju-layout-ui";
import { initializeTrackerLayoutUi } from "./tracker-layout-ui";

export type TurnBlockType = "standard" | "kaiju";
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
}

export interface InitiativeTurnStateRequest extends InitiativePreviewRequest {
    advanceCount: number;
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

export async function previewInitiative(
    url: string,
    request: InitiativePreviewRequest
): Promise<InitiativePreviewResponse> {
    const response = await postJson<InitiativePreviewResponse>(url, request, "Initiative preview");
    window.dispatchEvent(new CustomEvent("block-initiative:preview", {
        detail: { request, response }
    }));
    return response;
}

export async function loadInitiativeTurnState(
    url: string,
    request: InitiativeTurnStateRequest
): Promise<InitiativeTurnStateResponse> {
    const response = await postJson<InitiativeTurnStateResponse>(url, request, "Initiative state");
    window.dispatchEvent(new CustomEvent("block-initiative:state", {
        detail: { request, response }
    }));
    return response;
}

async function postJson<T>(
    url: string,
    request: unknown,
    label: string
): Promise<T> {
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
        let detail = `${label} returned HTTP ${response.status}.`;
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

    return await response.json() as T;
}

function preserveHelperStylesOutsideToolRoot(): void {
    const root = document.getElementById("tool-root");
    const head = root?.ownerDocument.head;
    if (!(root instanceof HTMLElement) || !head) return;

    const styles = root.querySelectorAll<HTMLStyleElement>(
        ":scope > style[data-role], :scope > style[data-combat-state-style]"
    );
    for (const style of styles) {
        head.append(style);
    }
}

initializeCombatStateUi();
initializeCombatantFieldUi();
initializeEnemyDuplicateUi();
initializeInitiativeRollUi();
initializeHealthControlUi();
initializeKaijuLayoutUi();
initializeTrackerLayoutUi();

// app.ts rebuilds #tool-root after imports execute. Keep helper styles outside
// that replaceable subtree so compact controls and tracker layout survive mount.
preserveHelperStylesOutsideToolRoot();
