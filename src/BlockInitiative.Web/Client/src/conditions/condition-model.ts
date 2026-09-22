import type { RuleBrowserLink } from "../integrations/rules-core/client";

export type ConditionOrigin = "rules-core" | "source" | "manual";

export type TrackedCondition = {
    id: string;
    name: string;
    note: string;
    browserLink: RuleBrowserLink | null;
    origin: ConditionOrigin;
};

const trackedConditions = new Map<string, TrackedCondition[]>();

export function conditionsFor(combatantId: string): readonly TrackedCondition[] {
    return trackedConditions.get(combatantId) ?? [];
}

export function pruneConditions(
    activeCombatantIds: ReadonlySet<string>
): void {
    for (const combatantId of trackedConditions.keys()) {
        if (!activeCombatantIds.has(combatantId)) {
            trackedConditions.delete(combatantId);
        }
    }
}

export function addCondition(
    combatantId: string,
    condition: TrackedCondition
): void {
    trackedConditions.set(
        combatantId,
        [...conditionsFor(combatantId), condition]
    );
}

export function removeCondition(
    combatantId: string,
    conditionId: string
): void {
    trackedConditions.set(
        combatantId,
        conditionsFor(combatantId).filter(
            condition => condition.id !== conditionId)
    );
}

export function updateConditionNote(
    combatantId: string,
    conditionId: string,
    note: string
): TrackedCondition | null {
    const condition = conditionsFor(combatantId)
        .find(candidate => candidate.id === conditionId);
    if (!condition) return null;

    condition.note = note;
    return condition;
}

export function conditionLabel(condition: TrackedCondition): string {
    return condition.note
        ? `${condition.name} · ${condition.note}`
        : condition.name;
}
