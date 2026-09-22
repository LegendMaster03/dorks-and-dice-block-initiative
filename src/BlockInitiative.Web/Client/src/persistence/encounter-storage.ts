import {
    normalizeSavedEncounter
} from "./encounter-migration";
import type {
    NamedEncounterSave,
    SavedEncounter,
    SavedRulesCoreLink
} from "./encounter-schema";

const automaticStorageKey =
    "dorks-and-dice:block-initiative:encounter:v4";
const legacyAutomaticStorageKeys = [
    "dorks-and-dice:block-initiative:encounter:v3",
    "dorks-and-dice:block-initiative:encounter:v2",
    "dorks-and-dice:block-initiative:encounter:v1"
] as const;
const namedStorageKey =
    "dorks-and-dice:block-initiative:named-encounters:v4";
const legacyNamedStorageKeys = [
    "dorks-and-dice:block-initiative:named-encounters:v3",
    "dorks-and-dice:block-initiative:named-encounters:v2",
    "dorks-and-dice:block-initiative:named-encounters:v1"
] as const;

export function readAutomaticEncounter(): SavedEncounter | null {
    try {
        const currentRaw =
            window.localStorage.getItem(
                automaticStorageKey);
        if (currentRaw !== null) {
            const current =
                readSavedEncounterAt(
                    automaticStorageKey);
            if (current) return current;
        }

        for (const key of legacyAutomaticStorageKeys) {
            const legacy =
                readSavedEncounterAt(key);
            if (!legacy) continue;
            if (writeAutomaticEncounter(legacy)) {
                window.localStorage.removeItem(key);
            }
            return legacy;
        }

        return null;
    } catch {
        return null;
    }
}

export function writeAutomaticEncounter(
    saved: SavedEncounter
): boolean {
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
    window.localStorage.removeItem(
        automaticStorageKey);
    for (const key of legacyAutomaticStorageKeys) {
        window.localStorage.removeItem(key);
    }
}

export function readNamedEncounters():
    NamedEncounterSave[] {
    try {
        const currentRaw =
            window.localStorage.getItem(
                namedStorageKey);
        if (currentRaw !== null) {
            const current =
                readNamedEncountersAt(
                    namedStorageKey);
            if (current !== null) {
                return sortNamed(current);
            }
        }

        for (const key of legacyNamedStorageKeys) {
            const legacy =
                readNamedEncountersAt(key);
            if (!legacy?.length) continue;
            if (writeNamedEncounters(legacy)) {
                window.localStorage.removeItem(key);
            }
            return sortNamed(legacy);
        }

        return [];
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
    if (!value || typeof value !== "object") {
        return null;
    }

    const templateId =
        (value as { templateId?: unknown })
            .templateId;
    if (typeof templateId !== "string"
        || !templateId.trim()) {
        return null;
    }

    try {
        const cloned = JSON.parse(
            JSON.stringify(value)
        ) as Record<string, unknown>;
        return {
            ...cloned,
            templateId: templateId.trim()
        };
    } catch {
        return null;
    }
}

export function formatSavedAt(
    value: string
): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleString();
}

function readSavedEncounterAt(
    key: string
): SavedEncounter | null {
    try {
        const raw =
            window.localStorage.getItem(key);
        if (!raw) return null;

        const parsed =
            JSON.parse(raw) as unknown;
        return normalizeSavedEncounter(parsed);
    } catch {
        return null;
    }
}

function readNamedEncountersAt(
    key: string
): NamedEncounterSave[] | null {
    try {
        const raw =
            window.localStorage.getItem(key);
        if (!raw) return null;

        const parsed =
            JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return null;

        return parsed.flatMap(rawSave => {
            const save =
                normalizeNamedEncounter(rawSave);
            return save ? [save] : [];
        });
    } catch {
        return null;
    }
}

function normalizeNamedEncounter(
    value: unknown
): NamedEncounterSave | null {
    if (!value
        || typeof value !== "object") {
        return null;
    }

    const candidate =
        value as Partial<NamedEncounterSave>;
    if (typeof candidate.id !== "string"
        || !candidate.id.trim()
        || typeof candidate.name !== "string"
        || !candidate.name.trim()
        || typeof candidate.savedAt !== "string") {
        return null;
    }

    const encounter =
        normalizeSavedEncounter(
            candidate.encounter);
    if (!encounter) return null;

    return {
        id: candidate.id,
        name: candidate.name,
        savedAt: candidate.savedAt,
        encounter
    };
}

function sortNamed(
    saves: NamedEncounterSave[]
): NamedEncounterSave[] {
    return [...saves].sort(
        (left, right) =>
            right.savedAt.localeCompare(
                left.savedAt));
}
