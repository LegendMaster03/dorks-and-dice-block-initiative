import {
    mountEncounterCardState,
    removeEncounterCardState
} from "../encounter-card-renderer";
import {
    actionButton,
    amountField,
    numberField,
    statusBadge
} from "./combat-ui";
import type { PreviewCombatant } from "./combat-state-types";

type StandardState = {
    maxHp: number | null;
    currentHp: number | null;
};

const standardStates = new Map<string, StandardState>();

export function clearStandardCombatState(combatantId: string): void {
    standardStates.delete(combatantId);
}

export function ensureStandardCombatSetup(
    card: HTMLElement,
    combatantId: string
): void {
    if (card.querySelector("[data-combat-setup='standard']")) return;
    card.querySelector("[data-combat-setup]")?.remove();

    const state = standardStates.get(combatantId) ?? {
        maxHp: null,
        currentHp: null
    };
    standardStates.set(combatantId, state);

    const panel = document.createElement("section");
    panel.className = "bi-combat-config";
    panel.dataset.combatSetup = "standard";
    panel.innerHTML = `<strong>Enemy health</strong><div class="bi-note">Optional during setup; available throughout encounter tracking.</div><div class="bi-combat-grid mt-2"></div>`;

    const grid = panel.querySelector<HTMLElement>(".bi-combat-grid")!;
    grid.append(
        numberField("Max HP", state.maxHp, value => {
            const oldMax = state.maxHp;
            state.maxHp = value;
            if (state.currentHp === null || state.currentHp === oldMax) {
                state.currentHp = value;
            }
        }, "max-hp"),
        numberField(
            "Current HP",
            state.currentHp,
            value => { state.currentHp = value; },
            "current-hp")
    );
    card.append(panel);
}

export function syncStandardCombatState(
    card: HTMLElement,
    combatant: PreviewCombatant,
    isActive: boolean
): void {
    const usesStandardHealth =
        combatant.allianceId !== "players"
        && combatant.blockType === "standard";

    if (!usesStandardHealth) {
        removeEncounterCardState(card, "health");
        return;
    }

    let healthRow = card.querySelector<HTMLElement>(
        ":scope > [data-card-slot='state'] > [data-card-state='health']"
    );
    if (!healthRow) {
        healthRow = renderHealthRow(combatant, isActive);
        healthRow.classList.add("bi-integrated-health");
    } else {
        healthRow.classList.toggle("active", isActive);
    }

    mountEncounterCardState(card, "health", healthRow);
}

function renderHealthRow(
    combatant: PreviewCombatant,
    active: boolean
): HTMLElement {
    const state = standardStates.get(combatant.id) ?? {
        maxHp: null,
        currentHp: null
    };
    standardStates.set(combatant.id, state);

    const row = document.createElement("article");
    row.className = `bi-health-row${active ? " active" : ""}`;
    row.dataset.combatantId = combatant.id;

    const head = document.createElement("div");
    head.className = "bi-row";
    const name = document.createElement("strong");
    name.textContent = combatant.name;
    const status = document.createElement("div");
    status.className = "bi-statuses";
    paintHpStatus(status, state);
    head.append(name, status);
    row.append(head);

    const controls = document.createElement("div");
    controls.className = "bi-combat-controls";
    controls.append(
        numberField("Current HP", state.currentHp, value => {
            state.currentHp = value;
            paintHpStatus(status, state);
        }, "current-hp"),
        numberField("Max HP", state.maxHp, value => {
            state.maxHp = value;
            if (state.currentHp === null) state.currentHp = value;
            paintHpStatus(status, state);
        }, "max-hp")
    );

    const amount = amountField();
    controls.append(
        amount.wrapper,
        actionButton("Damage", "btn-outline-secondary", () => {
            state.currentHp = Math.max(
                0,
                (state.currentHp ?? state.maxHp ?? 0) - amount.value());
            paintHpStatus(status, state);
        }),
        actionButton("Heal", "btn-outline-secondary", () => {
            const next = (state.currentHp ?? 0) + amount.value();
            state.currentHp = state.maxHp === null
                ? next
                : Math.min(next, state.maxHp);
            paintHpStatus(status, state);
        })
    );

    row.append(controls);
    return row;
}

function paintHpStatus(
    container: HTMLElement,
    state: StandardState
): void {
    container.replaceChildren();

    const current = state.currentHp ?? state.maxHp;
    if (current === null) {
        container.append(statusBadge("HP not configured"));
        return;
    }

    container.append(statusBadge(
        state.maxHp === null ? `HP ${current}` : `HP ${current} / ${state.maxHp}`,
        current <= 0));

    if (current <= 0) container.append(statusBadge("0 HP", true));
}
