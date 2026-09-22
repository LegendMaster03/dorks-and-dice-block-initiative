import {
    captureEncounter
} from "./persistence/encounter-capture";
import {
    EncounterChangeTracker,
    persistAutomaticEncounterIfChanged
} from "./persistence/encounter-change-tracker";
import {
    EncounterRestoreSession
} from "./persistence/encounter-restore";
import type {
    NamedEncounterSave,
    PreviewDetail,
    SavedEncounter,
    SavedRulesCoreLink,
    StateDetail
} from "./persistence/encounter-schema";
import {
    clearAutomaticEncounter,
    cloneRulesCoreLink,
    formatSavedAt,
    readAutomaticEncounter,
    readNamedEncounters,
    writeAutomaticEncounter,
    writeNamedEncounters
} from "./persistence/encounter-storage";
import { registerAfterRender } from "./render-lifecycle";

const saveDelayMs = 80;

let initialized = false;
let resetting = false;
let navigationReloading = false;
let autosaveSuspended = false;
let saveTimer: number | null = null;
let restoreSession: EncounterRestoreSession | null = null;
let changeTracker: EncounterChangeTracker | null = null;
let lastPreview: PreviewDetail | null = null;
let lastState: StateDetail | null = null;
const rulesCoreLinks = new Map<string, SavedRulesCoreLink>();

export function initializeEncounterPersistence(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    const savedEncounter = readAutomaticEncounter();
    if (savedEncounter) {
        lastPreview = savedEncounter.preview;
        lastState = savedEncounter.state;

        for (const detail of savedEncounter.rulesCoreLinks) {
            rulesCoreLinks.set(detail.templateId, detail);
        }

        restoreSession = createRestoreSession(root, savedEncounter);
    }

    changeTracker = new EncounterChangeTracker(
        savedEncounter ?? captureCurrentEncounter(root));

    root.addEventListener("input", () => scheduleSave(root));
    root.addEventListener("change", () => scheduleSave(root));
    root.addEventListener("click", () => scheduleSave(root));

    window.addEventListener("block-initiative:preview", event => {
        lastPreview =
            (event as CustomEvent<PreviewDetail>).detail ?? null;

        if (restoreSession) {
            restoreSession.handlePreview(lastPreview);
            return;
        }

        scheduleSave(root);
    });

    window.addEventListener("block-initiative:state", event => {
        lastState =
            (event as CustomEvent<StateDetail>).detail ?? null;

        if (restoreSession) {
            restoreSession.handleState(lastState);
            return;
        }

        scheduleSave(root);
    });

    window.addEventListener("block-initiative:api-error", event => {
        if (!restoreSession) return;

        const detail =
            (event as CustomEvent<{ error?: unknown }>).detail;
        restoreSession.handleApiFailure(
            detail?.error
            ?? new Error("Encounter restoration request failed."));
    });

    window.addEventListener(
        "block-initiative:combat-state-change",
        () => scheduleSave(root));

    window.addEventListener("block-initiative:campaign-change", () => scheduleSave(root));
    window.addEventListener("block-initiative:rules-core-template-link", event => {
        const cloned = cloneRulesCoreLink((event as CustomEvent<unknown>).detail);
        if (cloned) rulesCoreLinks.set(cloned.templateId, cloned);
        scheduleSave(root);
    });

    window.addEventListener("beforeunload", () => {
        if (!resetting
            && !navigationReloading
            && !autosaveSuspended
            && !restoreSession) {
            saveNow(root);
        }
    });

    registerAfterRender("encounter-persistence", 220, () => {
        ensurePersistenceBar(root);
        restoreSession?.ensureConditionLinks();
    });

    ensurePersistenceBar(root);
    if (restoreSession) {
        window.setTimeout(() => void restoreSession?.start(), 0);
    }
}

function ensurePersistenceBar(root: HTMLElement): void {
    const header = root.querySelector<HTMLElement>("header");
    if (!header || header.querySelector("[data-encounter-persistence-bar]")) return;

    const bar = document.createElement("div");
    bar.className = "bi-row";
    bar.dataset.encounterPersistenceBar = "true";

    const status = document.createElement("span");
    status.className = "bi-muted";
    status.dataset.encounterPersistenceStatus = "true";
    status.textContent = Boolean(restoreSession)
        ? "Restoring the saved encounter from this browser…"
        : "Encounter changes save automatically in this browser until you reset them.";

    const savedSelect = document.createElement("select");
    savedSelect.className = "form-select form-select-sm";
    savedSelect.dataset.role = "named-encounter-select";
    savedSelect.setAttribute("aria-label", "Named encounter saves");

    const saveCopy = document.createElement("button");
    saveCopy.type = "button";
    saveCopy.className = "btn btn-sm btn-outline-secondary";
    saveCopy.dataset.action = "save-named-encounter";
    saveCopy.textContent = "Save named copy";

    const load = document.createElement("button");
    load.type = "button";
    load.className = "btn btn-sm btn-outline-secondary";
    load.dataset.action = "load-named-encounter";
    load.textContent = "Load";
    load.disabled = true;

    const removeSaved = document.createElement("button");
    removeSaved.type = "button";
    removeSaved.className = "btn btn-sm btn-outline-secondary";
    removeSaved.dataset.action = "delete-named-encounter";
    removeSaved.textContent = "Delete";
    removeSaved.disabled = true;

    const refreshNamed = (selectedId = "") => {
        const saves = readNamedEncounters();
        savedSelect.replaceChildren(new Option("Saved encounters", ""));
        for (const saved of saves) {
            savedSelect.add(new Option(`${saved.name} — ${formatSavedAt(saved.savedAt)}`, saved.id));
        }
        if (selectedId && saves.some(saved => saved.id === selectedId)) savedSelect.value = selectedId;
        const hasSelection = Boolean(savedSelect.value);
        load.disabled = !hasSelection;
        removeSaved.disabled = !hasSelection;
    };

    savedSelect.onchange = () => {
        const hasSelection = Boolean(savedSelect.value);
        load.disabled = !hasSelection;
        removeSaved.disabled = !hasSelection;
    };

    saveCopy.onclick = () => {
        if (restoreSession) return;
        const defaultName = `Encounter ${new Date().toLocaleString()}`;
        const entered = window.prompt("Name this encounter save:", defaultName);
        const name = entered?.trim();
        if (!name) return;

        const encounter = captureCurrentEncounter(root);
        const saved: NamedEncounterSave = {
            id: crypto.randomUUID(),
            name,
            savedAt: encounter.savedAt,
            encounter
        };
        const saves = [saved, ...readNamedEncounters()];
        if (!writeNamedEncounters(saves)) {
            setPersistenceStatus(root, "Browser storage is full or unavailable, so the named encounter could not be saved.");
            return;
        }
        refreshNamed(saved.id);
        setPersistenceStatus(root, `Saved named encounter "${name}". Automatic recovery continues separately.`);
    };

    load.onclick = () => {
        const saved = readNamedEncounters().find(candidate => candidate.id === savedSelect.value);
        if (!saved) {
            refreshNamed();
            return;
        }
        if (!window.confirm(`Load "${saved.name}"? This replaces the current automatic recovery encounter in this browser.`)) return;
        if (!writeAutomaticEncounter(saved.encounter)) {
            setPersistenceStatus(
                root,
                "Browser storage is unavailable, so the named encounter can not be loaded.");
            return;
        }
        navigationReloading = true;
        if (saveTimer !== null) {
            window.clearTimeout(saveTimer);
            saveTimer = null;
        }
        window.location.reload();
    };

    removeSaved.onclick = () => {
        const saved = readNamedEncounters().find(candidate => candidate.id === savedSelect.value);
        if (!saved) {
            refreshNamed();
            return;
        }
        if (!window.confirm(`Delete the named encounter "${saved.name}"? The current automatic recovery encounter is not affected.`)) return;
        const remaining = readNamedEncounters().filter(candidate => candidate.id !== saved.id);
        if (!writeNamedEncounters(remaining)) {
            setPersistenceStatus(root, "Browser storage is unavailable, so the named encounter can not be deleted.");
            return;
        }
        refreshNamed();
        setPersistenceStatus(root, `Deleted named encounter "${saved.name}".`);
    };

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "btn btn-sm btn-outline-danger";
    reset.dataset.action = "reset-persisted-encounter";
    reset.textContent = "Reset encounter";
    reset.onclick = () => {
        if (!window.confirm("Reset this encounter? This clears the automatic recovery encounter from this browser and starts a blank encounter. Named saves are kept.")) return;
        resetting = true;
        if (saveTimer !== null) {
            window.clearTimeout(saveTimer);
            saveTimer = null;
        }

        try {
            clearAutomaticEncounter();
        } catch {
            resetting = false;
            setPersistenceStatus(
                root,
                "Browser storage is unavailable, so the automatic recovery encounter could not be cleared. The current encounter was not reset.");
            return;
        }

        window.dispatchEvent(
            new CustomEvent(
                "block-initiative:encounter-reset"));
        window.location.reload();
    };

    const actions = document.createElement("div");
    actions.className = "bi-actions";
    actions.append(savedSelect, saveCopy, load, removeSaved, reset);
    bar.append(status, actions);
    header.append(bar);
    refreshNamed();
}

function setPersistenceStatus(root: HTMLElement, text: string): void {
    const status = root.querySelector<HTMLElement>("[data-encounter-persistence-status]");
    if (status) status.textContent = text;
}

function scheduleSave(root: HTMLElement): void {
    if (resetting
        || navigationReloading
        || autosaveSuspended
        || restoreSession) {
        return;
    }
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
        saveTimer = null;
        saveNow(root);
    }, saveDelayMs);
}

function saveNow(root: HTMLElement): void {
    if (resetting
        || navigationReloading
        || autosaveSuspended
        || restoreSession) {
        return;
    }
    const snapshot = captureCurrentEncounter(root);
    changeTracker ??= new EncounterChangeTracker(snapshot);

    const result = persistAutomaticEncounterIfChanged(
        snapshot,
        changeTracker,
        writeAutomaticEncounter);
    if (result === "unchanged") return;

    if (result === "saved") {
        setPersistenceStatus(
            root,
            "Encounter saved in this browser. It will remain until you reset it.");
        return;
    }

    setPersistenceStatus(
        root,
        "Browser storage is unavailable, so this encounter can not be saved through reloads.");
}

function captureCurrentEncounter(root: HTMLElement): SavedEncounter {
    return captureEncounter(root, {
        lastPreview,
        lastState,
        rulesCoreLinks: rulesCoreLinks.values()
    });
}

function createRestoreSession(
    root: HTMLElement,
    saved: SavedEncounter
): EncounterRestoreSession {
    return new EncounterRestoreSession(root, saved, {
        onComplete: () => {
            restoreSession = null;
            autosaveSuspended = false;
            setPersistenceStatus(
                root,
                "Saved encounter restored. Changes continue saving until you reset it.");
        },
        onFailure: error => {
            restoreSession = null;
            autosaveSuspended = true;
            console.error(
                "Block Initiative could not restore the saved encounter.",
                error);
            setPersistenceStatus(
                root,
                "The saved encounter could not be fully restored. "
                    + "Automatic saving is paused to protect the stored snapshot. "
                    + "Reload to retry restoration or use Reset encounter to start over.");
        }
    });
}
