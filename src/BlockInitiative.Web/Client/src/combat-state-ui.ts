import {
    clearKaijuCombatState,
    ensureKaijuCombatSetup,
    initializeKaijuCombatState,
    pruneKaijuCombatStates,
    setKaijuCombatTurn,
    syncKaijuCombatState
} from "./combat/kaiju-combat-state";
import {
    activeCombatantIds
} from "./combat/combat-state-types";
import type {
    PreviewDetail,
    TurnStateDetail
} from "./combat/combat-state-types";
import {
    findRunnerCard,
    installCombatStateStyles
} from "./combat/combat-ui";
import {
    clearStandardCombatState,
    ensureStandardCombatSetup,
    pruneStandardCombatStates,
    syncStandardCombatState
} from "./combat/standard-combat-state";
import {
    registerAfterRender,
    requestEnhancement
} from "./render-lifecycle";

let lastPreview: PreviewDetail | null = null;
let lastTurnState: TurnStateDetail | null = null;
let initialized = false;

/**
 * Coordinates combat-state modules without owning their implementation.
 *
 * Standard and Kaiju combat state are independent modules. This coordinator
 * routes setup/runner lifecycle events to the appropriate module.
 */
export function initializeCombatStateUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    installCombatStateStyles(root);
    initializeKaijuCombatState(root);

    window.addEventListener("block-initiative:preview", event => {
        lastPreview = (event as CustomEvent<PreviewDetail>).detail;
        requestEnhancement();
    });

    window.addEventListener("block-initiative:state", event => {
        lastTurnState = (event as CustomEvent<TurnStateDetail>).detail;
        const activeBlock =
            lastTurnState.response.blocks.find(
                block =>
                    block.id
                    === lastTurnState.response.activeBlockId);
        const turnAnchor =
            lastTurnState.request?.advanceCount === 0
            && lastTurnState.request
                .resumeActiveCombatantId
                ? lastTurnState.request
                    .resumeActiveCombatantId
                : activeBlock?.memberOrder[0] ?? null;

        setKaijuCombatTurn(
            lastTurnState.response.round,
            turnAnchor,
            root);
        requestEnhancement();
    });

    registerAfterRender("combat-state", 30, () => {
        enhanceCombatSetup(root);
        syncRunnerCombatState(root);
    });
}

function enhanceCombatSetup(root: HTMLElement): void {
    const cards = Array.from(
        root.querySelectorAll<HTMLElement>(".bi-entry[data-id]"));
    const activeIds = new Set(
        cards
            .map(card => card.dataset.id ?? "")
            .filter(Boolean));
    pruneStandardCombatStates(activeIds);
    pruneKaijuCombatStates(activeIds);

    for (const card of cards) {
        const combatantId = card.dataset.id;
        const typeSelect =
            card.querySelector<HTMLSelectElement>("[data-field='block-type']");
        if (!combatantId || !typeSelect) continue;

        installBlockTypeListener(card, typeSelect);

        if (typeSelect.value === "kaiju") {
            clearStandardCombatState(combatantId);
            ensureKaijuCombatSetup(card, combatantId, root);
            continue;
        }

        if ((card.dataset.alliance ?? "") !== "players") {
            clearKaijuCombatState(combatantId);
            ensureStandardCombatSetup(card, combatantId);
            continue;
        }

        card.querySelector("[data-combat-setup]")?.remove();
    }
}

function installBlockTypeListener(
    card: HTMLElement,
    typeSelect: HTMLSelectElement
): void {
    if (typeSelect.dataset.combatListener === "true") return;

    typeSelect.dataset.combatListener = "true";
    typeSelect.addEventListener("change", () => {
        card.querySelector("[data-combat-setup]")?.remove();
        requestEnhancement();
    });
}

function syncRunnerCombatState(root: HTMLElement): void {
    if (!lastPreview || !lastTurnState) return;

    const activeCombatants = activeCombatantIds(lastTurnState);
    for (const combatant of lastPreview.response.orderedCombatants) {
        const card = findRunnerCard(root, combatant.id);
        if (!card) continue;

        const isActive = activeCombatants.has(combatant.id);
        syncStandardCombatState(card, combatant, isActive);
        syncKaijuCombatState(root, card, combatant, isActive);
    }
}
