import type {
    NamedEncounterSave,
    SavedEncounter,
    SavedRulesCoreLink
} from "./encounter-schema";

const automaticStorageKey =
    "dorks-and-dice:block-initiative:encounter:v1";
const namedStorageKey =
    "dorks-and-dice:block-initiative:named-encounters:v1";

export function readAutomaticEncounter(): SavedEncounter | null {
    try {
        const raw = window.localStorage.getItem(automaticStorageKey);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as unknown;
        return isSavedEncounter(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function writeAutomaticEncounter(saved: SavedEncounter): boolean {
    try {
        window.localStorage.setItem(
            automaticStorageKey,
            JSON.stringify(saved));
        return true;
    } catch {
        return false;
    }
}

export function clearAutomaticEncounter(): void {
    window.localStorage.removeItem(automaticStorageKey);
}

export function readNamedEncounters(): NamedEncounterSave[] {
    try {
        const raw = window.localStorage.getItem(namedStorageKey);
        if (!raw) return [];

        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];

        return parsed
            .filter(isNamedEncounterSave)
            .sort((left, right) =>
                right.savedAt.localeCompare(left.savedAt));
    } catch {
        return [];
    }
}

export function writeNamedEncounters(
    saves: NamedEncounterSave[]
): boolean {
    try {
        window.localStorage.setItem(
            namedStorageKey,
            JSON.stringify(saves));
        return true;
    } catch {
        return false;
    }
}

export function cloneRulesCoreLink(
    value: unknown
): SavedRulesCoreLink | null {
    if (!value || typeof value !== "object") return null;

    const templateId =
        (value as { templateId?: unknown }).templateId;
    if (typeof templateId !== "string" || !templateId.trim()) {
        return null;
    }

    try {
        const cloned = JSON.parse(
            JSON.stringify(value)) as Record<string, unknown>;
        return {
            ...cloned,
            templateId: templateId.trim()
        };
    } catch {
        return null;
    }
}

export function formatSavedAt(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleString();
}

function isNamedEncounterSave(
    value: unknown
): value is NamedEncounterSave {
    if (!value || typeof value !== "object") return false;

    const candidate = value as Partial<NamedEncounterSave>;
    return typeof candidate.id === "string"
        && candidate.id.trim().length > 0
        && typeof candidate.name === "string"
        && candidate.name.trim().length > 0
        && typeof candidate.savedAt === "string"
        && isSavedEncounter(candidate.encounter);
}

function isSavedEncounter(
    value: unknown
): value is SavedEncounter {
    if (!value || typeof value !== "object") return false;

    const candidate = value as Partial<SavedEncounter>;
    return candidate.version === 1
        && typeof candidate.savedAt === "string"
        && (
            candidate.view === "setup"
            || candidate.view === "preview"
            || candidate.view === "running"
            || candidate.view === "editing"
        )
        && Array.isArray(candidate.players)
        && Array.isArray(candidate.enemyGroups)
        && Array.isArray(candidate.kaiju)
        && Array.isArray(candidate.otherSides)
        && Boolean(
            candidate.runnerCombat
            && typeof candidate.runnerCombat === "object")
        && Array.isArray(candidate.rulesCoreLinks);
}
