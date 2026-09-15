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
    const existingNames = new Set(
        existing
            .map(item => normalizeName(item.name))
            .filter(Boolean)
    );

    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const missing: CampaignCharacterIdentity[] = [];

    for (const character of campaignCharacters) {
        const id = character.characterId.trim();
        const name = character.name.trim();
        const normalizedName = normalizeName(name);
        if (!id || !name) continue;
        if (existingIds.has(id) || existingNames.has(normalizedName)) continue;
        if (seenIds.has(id) || seenNames.has(normalizedName)) continue;

        seenIds.add(id);
        seenNames.add(normalizedName);
        missing.push({ characterId: id, name });
    }

    return missing;
}

function normalizeName(value: string): string {
    return value.trim().toLocaleLowerCase("en-US");
}
