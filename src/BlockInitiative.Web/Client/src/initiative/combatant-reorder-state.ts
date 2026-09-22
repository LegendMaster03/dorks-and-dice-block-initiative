import type {
    InitiativePreviewRequest
} from "../api";

export type CombatantReorderRuntimeSnapshot = {
    baselineRequest: InitiativePreviewRequest | null;
    baselineOrder: string[] | null;
    history: string[][];
};

let baselineRequest: InitiativePreviewRequest | null = null;
let baselineOrder: string[] | null = null;
let history: string[][] = [];

export function resetCombatantReorderRuntime(
    request: InitiativePreviewRequest,
    order: readonly string[]
): void {
    baselineRequest = cloneRequest(request);
    baselineOrder = [...order];
    history = [];
}

export function combatantReorderBaselineRequest():
    InitiativePreviewRequest | null {
    return baselineRequest
        ? cloneRequest(baselineRequest)
        : null;
}

export function combatantReorderBaselineOrder():
    string[] | null {
    return baselineOrder
        ? [...baselineOrder]
        : null;
}

export function combatantReorderHistory():
    string[][] {
    return history.map(order => [...order]);
}

export function pushCombatantReorderHistory(
    order: readonly string[]
): void {
    history.push([...order]);
}

export function popCombatantReorderHistory(): string[] | null {
    const value = history.pop();
    return value ? [...value] : null;
}

export function clearCombatantReorderHistory(): void {
    history = [];
}

export function captureCombatantReorderRuntime():
    CombatantReorderRuntimeSnapshot {
    return {
        baselineRequest:
            baselineRequest
                ? cloneRequest(baselineRequest)
                : null,
        baselineOrder:
            baselineOrder
                ? [...baselineOrder]
                : null,
        history:
            history.map(order => [...order])
    };
}

export function restoreCombatantReorderRuntime(
    snapshot: CombatantReorderRuntimeSnapshot | null | undefined
): void {
    baselineRequest =
        snapshot?.baselineRequest
            ? cloneRequest(snapshot.baselineRequest)
            : null;
    baselineOrder =
        snapshot?.baselineOrder
            ? [...snapshot.baselineOrder]
            : null;
    history =
        snapshot?.history
            ?.map(order => [...order])
        ?? [];
}

function cloneRequest(
    request: InitiativePreviewRequest
): InitiativePreviewRequest {
    return {
        ...request,
        combatants:
            request.combatants.map(
                combatant => ({ ...combatant })),
        manualOrderOverride:
            request.manualOrderOverride
                ? [...request.manualOrderOverride]
                : null
    };
}
