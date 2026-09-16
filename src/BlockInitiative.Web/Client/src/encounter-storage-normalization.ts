const encounterStorageKey = "dorks-and-dice:block-initiative:encounter:v1";

type StoredControl = {
    value?: unknown;
    checked?: unknown;
};

type StoredKaiju = {
    name?: unknown;
    initiative?: unknown;
    modifier?: unknown;
    controllerId?: unknown;
    rulesReference?: unknown;
    campaignCharacterId?: unknown;
    campaignId?: unknown;
    templateId?: unknown;
    instanceNumber?: unknown;
    autoName?: unknown;
    monsterMetaText?: unknown;
    setupAreaCount?: unknown;
    setupControls?: unknown;
    conditions?: unknown;
};

type StoredEncounter = {
    version?: unknown;
    view?: unknown;
    kaiju?: unknown;
    [key: string]: unknown;
};

export function normalizeStoredEncounterDefaults(): void {
    try {
        const raw = window.localStorage.getItem(encounterStorageKey);
        if (!raw) return;

        const parsed = JSON.parse(raw) as StoredEncounter;
        if (parsed.version !== 1 || parsed.view !== "setup" || !Array.isArray(parsed.kaiju)) return;

        const kaiju = parsed.kaiju.filter(combatant => !isBlankKaiju(combatant));
        if (kaiju.length === parsed.kaiju.length) return;

        window.localStorage.setItem(encounterStorageKey, JSON.stringify({
            ...parsed,
            kaiju
        }));
    } catch {
        // Invalid or unavailable browser storage should not block a fresh encounter.
    }
}

function isBlankKaiju(value: unknown): boolean {
    if (!isRecord(value)) return false;
    const kaiju = value as StoredKaiju;

    if (hasText(kaiju.name)
        || hasText(kaiju.initiative)
        || hasText(kaiju.modifier)
        || hasText(kaiju.controllerId)
        || hasText(kaiju.rulesReference)
        || hasText(kaiju.campaignCharacterId)
        || hasText(kaiju.campaignId)
        || hasText(kaiju.templateId)
        || hasText(kaiju.instanceNumber)
        || hasText(kaiju.autoName)
        || hasText(kaiju.monsterMetaText)) {
        return false;
    }

    if (typeof kaiju.setupAreaCount === "number" && kaiju.setupAreaCount > 0) return false;
    if (Array.isArray(kaiju.conditions) && kaiju.conditions.length > 0) return false;
    if (Array.isArray(kaiju.setupControls) && kaiju.setupControls.some(hasMeaningfulControlValue)) return false;

    return true;
}

function hasMeaningfulControlValue(value: unknown): boolean {
    if (!isRecord(value)) return true;
    const control = value as StoredControl;
    if (control.checked === true) return true;
    if (typeof control.value !== "string") return control.value !== null && control.value !== undefined;
    const normalized = control.value.trim().toLocaleLowerCase("en-US");
    return normalized !== "" && normalized !== "auto";
}

function hasText(value: unknown): boolean {
    return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
