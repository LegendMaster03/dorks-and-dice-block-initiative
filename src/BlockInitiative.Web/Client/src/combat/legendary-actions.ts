import {
    mountEncounterCardState,
    removeEncounterCardState
} from "../encounter-card-renderer";
import { NON_NEGATIVE_TRACKER_LIMITS } from "../numeric-input-limits";
import { actionButton, numberField, textareaField } from "./combat-ui";
import type { PreviewCombatant } from "./combat-state-types";

/**
 * Optional action reference shared by Standard and Kaiju enemies.
 * No automatic round reset: legendary action timing and costs vary by ruleset.
 */
export type LegendaryActionsRuntimeMetadata = {
    notes: string;
    maxUses: number | null;
    remainingUses: number | null;
};

const states = new Map<string, LegendaryActionsRuntimeMetadata>();

export function pruneLegendaryActionStates(
    activeIds: ReadonlySet<string>
): void {
    for (const id of states.keys()) {
        if (!activeIds.has(id)) states.delete(id);
    }
}

export function readLegendaryActionRuntime(
    combatantId: string
): LegendaryActionsRuntimeMetadata | null {
    const state = states.get(combatantId);
    if (!state || (!state.notes && state.maxUses === null
        && state.remainingUses === null)) {
        return null;
    }
    return { ...state };
}

export function restoreLegendaryActionRuntime(
    combatantId: string,
    runtime: LegendaryActionsRuntimeMetadata,
    root: HTMLElement
): void {
    states.set(combatantId, { ...runtime });
    root.querySelector<HTMLElement>(
        `.bi-runner-member[data-combatant-id='${cssEscape(combatantId)}'] [data-card-state='legendary']`
    )?.remove();
}

export function syncLegendaryActionState(
    card: HTMLElement,
    combatant: PreviewCombatant
): void {
    if (combatant.allianceId === "players") {
        removeEncounterCardState(card, "legendary");
        return;
    }

    let panel = card.querySelector<HTMLElement>(
        ":scope > [data-card-slot='state'] > [data-card-state='legendary']"
    );
    if (!panel) {
        const state = states.get(combatant.id) ?? {
            notes: "",
            maxUses: null,
            remainingUses: null
        };
        states.set(combatant.id, state);
        panel = renderLegendaryActions(state);
    }
    mountEncounterCardState(card, "legendary", panel);
}

function renderLegendaryActions(
    state: LegendaryActionsRuntimeMetadata
): HTMLElement {
    const details = document.createElement("details");
    details.className = "bi-legendary-actions";
    const summary = document.createElement("summary");
    summary.textContent = "Legendary Actions";
    const note = document.createElement("div");
    note.className = "bi-note";
    note.textContent = "Optional manual reference and resource tracking. Reset uses when appropriate for this creature and ruleset.";
    const actions = textareaField(
        "Action descriptions and costs",
        state.notes,
        value => {
            state.notes = value;
            notifyChanged();
        });
    const uses = document.createElement("div");
    uses.className = "bi-combat-controls";
    uses.append(
        numberField("Maximum uses", state.maxUses, value => {
            const oldMax = state.maxUses;
            state.maxUses = value;
            if (state.remainingUses === null
                || state.remainingUses === oldMax) {
                state.remainingUses = value;
            }
            notifyChanged();
        }, undefined, NON_NEGATIVE_TRACKER_LIMITS),
        numberField("Uses remaining", state.remainingUses, value => {
            state.remainingUses = value;
            notifyChanged();
        }, undefined, NON_NEGATIVE_TRACKER_LIMITS)
    );
    const useOne = actionButton("Use 1", "btn-outline-secondary", () => {
        state.remainingUses = Math.max(0, (state.remainingUses ?? 0) - 1);
        notifyChanged();
        syncUseFields(details, state);
    });
    const reset = actionButton("Reset uses", "btn-outline-secondary", () => {
        state.remainingUses = state.maxUses;
        notifyChanged();
        syncUseFields(details, state);
    });
    uses.append(useOne, reset);
    details.append(summary, note, actions, uses);
    return details;
}

function syncUseFields(
    container: HTMLElement,
    state: LegendaryActionsRuntimeMetadata
): void {
    for (const field of container.querySelectorAll<HTMLElement>(".bi-field")) {
        if (field.querySelector("label")?.textContent !== "Uses remaining") continue;
        const input = field.querySelector<HTMLInputElement>("input");
        if (input) input.value = state.remainingUses === null
            ? "" : String(state.remainingUses);
    }
}

function notifyChanged(): void {
    window.dispatchEvent(new CustomEvent("block-initiative:combat-state-change"));
}

function cssEscape(value: string): string {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
        return CSS.escape(value);
    }
    return value.replace(/[\\'"\]\[]/g, match => `\\${match}`);
}
