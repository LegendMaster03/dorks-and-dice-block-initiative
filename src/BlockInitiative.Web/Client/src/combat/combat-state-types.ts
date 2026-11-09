/**
 * Minimal event projections consumed by combat-state adapters. These shapes
 * identify active combatants without duplicating the full initiative API model.
 */

export type PreviewCombatant = {
    id: string;
    name: string;
    allianceId: string;
    blockType: "standard" | "kaiju";
};

export type PreviewDetail = {
    response: {
        orderedCombatants: PreviewCombatant[];
    };
};

export type TurnStateDetail = {
    request?: {
        advanceCount?: number;
        resumeActiveCombatantId?: string | null;
    };
    response: {
        round: number;
        activeBlockId: string | null;
        blocks: Array<{ id: string; memberOrder: string[] }>;
    };
};

export function activeCombatantIds(turnState: TurnStateDetail): Set<string> {
    const activeBlock = turnState.response.blocks.find(
        block => block.id === turnState.response.activeBlockId
    );
    return new Set(activeBlock?.memberOrder ?? []);
}
