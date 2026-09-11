const D20_SIDES = 20;

type ClickHandler = HTMLButtonElement["onclick"];

export function initializeInitiativeRollUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement)) return;

    installStyles(root.ownerDocument);
    const observer = new MutationObserver(() => configure(root));
    observer.observe(root, { childList: true, subtree: true });
    configure(root);
}

function configure(root: HTMLElement): void {
    for (const card of root.querySelectorAll<HTMLElement>(".bi-entry[data-id]")) {
        enhanceCombatant(card);
    }

    const method = root.querySelector<HTMLSelectElement>("[data-role='enemy-method']");
    const enemySide = method?.closest<HTMLElement>(".bi-side");
    if (!method || !enemySide) return;

    simplifyMethodSelection(method);

    const groups = enemySide.querySelector<HTMLElement>("[data-role='enemy-groups']");
    const addGroup = enemySide.querySelector<HTMLButtonElement>("[data-action='add-group']");
    const addKaiju = enemySide.querySelector<HTMLButtonElement>("[data-action='add-kaiju']");
    if (!groups || !addGroup || !addKaiju) return;

    if (enemySide.dataset.rollUiReady !== "true") {
        enemySide.dataset.rollUiReady = "true";
        const originalAddGroup = addGroup.onclick;
        (enemySide as HTMLElement & { __originalAddGroup?: ClickHandler }).__originalAddGroup = originalAddGroup;

        const actionRow = addGroup.closest<HTMLElement>(".bi-row");
        if (actionRow) {
            actionRow.classList.add("bi-enemy-create-row");
            const cluster = document.createElement("div");
            cluster.className = "bi-actions bi-enemy-create-buttons";
            actionRow.insertBefore(cluster, actionRow.firstChild);
            cluster.append(addGroup, addKaiju);

            const rollAll = document.createElement("button");
            rollAll.type = "button";
            rollAll.className = "btn btn-sm btn-outline-primary";
            rollAll.textContent = "Roll all averages";
            rollAll.title = "Roll every standard enemy separately with its modifier, then calculate each tactical group's initiative.";
            rollAll.dataset.action = "roll-all-enemies";
            rollAll.onclick = () => rollAllEnemies(enemySide, method.value);
            cluster.append(rollAll);

            const help = actionRow.querySelector<HTMLElement>(".bi-muted");
            if (help) help.dataset.role = "enemy-roster-help";
        }

        addGroup.addEventListener("click", event => {
            if (method.value !== "individual") return;
            event.preventDefault();
            event.stopImmediatePropagation();
            addIndividualEnemy(enemySide, addGroup, originalAddGroup);
        }, true);

        method.addEventListener("change", () => queueMicrotask(() => {
            refresh(enemySide, method);
            refreshAdditionalSideGroups(root, method);
        }));
        root.addEventListener("input", event => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            const group = target.closest<HTMLElement>(".bi-tactical-group");
            if (!group) return;
            if (target.dataset.field === "initiative" || target.dataset.field === "modifier") {
                refreshGroupSummary(group, method.value);
            }
        });
    }

    refresh(enemySide, method);
    refreshAdditionalSideGroups(root, method);
}

function simplifyMethodSelection(method: HTMLSelectElement): void {
    const shared = method.querySelector<HTMLOptionElement>("option[value='shared']");
    shared?.remove();
    const grouped = method.querySelector<HTMLOptionElement>("option[value='average']");
    if (grouped && grouped.textContent !== "Tactical groups") grouped.textContent = "Tactical groups";
    const individual = method.querySelector<HTMLOptionElement>("option[value='individual']");
    if (individual && individual.textContent !== "Individual placement") individual.textContent = "Individual placement";
    if (method.value !== "individual") method.value = "average";

    const label = method.closest<HTMLElement>(".bi-field")?.querySelector("label");
    if (label && label.textContent !== "Non-player initiative method") {
        label.textContent = "Non-player initiative method";
    }
}

function installStyles(documentRef: Document): void {
    if (documentRef.head.querySelector("style[data-role='initiative-roll-ui-style']")) return;
    const style = documentRef.createElement("style");
    style.dataset.role = "initiative-roll-ui-style";
    style.textContent = `
.block-initiative-app .bi-enemy-create-row{align-items:center}
.block-initiative-app .bi-enemy-create-buttons{justify-content:flex-start}
.block-initiative-app .bi-roll-line{display:flex;gap:.4rem;align-items:center;margin-top:.3rem;flex-wrap:wrap}
.block-initiative-app .bi-roll-audit{font-size:.8rem;opacity:.75}
.block-initiative-app .bi-group-roll-actions{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap}
.block-initiative-app .bi-group-roll-actions[hidden],.block-initiative-app [data-action='roll-group'][hidden]{display:none!important}
.block-initiative-app .bi-group-initiative-result{font-size:.86rem;font-weight:700;white-space:nowrap;margin-left:.15rem}
.block-initiative-app .bi-individual-flat-group{border:0!important;border-radius:0!important;overflow:visible!important}
.block-initiative-app .bi-individual-flat-group>.bi-group-head{display:none!important}
.block-initiative-app .bi-individual-flat-group>.bi-group-body{padding:0!important}
.block-initiative-app .bi-individual-flat-group [data-action='add-member']{display:none!important}
.block-initiative-app [data-role='shared-roll-wrap']{display:none!important}
`;
    documentRef.head.append(style);
}

function refresh(enemySide: HTMLElement, method: HTMLSelectElement): void {
    const addGroup = enemySide.querySelector<HTMLButtonElement>("[data-action='add-group']");
    if (!addGroup) return;

    const grouped = method.value !== "individual";
    setTextIfChanged(addGroup, grouped ? "+ Tactical group" : "+ Enemy");

    const help = enemySide.querySelector<HTMLElement>("[data-role='enemy-method-help']");
    if (help) {
        const helpText = grouped
            ? "Grouped non-player blocks use one calculated initiative. Roll average rolls every member separately with its own modifier; Single roll uses one d20 plus the highest initiative modifier in the group."
            : "Each non-player creature rolls separately and is placed individually. Turn blocks are derived afterward from side and initiative order.";
        setTextIfChanged(help, helpText);
    }

    const rosterHelp = enemySide.querySelector<HTMLElement>("[data-role='enemy-roster-help']");
    if (rosterHelp) {
        rosterHelp.hidden = !grouped;
        if (grouped) {
            setTextIfChanged(rosterHelp, "Tactical groups are DM-authored roster units. Roll average averages modified member totals; Single roll uses the group's highest modifier.");
        }
    }

    for (const card of enemySide.querySelectorAll<HTMLElement>(".bi-entry[data-id]")) enhanceCombatant(card);
    for (const group of enemySide.querySelectorAll<HTMLElement>(".bi-tactical-group")) {
        enhanceGroup(group);
        group.classList.toggle("bi-individual-flat-group", !grouped);
        updateGroupRollingUi(group, grouped);
        refreshGroupSummary(group, method.value);
    }
}

function refreshAdditionalSideGroups(root: HTMLElement, method: HTMLSelectElement): void {
    const grouped = method.value !== "individual";
    for (const group of root.querySelectorAll<HTMLElement>(".bi-other-side-block")) {
        const kaiju = group.dataset.sideBlockType === "kaiju";
        enhanceGroup(group);
        group.classList.remove("bi-individual-flat-group");
        updateGroupRollingUi(group, grouped && !kaiju);
        refreshGroupSummary(group, kaiju ? "individual" : method.value);
        for (const card of group.querySelectorAll<HTMLElement>(".bi-entry[data-id]")) enhanceCombatant(card);
    }
}

function addIndividualEnemy(enemySide: HTMLElement, addGroup: HTMLButtonElement, originalAddGroup: ClickHandler): void {
    let firstGroup = enemySide.querySelector<HTMLElement>(".bi-tactical-group");
    if (!firstGroup && originalAddGroup) {
        originalAddGroup.call(addGroup, new PointerEvent("click"));
        firstGroup = enemySide.querySelector<HTMLElement>(".bi-tactical-group");
    }
    firstGroup?.querySelector<HTMLButtonElement>("[data-action='add-member']")?.click();
}

function enhanceCombatant(card: HTMLElement): void {
    if (card.dataset.rollControlReady === "true") return;
    const wrap = card.querySelector<HTMLElement>("[data-role='initiative-wrap']");
    const input = card.querySelector<HTMLInputElement>("[data-field='initiative']");
    if (!wrap || !input) return;
    card.dataset.rollControlReady = "true";

    const line = document.createElement("div");
    line.className = "bi-roll-line";
    const roll = document.createElement("button");
    roll.type = "button";
    roll.className = "btn btn-sm btn-outline-secondary";
    roll.textContent = "Roll";
    roll.title = "Roll d20 and apply this combatant's initiative modifier.";
    const audit = document.createElement("span");
    audit.className = "bi-roll-audit";
    audit.dataset.role = "roll-audit";
    roll.onclick = () => rollCombatant(card);
    line.append(roll, audit);
    wrap.append(line);
}

function enhanceGroup(group: HTMLElement): void {
    if (group.dataset.rollControlReady === "true") return;
    const actions = group.querySelector<HTMLElement>(".bi-group-head .bi-badges");
    if (!actions) return;
    group.dataset.rollControlReady = "true";

    const controls = document.createElement("div");
    controls.className = "bi-group-roll-actions";
    controls.dataset.role = "group-roll-actions";

    const rollAverage = document.createElement("button");
    rollAverage.type = "button";
    rollAverage.className = "btn btn-sm btn-outline-primary";
    rollAverage.textContent = "Roll average";
    rollAverage.title = "Roll each group member separately as d20 + its own modifier, then use the average as group initiative.";
    rollAverage.dataset.action = "roll-group";
    rollAverage.onclick = () => rollMembersIndividually(group);

    const singleRoll = document.createElement("button");
    singleRoll.type = "button";
    singleRoll.className = "btn btn-sm btn-outline-primary";
    singleRoll.textContent = "Single roll";
    singleRoll.title = "Roll one d20 for the group and add the highest initiative modifier in the group.";
    singleRoll.dataset.action = "roll-shared-group";
    singleRoll.onclick = () => applyOneRollToGroup(group, rollD20());

    const result = document.createElement("span");
    result.className = "bi-group-initiative-result";
    result.dataset.role = "group-initiative-result";
    result.textContent = "Group initiative —";

    controls.append(rollAverage, singleRoll, result);
    actions.insertBefore(controls, actions.firstChild);
}

function updateGroupRollingUi(group: HTMLElement, grouped: boolean): void {
    const controls = group.querySelector<HTMLElement>("[data-role='group-roll-actions']");
    if (controls) controls.hidden = !grouped;

    for (const card of group.querySelectorAll<HTMLElement>("[data-role='group-members'] .bi-entry[data-id]")) {
        const initiative = card.querySelector<HTMLInputElement>("[data-field='initiative']");
        const rollLine = card.querySelector<HTMLElement>(".bi-roll-line");
        if (initiative) {
            initiative.readOnly = false;
            initiative.title = "";
        }
        if (rollLine) rollLine.hidden = false;
    }
}

function rollAllEnemies(enemySide: HTMLElement, mode: string): void {
    if (mode === "individual") {
        for (const card of enemySide.querySelectorAll<HTMLElement>(".bi-tactical-group .bi-entry[data-id]")) {
            rollCombatant(card);
        }
    } else {
        for (const group of enemySide.querySelectorAll<HTMLElement>(".bi-tactical-group")) {
            rollMembersIndividually(group);
        }
    }

    for (const card of enemySide.querySelectorAll<HTMLElement>("[data-role='kaiju-list'] .bi-entry[data-id]")) {
        rollCombatant(card);
    }
}

function rollMembersIndividually(group: HTMLElement): void {
    for (const card of group.querySelectorAll<HTMLElement>("[data-role='group-members'] .bi-entry[data-id]")) {
        rollCombatant(card);
    }
    refreshGroupSummary(group, "average");
}

function applyOneRollToGroup(group: HTMLElement, raw: number): void {
    const members = Array.from(group.querySelectorAll<HTMLElement>("[data-role='group-members'] .bi-entry[data-id]"));
    if (!members.length) return;

    const highestModifier = Math.max(...members.map(initiativeModifier));
    const total = raw + highestModifier;
    for (const member of members) {
        const initiative = member.querySelector<HTMLInputElement>("[data-field='initiative']");
        if (!initiative) continue;
        initiative.value = formatNumber(total);
        initiative.dispatchEvent(new Event("input", { bubbles: true }));

        const audit = member.querySelector<HTMLElement>("[data-role='roll-audit']");
        if (audit?.textContent) audit.textContent = "";
    }

    refreshGroupSummary(group, "average");
}

function rollCombatant(card: HTMLElement): void {
    const initiative = card.querySelector<HTMLInputElement>("[data-field='initiative']");
    if (!initiative) return;
    const modifier = initiativeModifier(card);
    const raw = rollD20();
    const total = raw + modifier;
    initiative.value = formatNumber(total);
    initiative.dispatchEvent(new Event("input", { bubbles: true }));
    const audit = card.querySelector<HTMLElement>("[data-role='roll-audit']");
    if (audit) setTextIfChanged(audit, `d20 ${raw} ${formatModifier(modifier)} = ${formatNumber(total)}`);
}

function refreshGroupSummary(group: HTMLElement, mode: string): void {
    const summary = group.querySelector<HTMLElement>("[data-role='group-summary']");
    if (!summary) return;
    const members = Array.from(group.querySelectorAll<HTMLElement>("[data-role='group-members'] .bi-entry[data-id]"));
    const count = members.length;
    const generic = group.classList.contains("bi-other-side-block");
    const noun = generic ? (count === 1 ? "creature" : "creatures") : (count === 1 ? "enemy" : "enemies");
    const result = group.querySelector<HTMLElement>("[data-role='group-initiative-result']");

    if (mode === "individual") {
        setTextIfChanged(summary, `${count} ${noun} · individual placement`);
        if (result) setTextIfChanged(result, "Group initiative —");
        return;
    }

    const totals = members
        .map(member => member.querySelector<HTMLInputElement>("[data-field='initiative']")?.value.trim() ?? "")
        .filter(value => value !== "")
        .map(Number)
        .filter(Number.isFinite);

    if (totals.length === 0) {
        setTextIfChanged(summary, `${count} ${noun} · not rolled`);
        if (result) setTextIfChanged(result, "Group initiative —");
        return;
    }
    if (totals.length < count) {
        setTextIfChanged(summary, `${count} ${noun} · ${totals.length}/${count} rolled`);
        if (result) setTextIfChanged(result, "Group initiative —");
        return;
    }

    const average = totals.reduce((sum, value) => sum + value, 0) / totals.length;
    const formatted = formatNumber(average);
    setTextIfChanged(summary, `${count} ${noun} · group initiative ${formatted}`);
    if (result) setTextIfChanged(result, `Group initiative ${formatted}`);
}

function initiativeModifier(card: HTMLElement): number {
    const input = card.querySelector<HTMLInputElement>("[data-field='modifier']");
    const value = Number(input?.value ?? 0);
    return Number.isFinite(value) ? value : 0;
}

function rollD20(): number {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return (buffer[0] % D20_SIDES) + 1;
}

function formatModifier(value: number): string {
    return value >= 0 ? `+ ${formatNumber(value)}` : `− ${formatNumber(Math.abs(value))}`;
}

function formatNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function setTextIfChanged(element: HTMLElement, value: string): void {
    if (element.textContent !== value) {
        element.textContent = value;
    }
}
