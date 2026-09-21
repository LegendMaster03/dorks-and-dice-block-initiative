import {
    mountEncounterCardState,
    removeEncounterCardState
} from "../encounter-card-renderer";
import { requestEnhancement } from "../render-lifecycle";
import {
    actionButton,
    amountField,
    checkField,
    findRunnerCard,
    numberField,
    overrideBool,
    overrideField,
    statusBadge,
    textField
} from "./combat-ui";
import type { OverrideValue } from "./combat-ui";
import type { PreviewCombatant } from "./combat-state-types";

type AreaState = {
    id: string;
    name: string;
    maxHp: number | null;
    currentHp: number | null;
    targetable: boolean;
    exploitedOverride: OverrideValue;
};

type KaijuState = {
    chaosMax: number | null;
    chaosCurrent: number | null;
    finishingBlowTarget: number | null;
    finishingBlowDamageThisTurn: number;
    behaviourPhase: string;
    areas: AreaState[];
    rampageOverride: OverrideValue;
    deathThroesOverride: OverrideValue;
    defeatedOverride: OverrideValue;
    defeatedRound: number | null;
};

type KaijuEvaluation = {
    rampageActive: boolean;
    deathThroesActive: boolean;
    finishingBlowReady: boolean;
    finishingBlowMet: boolean;
    defeated: boolean;
    vulnerableAreas: Array<{ id: string; exploited: boolean }>;
};

const kaijuStates = new Map<string, KaijuState>();
const evaluations = new Map<string, KaijuEvaluation>();
const evaluating = new Set<string>();

let evaluateUrl: Promise<string> | null = null;
let currentRound: number | null = null;

export function initializeKaijuCombatState(root: HTMLElement): void {
    evaluateUrl ??= resolveEvaluateUrl(root);
}

export function setKaijuCombatRound(round: number): void {
    currentRound = round;
}

export function clearKaijuCombatState(combatantId: string): void {
    kaijuStates.delete(combatantId);
    evaluations.delete(combatantId);
    evaluating.delete(combatantId);
}

export function ensureKaijuCombatSetup(
    card: HTMLElement,
    combatantId: string,
    root: HTMLElement
): void {
    if (card.querySelector("[data-combat-setup='kaiju']")) return;
    card.querySelector("[data-combat-setup]")?.remove();

    const state = kaijuStates.get(combatantId) ?? newKaijuState();
    kaijuStates.set(combatantId, state);

    const panel = document.createElement("section");
    panel.className = "bi-combat-config";
    panel.dataset.combatSetup = "kaiju";
    panel.innerHTML = `
<div><strong>Kaiju battle state</strong><div class="bi-note">Kaiju use a Chaos Threshold and separate Vulnerable Area HP pools instead of normal HP.</div><div class="bi-note">Kaiju Fighting rules by Loot Tavern — <a href="https://www.patreon.com/posts/ryokos-kaiju-to-141132181" target="_blank" rel="noopener noreferrer">view the official Kaiju Fighting Lite rules</a>.</div></div>
<div class="bi-combat-grid three mt-2" data-role="kaiju-basics"></div>
<div class="bi-field mt-2"><label>Current behaviour / phase</label><input data-field="behaviour-phase" placeholder="Record the active Behaviour or phase"></div>
<div class="bi-row mt-3"><div><strong>Vulnerable Areas <span class="bi-muted">(weak points)</span></strong><div class="bi-note">Each has its own HP and can become targetable as Behaviours change.</div></div><button type="button" class="btn btn-sm btn-outline-secondary" data-action="add-area">+ Area</button></div>
<div class="bi-area-list" data-role="setup-areas"></div>
<details><summary>DM state overrides</summary><div class="bi-combat-grid three mt-2" data-role="overrides"></div></details>`;

    const basics = panel.querySelector<HTMLElement>("[data-role='kaiju-basics']")!;
    basics.append(
        numberField("Chaos Threshold", state.chaosMax, value => {
            const oldMax = state.chaosMax;
            state.chaosMax = value;
            if (state.chaosCurrent === null || state.chaosCurrent === oldMax) {
                state.chaosCurrent = value;
            }
            void evaluateKaiju(combatantId, state, root, false);
        }),
        numberField("Current Chaos", state.chaosCurrent, value => {
            state.chaosCurrent = value;
            void evaluateKaiju(combatantId, state, root, false);
        }),
        numberField("Finishing Blow", state.finishingBlowTarget, value => {
            state.finishingBlowTarget = value;
            void evaluateKaiju(combatantId, state, root, false);
        })
    );

    const phase = panel.querySelector<HTMLInputElement>("[data-field='behaviour-phase']")!;
    phase.value = state.behaviourPhase;
    phase.addEventListener("change", () => {
        state.behaviourPhase = phase.value.trim();
    });

    const overrides = panel.querySelector<HTMLElement>("[data-role='overrides']")!;
    overrides.append(
        overrideField("Rampage", state.rampageOverride, value => {
            state.rampageOverride = value;
            void evaluateKaiju(combatantId, state, root, false);
        }),
        overrideField("Death Throes", state.deathThroesOverride, value => {
            state.deathThroesOverride = value;
            void evaluateKaiju(combatantId, state, root, false);
        }),
        overrideField("Defeated", state.defeatedOverride, value => {
            state.defeatedOverride = value;
            void evaluateKaiju(combatantId, state, root, false);
        })
    );

    const areaList = panel.querySelector<HTMLElement>("[data-role='setup-areas']")!;
    const renderAreas = () =>
        renderSetupAreas(areaList, state, combatantId, root, renderAreas);

    panel.querySelector<HTMLButtonElement>("[data-action='add-area']")!.onclick = () => {
        state.areas.push(newArea(state.areas.length + 1));
        renderAreas();
    };

    renderAreas();
    card.append(panel);
    void evaluateKaiju(combatantId, state, root, false);
}

export function syncKaijuCombatState(
    root: HTMLElement,
    card: HTMLElement,
    combatant: PreviewCombatant,
    isActive: boolean
): void {
    if (combatant.blockType !== "kaiju") {
        removeEncounterCardState(card, "kaiju");
        return;
    }

    const state = kaijuStates.get(combatant.id) ?? newKaijuState();
    kaijuStates.set(combatant.id, state);

    let panel = card.querySelector<HTMLElement>(
        ":scope > [data-card-slot='state'] > [data-card-state='kaiju']"
    );

    if (!panel) {
        panel = renderKaiju(
            combatant.id,
            combatant.name,
            state,
            isActive,
            root);
        panel.classList.add("bi-integrated-kaiju");
    } else {
        panel.classList.toggle("active", isActive);
    }

    mountEncounterCardState(card, "kaiju", panel);

    if (canEvaluateKaiju(state)
        && !evaluations.has(combatant.id)
        && !evaluating.has(combatant.id)) {
        void evaluateKaiju(combatant.id, state, root, true);
    }
}

function renderSetupAreas(
    list: HTMLElement,
    state: KaijuState,
    kaijuId: string,
    root: HTMLElement,
    rerender: () => void
): void {
    list.replaceChildren();

    for (const area of state.areas) {
        const row = document.createElement("article");
        row.className = "bi-area-row";
        row.innerHTML =
            `<div class="bi-combat-grid three"></div><div class="bi-combat-controls"></div>`;

        const grid = row.querySelector<HTMLElement>(".bi-combat-grid")!;
        grid.append(
            textField("Name", area.name, value => {
                area.name = value || "Vulnerable Area";
                void evaluateKaiju(kaijuId, state, root, false);
            }),
            numberField("Max HP", area.maxHp, value => {
                const oldMax = area.maxHp;
                area.maxHp = value;
                if (area.currentHp === null || area.currentHp === oldMax) {
                    area.currentHp = value;
                }
                void evaluateKaiju(kaijuId, state, root, false);
            }),
            numberField("Current HP", area.currentHp, value => {
                area.currentHp = value;
                void evaluateKaiju(kaijuId, state, root, false);
            })
        );

        const controls = row.querySelector<HTMLElement>(".bi-combat-controls")!;
        controls.append(
            checkField("Targetable now", area.targetable, value => {
                area.targetable = value;
                void evaluateKaiju(kaijuId, state, root, false);
            }),
            overrideField("Exploited", area.exploitedOverride, value => {
                area.exploitedOverride = value;
                void evaluateKaiju(kaijuId, state, root, false);
            }),
            actionButton("Remove", "btn-outline-danger", () => {
                state.areas = state.areas.filter(
                    candidate => candidate.id !== area.id);
                rerender();
                void evaluateKaiju(kaijuId, state, root, false);
            })
        );

        list.append(row);
    }

    requestEnhancement();
}

function renderKaiju(
    id: string,
    name: string,
    state: KaijuState,
    active: boolean,
    root: HTMLElement
): HTMLElement {
    const panel = document.createElement("section");
    panel.className = `bi-kaiju-panel bi-grid${active ? " active" : ""}`;
    panel.dataset.combatantId = id;

    const evaluation = evaluations.get(id);

    const head = document.createElement("div");
    head.className = "bi-row";

    const title = document.createElement("div");
    const heading = document.createElement("h5");
    heading.className = "h6 mb-1";
    heading.textContent = name;

    const phase = document.createElement("div");
    phase.className = "bi-muted";
    phase.textContent = state.behaviourPhase
        ? `Behaviour / phase: ${state.behaviourPhase}`
        : "Behaviour / phase not recorded";

    const source = document.createElement("div");
    source.className = "bi-note";
    source.innerHTML =
        `Kaiju Fighting rules by Loot Tavern — <a href="https://www.patreon.com/posts/ryokos-kaiju-to-141132181" target="_blank" rel="noopener noreferrer">view the official Kaiju Fighting Lite rules</a>.`;

    title.append(heading, phase, source);

    const statuses = document.createElement("div");
    statuses.className = "bi-statuses";
    paintKaijuStatuses(statuses, evaluation);
    head.append(title, statuses);
    panel.append(head);

    const chaos = document.createElement("section");
    chaos.innerHTML =
        `<strong>Chaos Threshold</strong><div class="bi-note">Damage outside a Vulnerable Area reduces this pool. Reaching 0 normally triggers Rampage.</div>`;

    const meter = document.createElement("div");
    meter.className = "bi-chaos";
    const fill = document.createElement("span");
    fill.style.width = `${chaosPercent(state)}%`;
    meter.append(fill);
    chaos.append(meter);

    const chaosControls = document.createElement("div");
    chaosControls.className = "bi-combat-controls";
    chaosControls.append(
        numberField("Current", state.chaosCurrent, value => {
            state.chaosCurrent = value;
            void evaluateKaiju(id, state, root, true);
        }),
        numberField("Maximum", state.chaosMax, value => {
            state.chaosMax = value;
            if (state.chaosCurrent === null) state.chaosCurrent = value;
            void evaluateKaiju(id, state, root, true);
        })
    );

    const chaosAmount = amountField();
    chaosControls.append(
        chaosAmount.wrapper,
        actionButton("Damage", "btn-outline-secondary", () => {
            state.chaosCurrent =
                (state.chaosCurrent ?? state.chaosMax ?? 0) - chaosAmount.value();
            void evaluateKaiju(id, state, root, true);
        }),
        actionButton("Restore", "btn-outline-secondary", () => {
            const next = (state.chaosCurrent ?? 0) + chaosAmount.value();
            state.chaosCurrent = state.chaosMax === null
                ? next
                : Math.min(next, state.chaosMax);
            void evaluateKaiju(id, state, root, true);
        })
    );

    chaos.append(chaosControls);
    panel.append(chaos);

    panel.append(textField(
        "Current behaviour / phase",
        state.behaviourPhase,
        value => { state.behaviourPhase = value; }));

    const areaSection = document.createElement("section");
    areaSection.innerHTML =
        `<strong>Vulnerable Areas</strong><div class="bi-note">Weak points have separate HP pools and can become targetable as Behaviours change.</div>`;

    const areaList = document.createElement("div");
    areaList.className = "bi-area-list";

    for (const area of state.areas) {
        const derived = evaluation?.vulnerableAreas.find(
            candidate => candidate.id === area.id);

        const row = document.createElement("article");
        row.className = "bi-area-row";

        const rowHead = document.createElement("div");
        rowHead.className = "bi-row";
        const areaName = document.createElement("strong");
        areaName.textContent = area.name;

        const flags = document.createElement("div");
        flags.className = "bi-statuses";
        flags.append(statusBadge(
            area.targetable ? "Targetable" : "Not targetable"));
        if (derived?.exploited) flags.append(statusBadge("Exploited", true));

        rowHead.append(areaName, flags);
        row.append(rowHead);

        const controls = document.createElement("div");
        controls.className = "bi-combat-controls";
        controls.append(
            numberField("Current HP", area.currentHp, value => {
                area.currentHp = value;
                void evaluateKaiju(id, state, root, true);
            }),
            numberField("Max HP", area.maxHp, value => {
                area.maxHp = value;
                if (area.currentHp === null) area.currentHp = value;
                void evaluateKaiju(id, state, root, true);
            })
        );

        const amount = amountField();
        controls.append(
            amount.wrapper,
            actionButton("Apply damage", "btn-outline-secondary", () => {
                area.currentHp = Math.max(
                    0,
                    (area.currentHp ?? area.maxHp ?? 0) - amount.value());
                void evaluateKaiju(id, state, root, true);
            }),
            checkField("Targetable", area.targetable, value => {
                area.targetable = value;
                void evaluateKaiju(id, state, root, true);
            })
        );

        row.append(controls);
        areaList.append(row);
    }

    areaSection.append(areaList);
    panel.append(areaSection);

    if (evaluation?.deathThroesActive || state.deathThroesOverride === "on") {
        const finishing = document.createElement("section");
        finishing.innerHTML =
            `<strong>Finishing Blow</strong><div class="bi-note">During Death Throes, record damage dealt in one turn against the stat block's Finishing Blow value.</div>`;

        const controls = document.createElement("div");
        controls.className = "bi-combat-controls";
        controls.append(
            numberField("Target", state.finishingBlowTarget, value => {
                state.finishingBlowTarget = value;
                void evaluateKaiju(id, state, root, true);
            }),
            numberField(
                "Damage this turn",
                state.finishingBlowDamageThisTurn,
                value => {
                    state.finishingBlowDamageThisTurn = value ?? 0;
                    void evaluateKaiju(id, state, root, true);
                }),
            actionButton("Reset turn damage", "btn-outline-secondary", () => {
                state.finishingBlowDamageThisTurn = 0;
                void evaluateKaiju(id, state, root, true);
            })
        );

        finishing.append(controls);
        panel.append(finishing);
    }

    if (evaluation?.defeated) {
        if (state.defeatedRound === null && currentRound !== null) {
            state.defeatedRound = currentRound;
        }

        const note = document.createElement("div");
        note.className = "bi-message bi-warning";
        note.textContent = state.defeatedRound === null
            ? "Kaiju defeated. Resolve its Death Rattle on initiative count 20 of the following round when applicable."
            : `Kaiju defeated in round ${state.defeatedRound}. Death Rattle is due on initiative count 20 of round ${state.defeatedRound + 1} when applicable.`;
        panel.append(note);
    }

    return panel;
}

async function evaluateKaiju(
    id: string,
    state: KaijuState,
    root: HTMLElement,
    refreshCardAfterEvaluation: boolean
): Promise<void> {
    if (evaluating.has(id)) return;

    if (!canEvaluateKaiju(state)) {
        evaluations.delete(id);
        if (refreshCardAfterEvaluation) requestKaijuCardRefresh(root, id);
        return;
    }

    evaluating.add(id);
    try {
        const url = await evaluateUrl;
        if (!url) return;

        const response = await fetch(url, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json"
            },
            body: JSON.stringify({
                chaosThresholdCurrent: Math.trunc(state.chaosCurrent),
                finishingBlowTarget:
                    state.finishingBlowTarget === null
                        ? null
                        : Math.trunc(state.finishingBlowTarget),
                finishingBlowDamageThisTurn:
                    Math.trunc(state.finishingBlowDamageThisTurn),
                vulnerableAreas: state.areas.map(area => ({
                    id: area.id,
                    name: area.name,
                    currentHitPoints: Math.trunc(area.currentHp ?? 0),
                    targetable: area.targetable,
                    exploitedOverride: overrideBool(area.exploitedOverride)
                })),
                rampageOverride: overrideBool(state.rampageOverride),
                deathThroesOverride: overrideBool(state.deathThroesOverride),
                defeatedOverride: overrideBool(state.defeatedOverride)
            })
        });

        if (!response.ok) {
            evaluations.delete(id);
            return;
        }

        const evaluation = await response.json() as KaijuEvaluation;
        evaluations.set(id, evaluation);

        if (evaluation.defeated
            && state.defeatedRound === null
            && currentRound !== null) {
            state.defeatedRound = currentRound;
        }
    } catch {
        evaluations.delete(id);
    } finally {
        evaluating.delete(id);
        if (refreshCardAfterEvaluation) requestKaijuCardRefresh(root, id);
    }
}

function requestKaijuCardRefresh(
    root: HTMLElement,
    combatantId: string
): void {
    queueMicrotask(() => {
        findRunnerCard(root, combatantId)
            ?.querySelector<HTMLElement>(
                ":scope > [data-card-slot='state'] > [data-card-state='kaiju']"
            )
            ?.remove();
        requestEnhancement();
    });
}

function canEvaluateKaiju(
    state: KaijuState
): state is KaijuState & { chaosCurrent: number } {
    return state.chaosCurrent !== null
        && state.areas.length > 0
        && state.areas.every(area =>
            area.currentHp !== null && Boolean(area.name.trim()));
}

function paintKaijuStatuses(
    container: HTMLElement,
    evaluation: KaijuEvaluation | undefined
): void {
    container.replaceChildren(statusBadge("Kaiju", true));

    if (!evaluation) {
        container.append(statusBadge("State incomplete"));
        return;
    }

    if (evaluation.rampageActive) {
        container.append(statusBadge("Rampage", true));
    }
    if (evaluation.deathThroesActive) {
        container.append(statusBadge("Death Throes", true));
    }
    if (evaluation.finishingBlowReady && !evaluation.finishingBlowMet) {
        container.append(statusBadge("Finishing Blow available"));
    }
    if (evaluation.finishingBlowMet) {
        container.append(statusBadge("Finishing Blow met", true));
    }
    if (evaluation.defeated) {
        container.append(statusBadge("Defeated", true));
    }
}

function newKaijuState(): KaijuState {
    return {
        chaosMax: null,
        chaosCurrent: null,
        finishingBlowTarget: null,
        finishingBlowDamageThisTurn: 0,
        behaviourPhase: "",
        areas: [newArea(1)],
        rampageOverride: "auto",
        deathThroesOverride: "auto",
        defeatedOverride: "auto",
        defeatedRound: null
    };
}

function newArea(index: number): AreaState {
    return {
        id: crypto.randomUUID(),
        name: `Vulnerable Area ${index}`,
        maxHp: null,
        currentHp: null,
        targetable: true,
        exploitedOverride: "auto"
    };
}

function chaosPercent(state: KaijuState): number {
    if (state.chaosMax === null
        || state.chaosMax <= 0
        || state.chaosCurrent === null) {
        return 0;
    }

    return Math.max(
        0,
        Math.min(100, (state.chaosCurrent / state.chaosMax) * 100));
}

async function resolveEvaluateUrl(root: HTMLElement): Promise<string> {
    const contextUrl = root.dataset.toolContextUrl;
    if (!contextUrl) return "/api/kaiju/evaluate";

    const response = await fetch(contextUrl, {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
    });
    if (!response.ok) {
        throw new Error(`Tool Host context returned HTTP ${response.status}.`);
    }

    const context = await response.json() as { apiBaseUrl: string };
    return `${context.apiBaseUrl}/upstream/api/kaiju/evaluate`;
}
