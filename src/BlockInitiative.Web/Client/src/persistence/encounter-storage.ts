import {
    normalizeSavedEncounter
} from "./encounter-migration";
import type {
    NamedEncounterSave,
    SavedEncounter,
    SavedRulesCoreLink
} from "./encounter-schema";

const automaticStorageKey =
    "dorks-and-dice:block-initiative:encounter:v2";
const legacyAutomaticStorageKey =
    "dorks-and-dice:block-initiative:encounter:v1";
const namedStorageKey =
    "dorks-and-dice:block-initiative:named-encounters:v2";
const legacyNamedStorageKey =
    "dorks-and-dice:block-initiative:named-encounters:v1";

export function readAutomaticEncounter(): SavedEncounter | null {
    try {
        const current =
            readSavedEncounterAt(automaticStorageKey);
        if (current) return current;

        const legacy =
            readSavedEncounterAt(
                legacyAutomaticStorageKey);
        if (!legacy) return null;

        writeAutomaticEncounter(legacy);
        return legacy;
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
    window.localStorage.removeItem(
        legacyAutomaticStorageKey);
}

export function readNamedEncounters():
    NamedEncounterSave[] {
    try {
        const current =
            readNamedEncountersAt(
                namedStorageKey);
        if (current.length > 0
            || window.localStorage.getItem(
                namedStorageKey) !== null) {
            return sortNamed(current);
        }

        const legacy =
            readNamedEncountersAt(
                legacyNamedStorageKey);
        if (legacy.length > 0) {
            writeNamedEncounters(legacy);
        }
        return sortNamed(legacy);
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
    const raw =
        window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    return normalizeSavedEncounter(parsed);
}

function readNamedEncountersAt(
    key: string
): NamedEncounterSave[] {
    const raw =
        window.localStorage.getItem(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap(rawSave => {
        const save =
            normalizeNamedEncounter(rawSave);
        return save ? [save] : [];
    });
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
