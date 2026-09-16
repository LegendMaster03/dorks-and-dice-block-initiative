import { registerAfterRender, requestEnhancement } from "./render-lifecycle";

type OverrideValue = "auto" | "on" | "off";

type StandardState = { maxHp: number | null; currentHp: number | null };
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
type PreviewDetail = {
    response: {
        orderedCombatants: Array<{
            id: string;
            name: string;
            allianceId: string;
            blockType: "standard" | "kaiju";
        }>;
    };
};
type TurnStateDetail = {
    response: {
        round: number;
        activeBlockId: string | null;
        blocks: Array<{ id: string; memberOrder: string[] }>;
    };
};

const standardStates = new Map<string, StandardState>();
const kaijuStates = new Map<string, KaijuState>();
const evaluations = new Map<string, KaijuEvaluation>();
const evaluating = new Set<string>();
let lastPreview: PreviewDetail | null = null;
let lastTurnState: TurnStateDetail | null = null;
let evaluateUrl: Promise<string> | null = null;
let initialized = false;

export function initializeCombatStateUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    installStyles(root);
    evaluateUrl = resolveEvaluateUrl(root);

    window.addEventListener("block-initiative:preview", event => {
        lastPreview = (event as CustomEvent<PreviewDetail>).detail;
        requestEnhancement();
    });
    window.addEventListener("block-initiative:state", event => {
        lastTurnState = (event as CustomEvent<TurnStateDetail>).detail;
        requestEnhancement();
    });

    registerAfterRender("combat-state", 30, () => {
        enhanceSetup(root);
        ensureDashboard(root);
    });
}

function installStyles(root: HTMLElement): void {
    if (root.querySelector("style[data-combat-state-style]")) return;
    const style = document.createElement("style");
    style.dataset.combatStateStyle = "true";
    style.textContent = `
.block-initiative-app .bi-combat-config,.block-initiative-app .bi-combat-dashboard{border-top:1px solid var(--bi-border);margin-top:.7rem;padding-top:.7rem}
.block-initiative-app .bi-combat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.55rem}.block-initiative-app .bi-combat-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}
.block-initiative-app .bi-health-list,.block-initiative-app .bi-area-list{display:grid;gap:.55rem;margin-top:.55rem}
.block-initiative-app .bi-health-row,.block-initiative-app .bi-area-row,.block-initiative-app .bi-kaiju-panel{border:1px solid var(--bi-border);border-radius:.55rem;padding:.65rem}.block-initiative-app .bi-health-row.active,.block-initiative-app .bi-kaiju-panel.active{border-width:2px}
.block-initiative-app .bi-combat-controls{display:flex;flex-wrap:wrap;gap:.4rem;align-items:end;margin-top:.45rem}.block-initiative-app .bi-combat-controls .bi-field{min-width:6rem;flex:1 1 7rem}
.block-initiative-app .bi-statuses{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center}.block-initiative-app .bi-status{border:1px solid currentColor;border-radius:999px;padding:.12rem .48rem;font-size:.78rem}.block-initiative-app .bi-status.strong{font-weight:700}
.block-initiative-app .bi-note{font-size:.85rem;opacity:.76}.block-initiative-app .bi-inline-check{display:flex;gap:.35rem;align-items:center;white-space:nowrap}.block-initiative-app .bi-inline-check input{width:auto}
.block-initiative-app .bi-chaos{height:.65rem;border-radius:999px;background:var(--bi-soft);overflow:hidden;margin:.35rem 0}.block-initiative-app .bi-chaos span{display:block;height:100%;background:currentColor;opacity:.55}
@media(max-width:800px){.block-initiative-app .bi-combat-grid,.block-initiative-app .bi-combat-grid.three{grid-template-columns:1fr}}
`;
    root.prepend(style);
}

function schedule(_root: HTMLElement): void {
    requestEnhancement();
}

function enhanceSetup(root: HTMLElement): void {
    for (const card of root.querySelectorAll<HTMLElement>(".bi-entry[data-id]")) {
        const id = card.dataset.id;
        const typeSelect = card.querySelector<HTMLSelectElement>("[data-field='block-type']");
        if (!id || !typeSelect) continue;

        if (typeSelect.dataset.combatListener !== "true") {
            typeSelect.dataset.combatListener = "true";
            typeSelect.addEventListener("change", () => {
                card.querySelector("[data-combat-setup]")?.remove();
                schedule(root);
            });
        }

        if (typeSelect.value === "kaiju") {
            standardStates.delete(id);
            ensureKaijuSetup(card, id, root);
        } else if ((card.dataset.alliance ?? "") !== "players") {
            kaijuStates.delete(id);
            evaluations.delete(id);
            ensureStandardSetup(card, id);
        } else {
            card.querySelector("[data-combat-setup]")?.remove();
        }
    }
}

function ensureStandardSetup(card: HTMLElement, id: string): void {
    if (card.querySelector("[data-combat-setup='standard']")) return;
    card.querySelector("[data-combat-setup]")?.remove();
    const state = standardStates.get(id) ?? { maxHp: null, currentHp: null };
    standardStates.set(id, state);

    const panel = document.createElement("section");
    panel.className = "bi-combat-config";
    panel.dataset.combatSetup = "standard";
    panel.innerHTML = `<strong>Enemy health</strong><div class="bi-note">Optional during setup; available throughout encounter tracking.</div><div class="bi-combat-grid mt-2"></div>`;
    const grid = panel.querySelector<HTMLElement>(".bi-combat-grid")!;
    grid.append(
        numberField("Max HP", state.maxHp, value => {
            const old = state.maxHp;
            state.maxHp = value;
            if (state.currentHp === null || state.currentHp === old) state.currentHp = value;
        }),
        numberField("Current HP", state.currentHp, value => { state.currentHp = value; })
    );
    card.append(panel);
}

function ensureKaijuSetup(card: HTMLElement, id: string, root: HTMLElement): void {
    if (card.querySelector("[data-combat-setup='kaiju']")) return;
    card.querySelector("[data-combat-setup]")?.remove();
    const state = kaijuStates.get(id) ?? newKaijuState();
    kaijuStates.set(id, state);

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
            const old = state.chaosMax;
            state.chaosMax = value;
            if (state.chaosCurrent === null || state.chaosCurrent === old) state.chaosCurrent = value;
            void evaluateKaiju(id, state, root, false);
        }),
        numberField("Current Chaos", state.chaosCurrent, value => { state.chaosCurrent = value; void evaluateKaiju(id, state, root, false); }),
        numberField("Finishing Blow", state.finishingBlowTarget, value => { state.finishingBlowTarget = value; void evaluateKaiju(id, state, root, false); })
    );

    const phase = panel.querySelector<HTMLInputElement>("[data-field='behaviour-phase']")!;
    phase.value = state.behaviourPhase;
    phase.addEventListener("change", () => { state.behaviourPhase = phase.value.trim(); });

    const overrides = panel.querySelector<HTMLElement>("[data-role='overrides']")!;
    overrides.append(
        overrideField("Rampage", state.rampageOverride, value => { state.rampageOverride = value; void evaluateKaiju(id, state, root, false); }),
        overrideField("Death Throes", state.deathThroesOverride, value => { state.deathThroesOverride = value; void evaluateKaiju(id, state, root, false); }),
        overrideField("Defeated", state.defeatedOverride, value => { state.defeatedOverride = value; void evaluateKaiju(id, state, root, false); })
    );

    const areaList = panel.querySelector<HTMLElement>("[data-role='setup-areas']")!;
    const renderAreas = () => renderSetupAreas(areaList, state, id, root, renderAreas);
    panel.querySelector<HTMLButtonElement>("[data-action='add-area']")!.onclick = () => {
        state.areas.push(newArea(state.areas.length + 1));
        renderAreas();
    };
    renderAreas();
    card.append(panel);
    void evaluateKaiju(id, state, root, false);
}

function renderSetupAreas(list: HTMLElement, state: KaijuState, kaijuId: string, root: HTMLElement, rerender: () => void): void {
    list.replaceChildren();
    for (const area of state.areas) {
        const row = document.createElement("article");
        row.className = "bi-area-row";
        row.innerHTML = `<div class="bi-combat-grid three"></div><div class="bi-combat-controls"></div>`;
        const grid = row.querySelector<HTMLElement>(".bi-combat-grid")!;
        grid.append(
            textField("Name", area.name, value => { area.name = value || "Vulnerable Area"; void evaluateKaiju(kaijuId, state, root, false); }),
            numberField("Max HP", area.maxHp, value => {
                const old = area.maxHp;
                area.maxHp = value;
                if (area.currentHp === null || area.currentHp === old) area.currentHp = value;
                void evaluateKaiju(kaijuId, state, root, false);
            }),
            numberField("Current HP", area.currentHp, value => { area.currentHp = value; void evaluateKaiju(kaijuId, state, root, false); })
        );
        const controls = row.querySelector<HTMLElement>(".bi-combat-controls")!;
        controls.append(
            checkField("Targetable now", area.targetable, value => { area.targetable = value; void evaluateKaiju(kaijuId, state, root, false); }),
            overrideField("Exploited", area.exploitedOverride, value => { area.exploitedOverride = value; void evaluateKaiju(kaijuId, state, root, false); }),
            actionButton("Remove", "btn-outline-danger", () => {
                state.areas = state.areas.filter(candidate => candidate.id !== area.id);
                rerender();
                void evaluateKaiju(kaijuId, state, root, false);
            })
        );
        list.append(row);
    }
    requestEnhancement();
}

function ensureDashboard(root: HTMLElement): void {
    const active = root.querySelector<HTMLElement>(".bi-active");
    if (!active || !lastPreview || !lastTurnState) return;
    const runner = active.closest<HTMLElement>("section.card.card-body.bi-grid");
    if (!runner || runner.querySelector("[data-combat-dashboard]")) return;

    const dashboard = document.createElement("section");
    dashboard.className = "bi-combat-dashboard bi-grid";
    dashboard.dataset.combatDashboard = "true";
    dashboard.innerHTML = `<div><h4 class="h5 mb-1">Combat state</h4><div class="bi-muted">Health and Kaiju state remain editable even when another block is active.</div></div>`;

    const activeBlock = lastTurnState.response.blocks.find(block => block.id === lastTurnState!.response.activeBlockId);
    const activeIds = new Set(activeBlock?.memberOrder ?? []);
    const combatants = lastPreview.response.orderedCombatants;

    const standards = combatants.filter(c => c.allianceId !== "players" && c.blockType === "standard");
    if (standards.length) dashboard.append(renderHealth(standards, activeIds));

    for (const combatant of combatants.filter(c => c.blockType === "kaiju")) {
        const state = kaijuStates.get(combatant.id) ?? newKaijuState();
        kaijuStates.set(combatant.id, state);
        dashboard.append(renderKaiju(combatant.id, combatant.name, state, activeIds.has(combatant.id), root));
        if (!evaluations.has(combatant.id) && !evaluating.has(combatant.id)) {
            void evaluateKaiju(combatant.id, state, root, true);
        }
    }

    // The runner contains nested toolbars that also use .bi-actions. Only a
    // direct child can be a valid insertBefore reference for the dashboard.
    const actions = runner.querySelector<HTMLElement>(":scope > .bi-actions");
    actions ? runner.insertBefore(dashboard, actions) : runner.append(dashboard);
}

function renderHealth(combatants: Array<{ id: string; name: string }>, activeIds: Set<string>): HTMLElement {
    const section = document.createElement("section");
    section.innerHTML = `<h5 class="h6 mb-1">Enemy / NPC health</h5><div class="bi-note">0 HP does not automatically remove a creature from initiative; the DM remains authoritative.</div>`;
    const list = document.createElement("div");
    list.className = "bi-health-list";
    for (const combatant of combatants) {
        const state = standardStates.get(combatant.id) ?? { maxHp: null, currentHp: null };
        standardStates.set(combatant.id, state);
        const row = document.createElement("article");
        row.className = `bi-health-row${activeIds.has(combatant.id) ? " active" : ""}`;
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
            numberField("Current HP", state.currentHp, value => { state.currentHp = value; paintHpStatus(status, state); }),
            numberField("Max HP", state.maxHp, value => { state.maxHp = value; if (state.currentHp === null) state.currentHp = value; paintHpStatus(status, state); })
        );
        const amount = amountField();
        controls.append(amount.wrapper,
            actionButton("Damage", "btn-outline-secondary", () => { state.currentHp = Math.max(0, (state.currentHp ?? state.maxHp ?? 0) - amount.value()); refreshDashboard(); }),
            actionButton("Heal", "btn-outline-secondary", () => { const next = (state.currentHp ?? 0) + amount.value(); state.currentHp = state.maxHp === null ? next : Math.min(next, state.maxHp); refreshDashboard(); })
        );
        row.append(controls);
        list.append(row);
    }
    section.append(list);
    return section;
}

function renderKaiju(id: string, name: string, state: KaijuState, active: boolean, root: HTMLElement): HTMLElement {
    const panel = document.createElement("section");
    panel.className = `bi-kaiju-panel bi-grid${active ? " active" : ""}`;
    const evaluation = evaluations.get(id);

    const head = document.createElement("div");
    head.className = "bi-row";
    const title = document.createElement("div");
    const h = document.createElement("h5");
    h.className = "h6 mb-1";
    h.textContent = name;
    const phase = document.createElement("div");
    phase.className = "bi-muted";
    phase.textContent = state.behaviourPhase ? `Behaviour / phase: ${state.behaviourPhase}` : "Behaviour / phase not recorded";
    const source = document.createElement("div");
    source.className = "bi-note";
    source.innerHTML = `Kaiju Fighting rules by Loot Tavern — <a href="https://www.patreon.com/posts/ryokos-kaiju-to-141132181" target="_blank" rel="noopener noreferrer">view the official Kaiju Fighting Lite rules</a>.`;
    title.append(h, phase, source);
    const statuses = document.createElement("div");
    statuses.className = "bi-statuses";
    paintKaijuStatuses(statuses, evaluation);
    head.append(title, statuses);
    panel.append(head);

    const chaos = document.createElement("section");
    chaos.innerHTML = `<strong>Chaos Threshold</strong><div class="bi-note">Damage outside a Vulnerable Area reduces this pool. Reaching 0 normally triggers Rampage.</div>`;
    const meter = document.createElement("div");
    meter.className = "bi-chaos";
    const fill = document.createElement("span");
    fill.style.width = `${chaosPercent(state)}%`;
    meter.append(fill);
    chaos.append(meter);
    const chaosControls = document.createElement("div");
    chaosControls.className = "bi-combat-controls";
    chaosControls.append(
        numberField("Current", state.chaosCurrent, value => { state.chaosCurrent = value; void evaluateKaiju(id, state, root, true); }),
        numberField("Maximum", state.chaosMax, value => { state.chaosMax = value; if (state.chaosCurrent === null) state.chaosCurrent = value; void evaluateKaiju(id, state, root, true); })
    );
    const chaosAmount = amountField();
    chaosControls.append(chaosAmount.wrapper,
        actionButton("Damage", "btn-outline-secondary", () => { state.chaosCurrent = (state.chaosCurrent ?? state.chaosMax ?? 0) - chaosAmount.value(); void evaluateKaiju(id, state, root, true); }),
        actionButton("Restore", "btn-outline-secondary", () => { const next = (state.chaosCurrent ?? 0) + chaosAmount.value(); state.chaosCurrent = state.chaosMax === null ? next : Math.min(next, state.chaosMax); void evaluateKaiju(id, state, root, true); })
    );
    chaos.append(chaosControls);
    panel.append(chaos);

    panel.append(textField("Current behaviour / phase", state.behaviourPhase, value => { state.behaviourPhase = value; }));

    const areaSection = document.createElement("section");
    areaSection.innerHTML = `<strong>Vulnerable Areas</strong><div class="bi-note">Weak points have separate HP pools and can become targetable as Behaviours change.</div>`;
    const areaList = document.createElement("div");
    areaList.className = "bi-area-list";
    for (const area of state.areas) {
        const derived = evaluation?.vulnerableAreas.find(candidate => candidate.id === area.id);
        const row = document.createElement("article");
        row.className = "bi-area-row";
        const rowHead = document.createElement("div");
        rowHead.className = "bi-row";
        const areaName = document.createElement("strong");
        areaName.textContent = area.name;
        const flags = document.createElement("div");
        flags.className = "bi-statuses";
        flags.append(statusBadge(area.targetable ? "Targetable" : "Not targetable"));
        if (derived?.exploited) flags.append(statusBadge("Exploited", true));
        rowHead.append(areaName, flags);
        row.append(rowHead);
        const controls = document.createElement("div");
        controls.className = "bi-combat-controls";
        controls.append(
            numberField("Current HP", area.currentHp, value => { area.currentHp = value; void evaluateKaiju(id, state, root, true); }),
            numberField("Max HP", area.maxHp, value => { area.maxHp = value; if (area.currentHp === null) area.currentHp = value; void evaluateKaiju(id, state, root, true); })
        );
        const amount = amountField();
        controls.append(amount.wrapper,
            actionButton("Apply damage", "btn-outline-secondary", () => { area.currentHp = Math.max(0, (area.currentHp ?? area.maxHp ?? 0) - amount.value()); void evaluateKaiju(id, state, root, true); }),
            checkField("Targetable", area.targetable, value => { area.targetable = value; void evaluateKaiju(id, state, root, true); })
        );
        row.append(controls);
        areaList.append(row);
    }
    areaSection.append(areaList);
    panel.append(areaSection);

    if (evaluation?.deathThroesActive || state.deathThroesOverride === "on") {
        const finishing = document.createElement("section");
        finishing.innerHTML = `<strong>Finishing Blow</strong><div class="bi-note">During Death Throes, record damage dealt in one turn against the stat block's Finishing Blow value.</div>`;
        const controls = document.createElement("div");
        controls.className = "bi-combat-controls";
        controls.append(
            numberField("Target", state.finishingBlowTarget, value => { state.finishingBlowTarget = value; void evaluateKaiju(id, state, root, true); }),
            numberField("Damage this turn", state.finishingBlowDamageThisTurn, value => { state.finishingBlowDamageThisTurn = value ?? 0; void evaluateKaiju(id, state, root, true); }),
            actionButton("Reset turn damage", "btn-outline-secondary", () => { state.finishingBlowDamageThisTurn = 0; void evaluateKaiju(id, state, root, true); })
        );
        finishing.append(controls);
        panel.append(finishing);
    }

    if (evaluation?.defeated) {
        if (state.defeatedRound === null && lastTurnState) state.defeatedRound = lastTurnState.response.round;
        const note = document.createElement("div");
        note.className = "bi-message bi-warning";
        note.textContent = state.defeatedRound === null
            ? "Kaiju defeated. Resolve its Death Rattle on initiative count 20 of the following round when applicable."
            : `Kaiju defeated in round ${state.defeatedRound}. Death Rattle is due on initiative count 20 of round ${state.defeatedRound + 1} when applicable.`;
        panel.append(note);
    }

    return panel;
}

async function evaluateKaiju(id: string, state: KaijuState, root: HTMLElement, rerender: boolean): Promise<void> {
    if (evaluating.has(id)) return;
    if (state.chaosCurrent === null || state.areas.length === 0 || state.areas.some(area => area.currentHp === null || !area.name.trim())) {
        evaluations.delete(id);
        if (rerender) refreshDashboard();
        return;
    }

    evaluating.add(id);
    try {
        const url = await evaluateUrl;
        if (!url) return;
        const response = await fetch(url, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
                chaosThresholdCurrent: Math.trunc(state.chaosCurrent),
                finishingBlowTarget: state.finishingBlowTarget === null ? null : Math.trunc(state.finishingBlowTarget),
                finishingBlowDamageThisTurn: Math.trunc(state.finishingBlowDamageThisTurn),
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
        if (evaluation.defeated && state.defeatedRound === null && lastTurnState) state.defeatedRound = lastTurnState.response.round;
    } catch {
        evaluations.delete(id);
    } finally {
        evaluating.delete(id);
        if (rerender) refreshDashboard();
    }
}

function refreshDashboard(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement)) return;
    root.querySelector("[data-combat-dashboard]")?.remove();
    schedule(root);
}

function paintHpStatus(container: HTMLElement, state: StandardState): void {
    container.replaceChildren();
    const current = state.currentHp ?? state.maxHp;
    if (current === null) {
        container.append(statusBadge("HP not configured"));
        return;
    }
    container.append(statusBadge(state.maxHp === null ? `HP ${current}` : `HP ${current} / ${state.maxHp}`, current <= 0));
    if (current <= 0) container.append(statusBadge("0 HP", true));
}

function paintKaijuStatuses(container: HTMLElement, evaluation: KaijuEvaluation | undefined): void {
    container.replaceChildren(statusBadge("Kaiju", true));
    if (!evaluation) {
        container.append(statusBadge("State incomplete"));
        return;
    }
    if (evaluation.rampageActive) container.append(statusBadge("Rampage", true));
    if (evaluation.deathThroesActive) container.append(statusBadge("Death Throes", true));
    if (evaluation.finishingBlowReady && !evaluation.finishingBlowMet) container.append(statusBadge("Finishing Blow available"));
    if (evaluation.finishingBlowMet) container.append(statusBadge("Finishing Blow met", true));
    if (evaluation.defeated) container.append(statusBadge("Defeated", true));
}

function numberField(labelText: string, value: number | null, setter: (value: number | null) => void): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "bi-field";
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.type = "number";
    input.step = "1";
    input.value = value === null ? "" : String(value);
    input.addEventListener("change", () => setter(readNumber(input)));
    wrap.append(label, input);
    return wrap;
}

function textField(labelText: string, value: string, setter: (value: string) => void): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "bi-field";
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.value = value;
    input.addEventListener("change", () => setter(input.value.trim()));
    wrap.append(label, input);
    return wrap;
}

function overrideField(labelText: string, value: OverrideValue, setter: (value: OverrideValue) => void): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "bi-field";
    const label = document.createElement("label");
    label.textContent = labelText;
    const select = document.createElement("select");
    select.add(new Option("Automatic", "auto"));
    select.add(new Option("Force active / yes", "on"));
    select.add(new Option("Force inactive / no", "off"));
    select.value = value;
    select.addEventListener("change", () => setter(select.value as OverrideValue));
    wrap.append(label, select);
    return wrap;
}

function checkField(labelText: string, checked: boolean, setter: (value: boolean) => void): HTMLElement {
    const label = document.createElement("label");
    label.className = "bi-inline-check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", () => setter(input.checked));
    label.append(input, document.createTextNode(` ${labelText}`));
    return label;
}

function amountField(): { wrapper: HTMLElement; value: () => number } {
    const wrap = document.createElement("div");
    wrap.className = "bi-field";
    const label = document.createElement("label");
    label.textContent = "Amount";
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.placeholder = "0";
    wrap.append(label, input);
    return { wrapper: wrap, value: () => Math.max(0, readNumber(input) ?? 0) };
}

function actionButton(text: string, style: string, action: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `btn btn-sm ${style}`;
    button.textContent = text;
    button.onclick = action;
    return button;
}

function statusBadge(text: string, strong = false): HTMLElement {
    const span = document.createElement("span");
    span.className = `bi-status${strong ? " strong" : ""}`;
    span.textContent = text;
    return span;
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

function overrideBool(value: OverrideValue): boolean | null {
    return value === "auto" ? null : value === "on";
}

function readNumber(input: HTMLInputElement): number | null {
    if (!input.value.trim()) return null;
    const value = Number(input.value);
    return Number.isFinite(value) ? value : null;
}

function chaosPercent(state: KaijuState): number {
    if (state.chaosMax === null || state.chaosMax <= 0 || state.chaosCurrent === null) return 0;
    return Math.max(0, Math.min(100, (state.chaosCurrent / state.chaosMax) * 100));
}

async function resolveEvaluateUrl(root: HTMLElement): Promise<string> {
    const contextUrl = root.dataset.toolContextUrl;
    if (!contextUrl) return "/api/kaiju/evaluate";
    const response = await fetch(contextUrl, { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Tool Host context returned HTTP ${response.status}.`);
    const context = await response.json() as { apiBaseUrl: string };
    return `${context.apiBaseUrl}/upstream/api/kaiju/evaluate`;
}