type OverrideValue = "auto" | "on" | "off";

type StandardCombatState = {
    maxHp: number | null;
    currentHp: number | null;
};

type VulnerableAreaState = {
    id: string;
    name: string;
    maxHp: number | null;
    currentHp: number | null;
    targetable: boolean;
    exploitedOverride: OverrideValue;
};

type KaijuCombatState = {
    chaosMax: number | null;
    chaosCurrent: number | null;
    finishingBlowTarget: number | null;
    finishingBlowDamageThisTurn: number;
    behaviourPhase: string;
    vulnerableAreas: VulnerableAreaState[];
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
    vulnerableAreas: Array<{
        id: string;
        name: string;
        currentHitPoints: number;
        targetable: boolean;
        exploited: boolean;
        usedOverride: boolean;
    }>;
};

type PreviewEventDetail = {
    request: {
        combatants: Array<{
            id: string;
            name: string;
            allianceId: string;
            blockType?: "standard" | "kaiju";
        }>;
    };
    response: {
        orderedCombatants: Array<{
            id: string;
            name: string;
            allianceId: string;
            blockType: "standard" | "kaiju";
        }>;
    };
};

type TurnStateEventDetail = {
    response: {
        round: number;
        activeBlockId: string | null;
        blocks: Array<{
            id: string;
            allianceId: string;
            blockType: "standard" | "kaiju";
            memberOrder: string[];
        }>;
    };
};

const standardStates = new Map<string, StandardCombatState>();
const kaijuStates = new Map<string, KaijuCombatState>();
const evaluations = new Map<string, KaijuEvaluation>();
let lastPreview: PreviewEventDetail | null = null;
let lastTurnState: TurnStateEventDetail | null = null;
let evaluateUrlPromise: Promise<string> | null = null;
let observer: MutationObserver | null = null;
let scheduled = false;

export function initializeCombatStateUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || observer) {
        return;
    }

    addStyles(root);
    evaluateUrlPromise = resolveEvaluateUrl(root);

    window.addEventListener("block-initiative:preview", event => {
        lastPreview = (event as CustomEvent<PreviewEventDetail>).detail;
        schedule(root);
    });

    window.addEventListener("block-initiative:state", event => {
        lastTurnState = (event as CustomEvent<TurnStateEventDetail>).detail;
        schedule(root);
    });

    observer = new MutationObserver(() => schedule(root));
    observer.observe(root, { childList: true, subtree: true });
    schedule(root);
}

function addStyles(root: HTMLElement): void {
    if (root.querySelector("style[data-combat-state-style]")) {
        return;
    }

    const style = document.createElement("style");
    style.dataset.combatStateStyle = "true";
    style.textContent = `
.block-initiative-app .bi-combat-config,.block-initiative-app .bi-combat-dashboard{border-top:1px solid var(--bi-border);margin-top:.7rem;padding-top:.7rem}
.block-initiative-app .bi-combat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.55rem}
.block-initiative-app .bi-combat-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}
.block-initiative-app .bi-vulnerable-list,.block-initiative-app .bi-health-list{display:grid;gap:.55rem;margin-top:.55rem}
.block-initiative-app .bi-vulnerable-row,.block-initiative-app .bi-health-row,.block-initiative-app .bi-kaiju-panel{border:1px solid var(--bi-border);border-radius:.55rem;padding:.65rem}
.block-initiative-app .bi-health-row.active,.block-initiative-app .bi-kaiju-panel.active{border-width:2px}
.block-initiative-app .bi-health-controls,.block-initiative-app .bi-vulnerable-controls{display:flex;flex-wrap:wrap;gap:.4rem;align-items:end;margin-top:.45rem}
.block-initiative-app .bi-health-controls .bi-field,.block-initiative-app .bi-vulnerable-controls .bi-field{min-width:6rem;flex:1 1 7rem}
.block-initiative-app .bi-statuses{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center}
.block-initiative-app .bi-status{border:1px solid currentColor;border-radius:999px;padding:.12rem .48rem;font-size:.78rem}
.block-initiative-app .bi-status.strong{font-weight:700}
.block-initiative-app .bi-chaos-meter{height:.65rem;border-radius:999px;background:var(--bi-soft);overflow:hidden;margin:.35rem 0 .55rem}
.block-initiative-app .bi-chaos-meter>span{display:block;height:100%;background:currentColor;opacity:.55}
.block-initiative-app .bi-combat-dashboard h4,.block-initiative-app .bi-combat-dashboard h5{margin-bottom:.25rem}
.block-initiative-app .bi-combat-section{display:grid;gap:.55rem}
.block-initiative-app .bi-combat-note{font-size:.85rem;opacity:.76}
.block-initiative-app .bi-inline-checkbox{display:flex;gap:.35rem;align-items:center;white-space:nowrap}
.block-initiative-app .bi-inline-checkbox input{width:auto}
@media(max-width:800px){.block-initiative-app .bi-combat-grid,.block-initiative-app .bi-combat-grid.three{grid-template-columns:1fr}}
`;
    root.prepend(style);
}

function schedule(root: HTMLElement): void {
    if (scheduled) {
        return;
    }

    scheduled = true;
    queueMicrotask(() => {
        scheduled = false;
        enhanceSetup(root);
        ensureRunnerDashboard(root);
    });
}

function enhanceSetup(root: HTMLElement): void {
    for (const card of Array.from(root.querySelectorAll<HTMLElement>(".bi-entry[data-id]"))) {
        const id = card.dataset.id;
        if (!id) {
            continue;
        }

        const typeSelect = card.querySelector<HTMLSelectElement>("[data-field='block-type']");
        if (!typeSelect) {
            continue;
        }

        if (typeSelect.dataset.combatListener !== "true") {
            typeSelect.dataset.combatListener = "true";
            typeSelect.addEventListener("change", () => {
                card.querySelector("[data-combat-state-setup]")?.remove();
                schedule(root);
            });
        }

        const alliance = card.dataset.alliance ?? "";
        if (typeSelect.value === "kaiju") {
            standardStates.delete(id);
            ensureKaijuSetup(card, id, root);
        } else if (alliance !== "players") {
            kaijuStates.delete(id);
            evaluations.delete(id);
            ensureStandardSetup(card, id);
        } else {
            card.querySelector("[data-combat-state-setup]")?.remove();
        }
    }
}

function ensureStandardSetup(card: HTMLElement, id: string): void {
    if (card.querySelector("[data-combat-state-setup='standard']")) {
        return;
    }

    card.querySelector("[data-combat-state-setup]")?.remove();
    const state = standardStates.get(id) ?? { maxHp: null, currentHp: null };
    standardStates.set(id, state);

    const panel = document.createElement("section");
    panel.className = "bi-combat-config";
    panel.dataset.combatStateSetup = "standard";
    panel.innerHTML = `
<div class="bi-row"><div><strong>Enemy health</strong><div class="bi-combat-note">Optional during setup; used by the combat tracker.</div></div></div>
<div class="bi-combat-grid mt-2">
  <div class="bi-field"><label>Max HP</label><input data-combat-field="max-hp" type="number" min="0" step="1" placeholder="e.g. 45"></div>
  <div class="bi-field"><label>Current HP</label><input data-combat-field="current-hp" type="number" min="0" step="1" placeholder="Starts at max"></div>
</div>`;

    const maxInput = panel.querySelector<HTMLInputElement>("[data-combat-field='max-hp']")!;
    const currentInput = panel.querySelector<HTMLInputElement>("[data-combat-field='current-hp']")!;
    writeNumber(maxInput, state.maxHp);
    writeNumber(currentInput, state.currentHp);

    maxInput.addEventListener("change", () => {
        const previousMax = state.maxHp;
        state.maxHp = readNumber(maxInput);
        if (state.currentHp === null || state.currentHp === previousMax) {
            state.currentHp = state.maxHp;
            writeNumber(currentInput, state.currentHp);
        }
    });
    currentInput.addEventListener("change", () => {
        state.currentHp = readNumber(currentInput);
    });

    card.append(panel);
}

function ensureKaijuSetup(card: HTMLElement, id: string, root: HTMLElement): void {
    if (card.querySelector("[data-combat-state-setup='kaiju']")) {
        return;
    }

    card.querySelector("[data-combat-state-setup]")?.remove();
    const state = kaijuStates.get(id) ?? createKaijuState();
    kaijuStates.set(id, state);

    const panel = document.createElement("section");
    panel.className = "bi-combat-config";
    panel.dataset.combatStateSetup = "kaiju";
    panel.innerHTML = `
<div class="bi-row"><div><strong>Kaiju battle state</strong><div class="bi-combat-note">Kaiju use a Chaos Threshold plus separate Vulnerable Area HP pools instead of normal HP.</div></div></div>
<div class="bi-combat-grid three mt-2">
  <div class="bi-field"><label>Chaos Threshold</label><input data-kaiju-field="chaos-max" type="number" step="1" placeholder="Maximum"></div>
  <div class="bi-field"><label>Current Chaos</label><input data-kaiju-field="chaos-current" type="number" step="1" placeholder="Starts at threshold"></div>
  <div class="bi-field"><label>Finishing Blow</label><input data-kaiju-field="finishing-target" type="number" min="1" step="1" placeholder="Damage in one turn"></div>
</div>
<div class="bi-field mt-2"><label>Current behaviour / phase</label><input data-kaiju-field="behaviour" placeholder="e.g. Normal, Water Form, Rampage"></div>
<div class="mt-3"><div class="bi-row"><div><strong>Vulnerable Areas <span class="bi-muted">(weak points)</span></strong><div class="bi-combat-note">Track each area's HP separately and whether it is currently targetable.</div></div><button type="button" class="btn btn-sm btn-outline-secondary" data-action="add-vulnerable-area">+ Area</button></div><div class="bi-vulnerable-list" data-role="vulnerable-areas"></div></div>
<details class="mt-2"><summary>DM state overrides</summary><div class="bi-combat-grid three mt-2">
  <div class="bi-field"><label>Rampage</label><select data-kaiju-override="rampage"><option value="auto">Automatic</option><option value="on">Force active</option><option value="off">Force inactive</option></select></div>
  <div class="bi-field"><label>Death Throes</label><select data-kaiju-override="death"><option value="auto">Automatic</option><option value="on">Force active</option><option value="off">Force inactive</option></select></div>
  <div class="bi-field"><label>Defeated</label><select data-kaiju-override="defeated"><option value="auto">Automatic</option><option value="on">Force defeated</option><option value="off">Force not defeated</option></select></div>
</div></details>`;

    const chaosMax = panel.querySelector<HTMLInputElement>("[data-kaiju-field='chaos-max']")!;
    const chaosCurrent = panel.querySelector<HTMLInputElement>("[data-kaiju-field='chaos-current']")!;
    const finishing = panel.querySelector<HTMLInputElement>("[data-kaiju-field='finishing-target']")!;
    const behaviour = panel.querySelector<HTMLInputElement>("[data-kaiju-field='behaviour']")!;
    writeNumber(chaosMax, state.chaosMax);
    writeNumber(chaosCurrent, state.chaosCurrent);
    writeNumber(finishing, state.finishingBlowTarget);
    behaviour.value = state.behaviourPhase;

    chaosMax.addEventListener("change", () => {
        const previousMax = state.chaosMax;
        state.chaosMax = readNumber(chaosMax);
        if (state.chaosCurrent === null || state.chaosCurrent === previousMax) {
            state.chaosCurrent = state.chaosMax;
            writeNumber(chaosCurrent, state.chaosCurrent);
        }
        void evaluateKaiju(id, state, root);
    });
    chaosCurrent.addEventListener("change", () => {
        state.chaosCurrent = readNumber(chaosCurrent);
        void evaluateKaiju(id, state, root);
    });
    finishing.addEventListener("change", () => {
        state.finishingBlowTarget = readNumber(finishing);
        void evaluateKaiju(id, state, root);
    });
    behaviour.addEventListener("change", () => {
        state.behaviourPhase = behaviour.value.trim();
    });

    bindOverride(panel, "rampage", value => { state.rampageOverride = value; void evaluateKaiju(id, state, root); }, state.rampageOverride);
    bindOverride(panel, "death", value => { state.deathThroesOverride = value; void evaluateKaiju(id, state, root); }, state.deathThroesOverride);
    bindOverride(panel, "defeated", value => { state.defeatedOverride = value; void evaluateKaiju(id, state, root); }, state.defeatedOverride);

    const list = panel.querySelector<HTMLElement>("[data-role='vulnerable-areas']")!;
    const renderAreas = () => renderVulnerableSetup(list, state, id, root, renderAreas);
    panel.querySelector<HTMLButtonElement>("[data-action='add-vulnerable-area']")!.addEventListener("click", () => {
        state.vulnerableAreas.push(createArea(state.vulnerableAreas.length + 1));
        renderAreas();
    });
    renderAreas();
    card.append(panel);
    void evaluateKaiju(id, state, root);
}

function renderVulnerableSetup(
    list: HTMLElement,
    state: KaijuCombatState,
    kaijuId: string,
    root: HTMLElement,
    rerender: () => void
): void {
    list.replaceChildren();
    for (const area of state.vulnerableAreas) {
        const row = document.createElement("article");
        row.className = "bi-vulnerable-row";
        row.innerHTML = `
<div class="bi-combat-grid three">
  <div class="bi-field"><label>Name</label><input data-area-field="name"></div>
  <div class="bi-field"><label>Max HP</label><input data-area-field="max" type="number" min="1" step="1"></div>
  <div class="bi-field"><label>Current HP</label><input data-area-field="current" type="number" min="0" step="1"></div>
</div>
<div class="bi-vulnerable-controls">
  <label class="bi-inline-checkbox"><input data-area-field="targetable" type="checkbox"> Targetable now</label>
  <div class="bi-field"><label>Exploited</label><select data-area-field="exploited"><option value="auto">Automatic at 0 HP</option><option value="on">Force exploited</option><option value="off">Force not exploited</option></select></div>
  <button type="button" class="btn btn-sm btn-outline-danger" data-action="remove-area">Remove</button>
</div>`;

        const name = row.querySelector<HTMLInputElement>("[data-area-field='name']")!;
        const max = row.querySelector<HTMLInputElement>("[data-area-field='max']")!;
        const current = row.querySelector<HTMLInputElement>("[data-area-field='current']")!;
        const targetable = row.querySelector<HTMLInputElement>("[data-area-field='targetable']")!;
        const exploited = row.querySelector<HTMLSelectElement>("[data-area-field='exploited']")!;
        name.value = area.name;
        writeNumber(max, area.maxHp);
        writeNumber(current, area.currentHp);
        targetable.checked = area.targetable;
        exploited.value = area.exploitedOverride;

        name.addEventListener("change", () => { area.name = name.value.trim() || "Vulnerable Area"; void evaluateKaiju(kaijuId, state, root); });
        max.addEventListener("change", () => {
            const previousMax = area.maxHp;
            area.maxHp = readNumber(max);
            if (area.currentHp === null || area.currentHp === previousMax) {
                area.currentHp = area.maxHp;
                writeNumber(current, area.currentHp);
            }
            void evaluateKaiju(kaijuId, state, root);
        });
        current.addEventListener("change", () => { area.currentHp = readNumber(current); void evaluateKaiju(kaijuId, state, root); });
        targetable.addEventListener("change", () => { area.targetable = targetable.checked; void evaluateKaiju(kaijuId, state, root); });
        exploited.addEventListener("change", () => { area.exploitedOverride = exploited.value as OverrideValue; void evaluateKaiju(kaijuId, state, root); });
        row.querySelector<HTMLButtonElement>("[data-action='remove-area']")!.addEventListener("click", () => {
            state.vulnerableAreas = state.vulnerableAreas.filter(candidate => candidate.id !== area.id);
            rerender();
            void evaluateKaiju(kaijuId, state, root);
        });

        list.append(row);
    }
}

function ensureRunnerDashboard(root: HTMLElement): void {
    const active = root.querySelector<HTMLElement>(".bi-active");
    if (!active || !lastPreview || !lastTurnState) {
        return;
    }

    const runner = active.closest<HTMLElement>("section.card.card-body.bi-grid");
    if (!runner || runner.querySelector("[data-combat-dashboard]")) {
        return;
    }

    const dashboard = document.createElement("section");
    dashboard.className = "bi-combat-dashboard bi-grid";
    dashboard.dataset.combatDashboard = "true";

    const title = document.createElement("div");
    title.innerHTML = `<h4 class="h5 mb-1">Combat state</h4><div class="bi-muted">Health and Kaiju state remain available even when another block is active.</div>`;
    dashboard.append(title);

    const activeBlock = lastTurnState.response.blocks.find(block => block.id === lastTurnState!.response.activeBlockId);
    const activeIds = new Set(activeBlock?.memberOrder ?? []);
    const combatants = lastPreview.response.orderedCombatants;

    const standardEnemies = combatants.filter(combatant => combatant.allianceId !== "players" && combatant.blockType === "standard");
    if (standardEnemies.length > 0) {
        dashboard.append(renderHealthSection(standardEnemies, activeIds));
    }

    const kaiju = combatants.filter(combatant => combatant.blockType === "kaiju");
    for (const combatant of kaiju) {
        const state = kaijuStates.get(combatant.id) ?? createKaijuState();
        kaijuStates.set(combatant.id, state);
        dashboard.append(renderKaijuDashboard(combatant.id, combatant.name, state, activeIds.has(combatant.id), root));
        void evaluateKaiju(combatant.id, state, root);
    }

    const actions = runner.querySelector(".bi-actions");
    if (actions) {
        runner.insertBefore(dashboard, actions);
    } else {
        runner.append(dashboard);
    }
}

function renderHealthSection(
    combatants: Array<{ id: string; name: string }>,
    activeIds: Set<string>
): HTMLElement {
    const section = document.createElement("section");
    section.className = "bi-combat-section";
    section.innerHTML = `<div><h5 class="h6 mb-1">Enemy / NPC health</h5><div class="bi-combat-note">Changing HP does not remove a combatant from initiative; the DM decides when a creature leaves combat.</div></div>`;
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
        const status = document.createElement("span");
        status.className = "bi-statuses";
        updateHpStatus(status, state);
        head.append(name, status);
        row.append(head);

        const controls = document.createElement("div");
        controls.className = "bi-health-controls";
        const currentField = numberField("Current HP", state.currentHp, value => { state.currentHp = value; updateHpStatus(status, state); });
        const maxField = numberField("Max HP", state.maxHp, value => { state.maxHp = value; if (state.currentHp === null) state.currentHp = value; updateHpStatus(status, state); });
        controls.append(currentField, maxField);

        const amount = document.createElement("input");
        amount.type = "number";
        amount.min = "0";
        amount.step = "1";
        amount.placeholder = "Amount";
        const amountWrap = document.createElement("div");
        amountWrap.className = "bi-field";
        amountWrap.innerHTML = "<label>Change</label>";
        amountWrap.append(amount);
        controls.append(amountWrap);

        const damage = document.createElement("button");
        damage.className = "btn btn-sm btn-outline-secondary";
        damage.textContent = "Damage";
        damage.onclick = () => applyHpChange(state, -readAmount(amount), row, combatant.id);
        const heal = document.createElement("button");
        heal.className = "btn btn-sm btn-outline-secondary";
        heal.textContent = "Heal";
        heal.onclick = () => applyHpChange(state, readAmount(amount), row, combatant.id);
        controls.append(damage, heal);
        row.append(controls);
        list.append(row);
    }

    section.append(list);
    return section;
}

function renderKaijuDashboard(
    id: string,
    name: string,
    state: KaijuCombatState,
    active: boolean,
    root: HTMLElement
): HTMLElement {
    const panel = document.createElement("section");
    panel.className = `bi-kaiju-panel bi-grid${active ? " active" : ""}`;
    panel.dataset.kaijuId = id;

    const head = document.createElement("div");
    head.className = "bi-row";
    const heading = document.createElement("div");
    const h = document.createElement("h5");
    h.className = "h6 mb-1";
    h.textContent = name;
    const phase = document.createElement("div");
    phase.className = "bi-muted";
    phase.textContent = state.behaviourPhase ? `Behaviour / phase: ${state.behaviourPhase}` : "Behaviour / phase not recorded";
    heading.append(h, phase);
    const statuses = document.createElement("div");
    statuses.className = "bi-statuses";
    renderKaijuStatuses(statuses, evaluations.get(id));
    head.append(heading, statuses);
    panel.append(head);

    const chaos = document.createElement("section");
    chaos.innerHTML = `<strong>Chaos Threshold</strong><div class="bi-combat-note">Damage that does not hit a Vulnerable Area reduces this pool. Reaching 0 normally triggers Rampage.</div>`;
    const meter = document.createElement("div");
    meter.className = "bi-chaos-meter";
    const fill = document.createElement("span");
    fill.style.width = `${chaosPercent(state)}%`;
    meter.append(fill);
    chaos.append(meter);
    const chaosControls = document.createElement("div");
    chaosControls.className = "bi-health-controls";
    chaosControls.append(
        numberField("Current", state.chaosCurrent, value => { state.chaosCurrent = value; void evaluateKaiju(id, state, root); }),
        numberField("Maximum", state.chaosMax, value => { state.chaosMax = value; if (state.chaosCurrent === null) state.chaosCurrent = value; void evaluateKaiju(id, state, root); })
    );
    const chaosAmount = actionAmount("Amount");
    chaosControls.append(chaosAmount.wrapper);
    chaosControls.append(actionButton("Damage", () => { state.chaosCurrent = (state.chaosCurrent ?? state.chaosMax ?? 0) - readAmount(chaosAmount.input); refreshDashboard(root); void evaluateKaiju(id, state, root); }));
    chaosControls.append(actionButton("Restore", () => { const next = (state.chaosCurrent ?? 0) + readAmount(chaosAmount.input); state.chaosCurrent = state.chaosMax === null ? next : Math.min(next, state.chaosMax); refreshDashboard(root); void evaluateKaiju(id, state, root); }));
    chaos.append(chaosControls);
    panel.append(chaos);

    const behaviour = document.createElement("div");
    behaviour.className = "bi-field";
    const behaviorLabel = document.createElement("label");
    behaviorLabel.textContent = "Current behaviour / phase";
    const behaviorInput = document.createElement("input");
    behaviorInput.value = state.behaviourPhase;
    behaviorInput.placeholder = "Record the current Behaviour or phase";
    behaviorInput.addEventListener("change", () => { state.behaviourPhase = behaviorInput.value.trim(); });
    behaviour.append(behaviorLabel, behaviorInput);
    panel.append(behaviour);

    const areas = document.createElement("section");
    areas.innerHTML = `<strong>Vulnerable Areas</strong><div class="bi-combat-note">Each weak point has its own HP pool. Targetability can change as Behaviours change.</div>`;
    const areaList = document.createElement("div");
    areaList.className = "bi-vulnerable-list";
    const evaluation = evaluations.get(id);
    for (const area of state.vulnerableAreas) {
        const evaluated = evaluation?.vulnerableAreas.find(candidate => candidate.id === area.id);
        const row = document.createElement("article");
        row.className = "bi-vulnerable-row";
        const rowHead = document.createElement("div");
        rowHead.className = "bi-row";
        const areaName = document.createElement("strong");
        areaName.textContent = area.name || "Vulnerable Area";
        const areaStatuses = document.createElement("div");
        areaStatuses.className = "bi-statuses";
        areaStatuses.append(statusBadge(area.targetable ? "Targetable" : "Not targetable"));
        if (evaluated?.exploited) areaStatuses.append(statusBadge("Exploited", true));
        rowHead.append(areaName, areaStatuses);
        row.append(rowHead);

        const controls = document.createElement("div");
        controls.className = "bi-vulnerable-controls";
        controls.append(
            numberField("Current HP", area.currentHp, value => { area.currentHp = value; void evaluateKaiju(id, state, root); }),
            numberField("Max HP", area.maxHp, value => { area.maxHp = value; if (area.currentHp === null) area.currentHp = value; void evaluateKaiju(id, state, root); })
        );
        const amount = actionAmount("Damage");
        controls.append(amount.wrapper);
        controls.append(actionButton("Apply damage", () => { area.currentHp = Math.max(0, (area.currentHp ?? area.maxHp ?? 0) - readAmount(amount.input)); refreshDashboard(root); void evaluateKaiju(id, state, root); }));
        const targetable = document.createElement("label");
        targetable.className = "bi-inline-checkbox";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = area.targetable;
        checkbox.onchange = () => { area.targetable = checkbox.checked; void evaluateKaiju(id, state, root); };
        targetable.append(checkbox, document.createTextNode(" Targetable"));
        controls.append(targetable);
        row.append(controls);
        areaList.append(row);
    }
    areas.append(areaList);
    panel.append(areas);

    const currentEvaluation = evaluations.get(id);
    if (currentEvaluation?.deathThroesActive || state.deathThroesOverride === "on") {
        const finishing = document.createElement("section");
        finishing.innerHTML = `<strong>Finishing Blow</strong><div class="bi-combat-note">During Death Throes, track damage dealt in a single turn against the configured Finishing Blow value.</div>`;
        const controls = document.createElement("div");
        controls.className = "bi-health-controls";
        controls.append(
            numberField("Target", state.finishingBlowTarget, value => { state.finishingBlowTarget = value; void evaluateKaiju(id, state, root); }),
            numberField("Damage this turn", state.finishingBlowDamageThisTurn, value => { state.finishingBlowDamageThisTurn = value ?? 0; void evaluateKaiju(id, state, root); })
        );
        controls.append(actionButton("Reset turn damage", () => { state.finishingBlowDamageThisTurn = 0; refreshDashboard(root); void evaluateKaiju(id, state, root); }));
        finishing.append(controls);
        panel.append(finishing);
    }

    if (currentEvaluation?.defeated) {
        if (state.defeatedRound === null && lastTurnState) {
            state.defeatedRound = lastTurnState.response.round;
        }
        const deathRattle = document.createElement("div");
        deathRattle.className = "bi-message bi-warning";
        deathRattle.textContent = state.defeatedRound === null
            ? "Kaiju defeated. Resolve its Death Rattle on initiative count 20 of the following round when applicable."
            : `Kaiju defeated in round ${state.defeatedRound}. Death Rattle is due on initiative count 20 of round ${state.defeatedRound + 1} when applicable.`;
        panel.append(deathRattle);
    }

    return panel;
}

function updateHpStatus(container: HTMLElement, state: StandardCombatState): void {
    container.replaceChildren();
    if (state.currentHp === null && state.maxHp === null) {
        container.append(statusBadge("HP not configured"));
        return;
    }

    const current = state.currentHp ?? state.maxHp ?? 0;
    const max = state.maxHp;
    container.append(statusBadge(max === null ? `HP ${current}` : `HP ${current} / ${max}`, current <= 0));
    if (current <= 0) {
        container.append(statusBadge("0 HP", true));
    }
}

function applyHpChange(state: StandardCombatState, delta: number, row: HTMLElement, id: string): void {
    if (!Number.isFinite(delta) || delta === 0) {
        return;
    }
    const base = state.currentHp ?? state.maxHp ?? 0;
    let next = Math.max(0, base + delta);
    if (delta > 0 && state.maxHp !== null) {
        next = Math.min(next, state.maxHp);
    }
    state.currentHp = next;
    const status = row.querySelector<HTMLElement>(".bi-statuses");
    if (status) updateHpStatus(status, state);
    const current = row.querySelector<HTMLInputElement>("[data-health-current]");
    if (current) writeNumber(current, state.currentHp);
    standardStates.set(id, state);
}

function renderKaijuStatuses(container: HTMLElement, evaluation: KaijuEvaluation | undefined): void {
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

async function evaluateKaiju(id: string, state: KaijuCombatState, root: HTMLElement): Promise<void> {
    if (state.chaosCurrent === null || state.vulnerableAreas.some(area => area.currentHp === null || !area.name.trim())) {
        evaluations.delete(id);
        refreshDashboard(root);
        return;
    }

    try {
        const url = await evaluateUrlPromise;
        if (!url) return;
        const response = await fetch(url, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
                chaosThresholdCurrent: Math.trunc(state.chaosCurrent),
                finishingBlowTarget: state.finishingBlowTarget === null ? null : Math.trunc(state.finishingBlowTarget),
                finishingBlowDamageThisTurn: Math.trunc(state.finishingBlowDamageThisTurn),
                vulnerableAreas: state.vulnerableAreas.map(area => ({
                    id: area.id,
                    name: area.name,
                    currentHitPoints: Math.trunc(area.currentHp ?? 0),
                    targetable: area.targetable,
                    exploitedOverride: overrideToBoolean(area.exploitedOverride)
                })),
                rampageOverride: overrideToBoolean(state.rampageOverride),
                deathThroesOverride: overrideToBoolean(state.deathThroesOverride),
                defeatedOverride: overrideToBoolean(state.defeatedOverride)
            })
        });
        if (!response.ok) {
            evaluations.delete(id);
            return;
        }
        const evaluation = await response.json() as KaijuEvaluation;
        evaluations.set(id, evaluation);
        if (evaluation.defeated && state.defeatedRound === null && lastTurnState) {
            state.defeatedRound = lastTurnState.response.round;
        }
        refreshDashboard(root);
    } catch {
        evaluations.delete(id);
    }
}

function refreshDashboard(root: HTMLElement): void {
    root.querySelector("[data-combat-dashboard]")?.remove();
    schedule(root);
}

async function resolveEvaluateUrl(root: HTMLElement): Promise<string> {
    const contextUrl = root.dataset.toolContextUrl;
    if (!contextUrl) {
        return "/api/kaiju/evaluate";
    }

    const response = await fetch(contextUrl, { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (!response.ok) {
        throw new Error(`Tool Host context returned HTTP ${response.status}.`);
    }
    const context = await response.json() as { apiBaseUrl: string };
    return `${context.apiBaseUrl}/upstream/api/kaiju/evaluate`;
}

function createKaijuState(): KaijuCombatState {
    return {
        chaosMax: null,
        chaosCurrent: null,
        finishingBlowTarget: null,
        finishingBlowDamageThisTurn: 0,
        behaviourPhase: "",
        vulnerableAreas: [createArea(1)],
        rampageOverride: "auto",
        deathThroesOverride: "auto",
        defeatedOverride: "auto",
        defeatedRound: null
    };
}

function createArea(index: number): VulnerableAreaState {
    return {
        id: crypto.randomUUID(),
        name: `Vulnerable Area ${index}`,
        maxHp: null,
        currentHp: null,
        targetable: true,
        exploitedOverride: "auto"
    };
}

function bindOverride(
    panel: HTMLElement,
    name: string,
    setter: (value: OverrideValue) => void,
    value: OverrideValue
): void {
    const select = panel.querySelector<HTMLSelectElement>(`[data-kaiju-override='${name}']`)!;
    select.value = value;
    select.addEventListener("change", () => setter(select.value as OverrideValue));
}

function overrideToBoolean(value: OverrideValue): boolean | null {
    return value === "auto" ? null : value === "on";
}

function numberField(labelText: string, value: number | null, setter: (value: number | null) => void): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "bi-field";
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.type = "number";
    input.step = "1";
    input.min = "0";
    if (labelText === "Current HP") input.dataset.healthCurrent = "true";
    writeNumber(input, value);
    input.addEventListener("change", () => setter(readNumber(input)));
    wrap.append(label, input);
    return wrap;
}

function actionAmount(labelText: string): { wrapper: HTMLElement; input: HTMLInputElement } {
    const wrapper = document.createElement("div");
    wrapper.className = "bi-field";
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.placeholder = "Amount";
    wrapper.append(label, input);
    return { wrapper, input };
}

function actionButton(text: string, action: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-sm btn-outline-secondary";
    button.textContent = text;
    button.onclick = action;
    return button;
}

function statusBadge(text: string, strong = false): HTMLElement {
    const badge = document.createElement("span");
    badge.className = `bi-status${strong ? " strong" : ""}`;
    badge.textContent = text;
    return badge;
}

function readNumber(input: HTMLInputElement): number | null {
    const value = input.value.trim();
    if (!value) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function writeNumber(input: HTMLInputElement, value: number | null): void {
    input.value = value === null ? "" : String(value);
}

function readAmount(input: HTMLInputElement): number {
    return Math.max(0, readNumber(input) ?? 0);
}

function chaosPercent(state: KaijuCombatState): number {
    if (state.chaosMax === null || state.chaosMax <= 0 || state.chaosCurrent === null) return 0;
    return Math.max(0, Math.min(100, (state.chaosCurrent / state.chaosMax) * 100));
}
