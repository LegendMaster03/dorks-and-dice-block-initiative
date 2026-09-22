const actedRoundsByCombatant =
    new Map<string, Set<number>>();

export function clearActedRounds(): void {
    actedRoundsByCombatant.clear();
}

export function setCombatantActed(
    combatantId: string,
    round: number,
    acted: boolean
): void {
    const rounds =
        actedRoundsByCombatant.get(combatantId)
        ?? new Set<number>();

    if (acted) rounds.add(round);
    else rounds.delete(round);

    if (rounds.size > 0) {
        actedRoundsByCombatant.set(
            combatantId,
            rounds);
    } else {
        actedRoundsByCombatant.delete(
            combatantId);
    }
}

export function isCombatantActed(
    combatantId: string,
    round: number
): boolean {
    return actedRoundsByCombatant
        .get(combatantId)
        ?.has(round)
        ?? false;
}

export function captureActedRounds():
    Record<string, number[]> {
    return Object.fromEntries(
        [...actedRoundsByCombatant.entries()]
            .map(([combatantId, rounds]) => [
                combatantId,
                [...rounds].sort(
                    (left, right) => left - right)
            ]));
}

export function restoreActedRounds(
    saved: Readonly<Record<string, readonly number[]>>
): void {
    actedRoundsByCombatant.clear();

    for (const [combatantId, rawRounds]
        of Object.entries(saved)) {
        const rounds =
            new Set(
                rawRounds.filter(
                    round =>
                        Number.isInteger(round)
                        && round >= 1));

        if (rounds.size > 0) {
            actedRoundsByCombatant.set(
                combatantId,
                rounds);
        }
    }
}

export function pruneActedRounds(
    activeCombatantIds: ReadonlySet<string>
): void {
    for (const combatantId
        of actedRoundsByCombatant.keys()) {
        if (!activeCombatantIds.has(combatantId)) {
            actedRoundsByCombatant.delete(
                combatantId);
        }
    }
}
