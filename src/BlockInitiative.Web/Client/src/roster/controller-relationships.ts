export type ControllerAssignment = {
    id: string;
    name: string;
    controllerId: string | null;
};

export function controllerRelationshipError(
    combatants: readonly ControllerAssignment[]
): string | null {
    const byId =
        new Map(
            combatants.map(combatant => [
                combatant.id,
                combatant
            ]));

    for (const combatant of combatants) {
        const controllerId =
            combatant.controllerId;
        if (!controllerId) continue;

        if (!byId.has(controllerId)) {
            return `${label(combatant)} references a controller that is no longer in the encounter.`;
        }
        if (controllerId === combatant.id) {
            return `${label(combatant)} can not act with itself as controller.`;
        }
    }

    const completed = new Set<string>();
    for (const combatant of combatants) {
        if (completed.has(combatant.id)) continue;

        const path: ControllerAssignment[] = [];
        const indexById = new Map<string, number>();
        let current: ControllerAssignment | undefined =
            combatant;

        while (current) {
            if (completed.has(current.id)) break;

            const existingIndex =
                indexById.get(current.id);
            if (existingIndex !== undefined) {
                const cycle =
                    path.slice(existingIndex)
                        .concat(current)
                        .map(label)
                        .join(" → ");
                return `Controller relationship has a cycle: ${cycle}.`;
            }

            indexById.set(
                current.id,
                path.length);
            path.push(current);

            current =
                current.controllerId
                    ? byId.get(current.controllerId)
                    : undefined;
        }

        for (const member of path) {
            completed.add(member.id);
        }
    }

    return null;
}

function label(
    combatant: ControllerAssignment
): string {
    return combatant.name.trim()
        || "(unnamed combatant)";
}
