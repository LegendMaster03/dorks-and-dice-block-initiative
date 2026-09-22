import type {
    InitiativePreviewRequest,
    InitiativePreviewResponse,
    InitiativeTurnStateRequest,
    InitiativeTurnStateResponse
} from "../api";

export type SavedView = "setup" | "preview" | "running" | "editing";
export type CombatantBlockType = "standard" | "kaiju";

export type PreviewDetail = {
    request: InitiativePreviewRequest;
    response: InitiativePreviewResponse;
};

export type StateDetail = {
    request: InitiativeTurnStateRequest;
    response: InitiativeTurnStateResponse;
};

export type SavedControl = {
    key: string;
    value: string;
    checked: boolean | null;
};

export type SavedCondition = {
    name: string;
    note: string;
    href: string | null;
};

export type SavedCombatant = {
    id: string;
    name: string;
    initiative: string;
    modifier: string;
    armorClass: string;
    touchArmorClass: string;
    flatFootedArmorClass: string;
    blockType: CombatantBlockType;
    controllerId: string;
    rulesReference: string;
    campaignCharacterId: string | null;
    campaignId: string | null;
    templateId: string | null;
    instanceNumber: string | null;
    autoName: string | null;
    monsterMetaText: string;
    setupAreaCount: number;
    setupControls: SavedControl[];
    conditions: SavedCondition[];
};

export type SavedEnemyGroup = {
    groupId: string;
    name: string;
    sharedRoll: string;
    members: SavedCombatant[];
};

export type SavedOtherBlock = {
    groupId: string;
    name: string;
    blockType: CombatantBlockType;
    members: SavedCombatant[];
};

export type SavedOtherSide = {
    sideKey: string;
    name: string;
    blocks: SavedOtherBlock[];
};

export type SavedStandardRuntime = {
    currentHp: string;
    maxHp: string;
};

export type SavedKaijuAreaRuntime = {
    name: string;
    currentHp: string;
    maxHp: string;
    targetable: boolean;
};

export type SavedKaijuRuntime = {
    chaosCurrent: string;
    chaosMax: string;
    behaviourPhase: string;
    finishingTarget: string;
    finishingDamageThisTurn: string;
    areas: SavedKaijuAreaRuntime[];
};

export type SavedRunnerCombat = {
    standard: Record<string, SavedStandardRuntime>;
    kaiju: Record<string, SavedKaijuRuntime>;
};

export type SavedRulesCoreLink = Record<string, unknown> & {
    templateId: string;
};

export type SavedEncounter = {
    version: 1;
    savedAt: string;
    view: SavedView;
    campaignId: string | null;
    groupMode: "individual" | "average" | "shared";
    players: SavedCombatant[];
    enemyGroups: SavedEnemyGroup[];
    kaiju: SavedCombatant[];
    otherSides: SavedOtherSide[];
    preview: PreviewDetail | null;
    state: StateDetail | null;
    runnerCombat: SavedRunnerCombat;
    rulesCoreLinks: SavedRulesCoreLink[];
};

export type NamedEncounterSave = {
    id: string;
    name: string;
    savedAt: string;
    encounter: SavedEncounter;
};

export function allSavedCombatants(saved: SavedEncounter): SavedCombatant[] {
    return [
        ...saved.players,
        ...saved.enemyGroups.flatMap(group => group.members),
        ...saved.kaiju,
        ...saved.otherSides.flatMap(side =>
            side.blocks.flatMap(block => block.members))
    ];
}
