import type { SavedEncounter } from "./encounter-schema";

export type AutomaticEncounterSaveResult =
    "unchanged" | "saved" | "unavailable";

export class EncounterChangeTracker {
    private persistedFingerprint: string;

    public constructor(initialSnapshot: SavedEncounter) {
        this.persistedFingerprint =
            encounterFingerprint(initialSnapshot);
    }

    public hasMeaningfulChange(snapshot: SavedEncounter): boolean {
        return encounterFingerprint(snapshot)
            !== this.persistedFingerprint;
    }

    public markPersisted(snapshot: SavedEncounter): void {
        this.persistedFingerprint =
            encounterFingerprint(snapshot);
    }
}

export function persistAutomaticEncounterIfChanged(
    snapshot: SavedEncounter,
    tracker: EncounterChangeTracker,
    write: (snapshot: SavedEncounter) => boolean
): AutomaticEncounterSaveResult {
    if (!tracker.hasMeaningfulChange(snapshot)) {
        return "unchanged";
    }

    if (!write(snapshot)) {
        return "unavailable";
    }

    tracker.markPersisted(snapshot);
    return "saved";
}

function encounterFingerprint(snapshot: SavedEncounter): string {
    return JSON.stringify({
        ...snapshot,
        savedAt: ""
    });
}
