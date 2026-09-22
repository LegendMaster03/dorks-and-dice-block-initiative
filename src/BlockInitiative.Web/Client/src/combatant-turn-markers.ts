const actedRoundByCombatant = new Map<string, number>();

export function clearActedRounds(): void {
    actedRoundByCombatant.clear();
}

export function setCombatantActed(
    combatantId: string,
    round: number,
    acted: boolean
): void {
    if (acted) actedRoundByCombatant.set(combatantId, round);
    else actedRoundByCombatant.delete(combatantId);
}

export function isCombatantActed(
    combatantId: string,
    round: number
): boolean {
    return actedRoundByCombatant.get(combatantId) === round;
}

export function captureActedRounds(): Record<string, number> {
    return Object.fromEntries(actedRoundByCombatant);
}

export function restoreActedRounds(
    saved: Readonly<Record<string, number>>
): void {
    actedRoundByCombatant.clear();
    for (const [combatantId, round] of Object.entries(saved)) {
        if (Number.isInteger(round) && round >= 1) {
            actedRoundByCombatant.set(combatantId, round);
        }
    }
}

export function pruneActedRounds(
    activeCombatantIds: ReadonlySet<string>
): void {
    for (const combatantId of actedRoundByCombatant.keys()) {
        if (!activeCombatantIds.has(combatantId)) {
            actedRoundByCombatant.delete(combatantId);
        }
    }
}
