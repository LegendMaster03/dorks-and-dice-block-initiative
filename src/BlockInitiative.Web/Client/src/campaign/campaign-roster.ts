export interface ExistingCampaignCombatant {
    campaignCharacterId: string | null;
    name: string;
}

export interface CampaignCharacterIdentity {
    characterId: string;
    name: string;
}

export function charactersMissingFromEncounter(
    existing: readonly ExistingCampaignCombatant[],
    campaignCharacters: readonly CampaignCharacterIdentity[]
): CampaignCharacterIdentity[] {
    const existingIds = new Set(
        existing
            .map(item => item.campaignCharacterId?.trim())
            .filter((id): id is string => Boolean(id))
    );
    const seenIds = new Set<string>();
    const missing: CampaignCharacterIdentity[] = [];

    for (const character of campaignCharacters) {
        const id = character.characterId.trim();
        const name = character.name.trim();
        if (!id || !name) continue;
        if (existingIds.has(id)
            || seenIds.has(id)) {
            continue;
        }

        seenIds.add(id);
        missing.push({ characterId: id, name });
    }

    return missing;
}
