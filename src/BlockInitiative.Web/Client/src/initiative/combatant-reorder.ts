export type DropPlacement = "before" | "after";

export function moveCombatant(
    order: readonly string[],
    combatantId: string,
    targetId: string,
    placement: DropPlacement
): string[] {
    if (combatantId === targetId) return [...order];
    assertUniqueOrder(order);

    const sourceIndex = order.indexOf(combatantId);
    const targetIndex = order.indexOf(targetId);
    if (sourceIndex < 0) throw new Error(`Combatant '${combatantId}' is not in the initiative order.`);
    if (targetIndex < 0) throw new Error(`Combatant '${targetId}' is not in the initiative order.`);

    const next = order.filter(id => id !== combatantId);
    const adjustedTarget = next.indexOf(targetId);
    const insertionIndex = adjustedTarget + (placement === "after" ? 1 : 0);
    next.splice(insertionIndex, 0, combatantId);
    return next;
}

export function moveCombatantByOffset(
    order: readonly string[],
    combatantId: string,
    offset: -1 | 1
): string[] {
    assertUniqueOrder(order);
    const sourceIndex = order.indexOf(combatantId);
    if (sourceIndex < 0) throw new Error(`Combatant '${combatantId}' is not in the initiative order.`);

    const targetIndex = sourceIndex + offset;
    if (targetIndex < 0 || targetIndex >= order.length) return [...order];
    const targetId = order[targetIndex];
    return moveCombatant(order, combatantId, targetId, offset < 0 ? "before" : "after");
}

export function sameOrder(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function sameMembers(left: readonly string[], right: readonly string[]): boolean {
    if (left.length !== right.length) return false;
    const expected = new Set(left);
    return expected.size === left.length && right.every(id => expected.has(id));
}

function assertUniqueOrder(order: readonly string[]): void {
    if (new Set(order).size !== order.length) {
        throw new Error("Initiative order contains duplicate combatants.");
    }
}
