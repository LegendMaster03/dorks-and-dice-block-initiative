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
            rollAll.textContent = "Roll all enemies";
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

        method.addEventListener("change", () => queueMicrotask(() => refresh(enemySide, method)));
        root.addEventListener("input", event => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            const group = target.closest<HTMLElement>(".bi-tactical-group");
            if (!group) return;
            if (target.dataset.field === "modifier" && method.value === "shared") recalculateSharedGroup(group);
            if (target.dataset.field === "initiative" || target.dataset.field === "modifier") refreshGroupSummary(group, method.value);
        });
    }

    refresh(enemySide, method);
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
.block-initiative-app .bi-shared-roll-control{display:flex;gap:.35rem;align-items:center;flex-wrap:wrap}
.block-initiative-app .bi-shared-roll-control label{font-size:.82rem;font-weight:600;opacity:.8;margin:0}
.block-initiative-app .bi-shared-roll-control input{width:4.5rem;max-width:4.5rem}
.block-initiative-app .bi-shared-result{font-size:.82rem;font-weight:600;white-space:nowrap}
.block-initiative-app .bi-individual-flat-group{border:0!important;border-radius:0!important;overflow:visible!important}
.block-initiative-app .bi-individual-flat-group>.bi-group-head{display:none!important}
.block-initiative-app .bi-individual-flat-group>.bi-group-body{padding:0!important}
.block-initiative-app .bi-individual-flat-group [data-action='add-member']{display:none!important}
.block-initiative-app .bi-shared-ui-active [data-role='shared-roll-wrap']{display:none!important}
.block-initiative-app .bi-shared-ui-active [data-role='initiative-wrap'] .bi-roll-line{display:none!important}
.block-initiative-app .bi-shared-ui-active [data-field='initiative']{cursor:default}
`;
    documentRef.head.append(style);
}

function refresh(enemySide: HTMLElement, method: HTMLSelectElement): void {
    const addGroup = enemySide.querySelector<HTMLButtonElement>("[data-action='add-group']");
    if (!addGroup) return;

    const desiredLabel = method.value === "individual" ? "+ Enemy" : "+ Tactical group";
    setTextIfChanged(addGroup, desiredLabel);

    const help = enemySide.querySelector<HTMLElement>("[data-role='enemy-method-help']");
    if (help) {
        const helpText = method.value === "average"
            ? "Each enemy rolls d20 + its own modifier. The adjusted totals are averaged to place each tactical group."
            : method.value === "shared"
                ? "Roll one d20 for the tactical group. Each member's modifier is applied, then the adjusted totals are averaged for group placement."
                : "Each enemy rolls separately and is placed individually. Turn blocks are derived afterward from initiative order; there are no manual tactical groups in this mode.";
        setTextIfChanged(help, helpText);
    }

    const rosterHelp = enemySide.querySelector<HTMLElement>("[data-role='enemy-roster-help']");
    if (rosterHelp) {
        rosterHelp.hidden = method.value === "individual";
        if (method.value !== "individual") {
            setTextIfChanged(rosterHelp, "Tactical groups are DM-authored roster units; turn blocks are still derived from initiative placement.");
        }
    }

    for (const card of enemySide.querySelectorAll<HTMLElement>(".bi-entry[data-id]")) enhanceCombatant(card);
    for (const group of enemySide.querySelectorAll<HTMLElement>(".bi-tactical-group")) {
        enhanceGroup(group, method);
        group.classList.toggle("bi-individual-flat-group", method.value === "individual");
        group.classList.toggle("bi-shared-ui-active", method.value === "shared");
        updateGroupRollingUi(group, method.value);
        refreshGroupSummary(group, method.value);
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

function enhanceGroup(group: HTMLElement, method: HTMLSelectElement): void {
    if (group.dataset.rollControlReady === "true") return;
    const actions = group.querySelector<HTMLElement>(".bi-group-head .bi-badges");
    if (!actions) return;
    group.dataset.rollControlReady = "true";

    const roll = document.createElement("button");
    roll.type = "button";
    roll.className = "btn btn-sm btn-outline-primary";
    roll.textContent = "Roll group";
    roll.dataset.action = "roll-group";
    roll.onclick = () => rollGroup(group, method.value);

    const shared = document.createElement("div");
    shared.className = "bi-shared-roll-control";
    shared.dataset.role = "shared-d20-control";
    shared.innerHTML = `<label>Group d20</label><input type="number" min="1" max="20" step="1" data-role="shared-d20" placeholder="1–20"><button type="button" class="btn btn-sm btn-outline-primary" data-action="roll-shared-group">Roll</button><span class="bi-shared-result" data-role="shared-result">Initiative —</span><span class="bi-roll-audit" data-role="shared-audit" hidden></span>`;
    shared.querySelector<HTMLInputElement>("[data-role='shared-d20']")!.addEventListener("input", () => recalculateSharedGroup(group));
    shared.querySelector<HTMLButtonElement>("[data-action='roll-shared-group']")!.onclick = () => {
        const input = shared.querySelector<HTMLInputElement>("[data-role='shared-d20']")!;
        input.value = String(rollD20());
        input.dispatchEvent(new Event("input", { bubbles: true }));
    };

    actions.insertBefore(roll, actions.firstChild);
    actions.insertBefore(shared, roll.nextSibling);
}

function updateGroupRollingUi(group: HTMLElement, mode: string): void {
    const roll = group.querySelector<HTMLButtonElement>("[data-action='roll-group']");
    const shared = group.querySelector<HTMLElement>("[data-role='shared-d20-control']");
    if (roll) roll.hidden = mode !== "average";
    if (shared) shared.hidden = mode !== "shared";

    for (const card of group.querySelectorAll<HTMLElement>("[data-role='group-members'] .bi-entry[data-id]")) {
        const initiative = card.querySelector<HTMLInputElement>("[data-field='initiative']");
        const rollLine = card.querySelector<HTMLElement>(".bi-roll-line");
        if (initiative) {
            initiative.readOnly = mode === "shared";
            initiative.title = mode === "shared" ? "Calculated from the tactical group's d20 roll and this member's modifier." : "";
        }
        if (rollLine) rollLine.hidden = mode === "shared";
    }

    if (mode === "shared") recalculateSharedGroup(group);
}

function rollAllEnemies(enemySide: HTMLElement, mode: string): void {
    if (mode === "individual") {
        for (const card of enemySide.querySelectorAll<HTMLElement>(".bi-tactical-group .bi-entry[data-id]")) rollCombatant(card);
    } else {
        for (const group of enemySide.querySelectorAll<HTMLElement>(".bi-tactical-group")) rollGroup(group, mode);
    }
    for (const card of enemySide.querySelectorAll<HTMLElement>("[data-role='kaiju-list'] .bi-entry[data-id]")) rollCombatant(card);
}

function rollGroup(group: HTMLElement, mode: string): void {
    if (mode === "shared") {
        const input = group.querySelector<HTMLInputElement>("[data-role='shared-d20']");
        if (!input) return;
        input.value = String(rollD20());
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return;
    }

    for (const card of group.querySelectorAll<HTMLElement>("[data-role='group-members'] .bi-entry[data-id]")) rollCombatant(card);
    refreshGroupSummary(group, mode);
}

function rollCombatant(card: HTMLElement): void {
    const initiative = card.querySelector<HTMLInputElement>("[data-field='initiative']");
    if (!initiative || initiative.readOnly) return;
    const modifier = initiativeModifier(card);
    const raw = rollD20();
    const total = raw + modifier;
    initiative.value = formatNumber(total);
    initiative.dispatchEvent(new Event("input", { bubbles: true }));
    const audit = card.querySelector<HTMLElement>("[data-role='roll-audit']");
    if (audit) setTextIfChanged(audit, `d20 ${raw} ${formatModifier(modifier)} = ${formatNumber(total)}`);
}

function recalculateSharedGroup(group: HTMLElement): void {
    const rawInput = group.querySelector<HTMLInputElement>("[data-role='shared-d20']");
    const internal = group.querySelector<HTMLInputElement>("[data-role='shared-roll']");
    const audit = group.querySelector<HTMLElement>("[data-role='shared-audit']");
    const result = group.querySelector<HTMLElement>("[data-role='shared-result']");
    if (!rawInput || !internal) return;

    const rawText = rawInput.value.trim();
    const raw = Number(rawText);
    if (!rawText || !Number.isInteger(raw) || raw < 1 || raw > D20_SIDES) {
        if (internal.value !== "") {
            internal.value = "";
            internal.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (result) setTextIfChanged(result, "Initiative —");
        if (audit) setTextIfChanged(audit, "Enter or roll one d20; member modifiers are applied automatically.");
        refreshGroupSummary(group, "shared");
        return;
    }

    const members = Array.from(group.querySelectorAll<HTMLElement>("[data-role='group-members'] .bi-entry[data-id]"));
    const modifiers = members.map(initiativeModifier);
    const adjusted = modifiers.map(modifier => raw + modifier);
    const average = adjusted.length ? adjusted.reduce((sum, value) => sum + value, 0) / adjusted.length : raw;

    for (let index = 0; index < members.length; index++) {
        const initiative = members[index].querySelector<HTMLInputElement>("[data-field='initiative']");
        if (initiative) initiative.value = formatNumber(adjusted[index]);
    }

    const next = formatNumber(average);
    if (internal.value !== next) {
        internal.value = next;
        internal.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (result) setTextIfChanged(result, `Initiative ${next}`);
    if (audit) {
        const detail = adjusted.length ? `Adjusted totals ${adjusted.map(formatNumber).join(", ")}` : "No members yet";
        setTextIfChanged(audit, `${detail}; group initiative ${next}.`);
    }
    refreshGroupSummary(group, "shared");
}

function refreshGroupSummary(group: HTMLElement, mode: string): void {
    const summary = group.querySelector<HTMLElement>("[data-role='group-summary']");
    if (!summary) return;
    const members = Array.from(group.querySelectorAll<HTMLElement>("[data-role='group-members'] .bi-entry[data-id]"));
    const count = members.length;
    const noun = count === 1 ? "enemy" : "enemies";

    if (mode === "individual") {
        setTextIfChanged(summary, `${count} ${noun} · individual placement`);
        return;
    }

    if (mode === "shared") {
        const groupInitiative = group.querySelector<HTMLInputElement>("[data-role='shared-roll']")?.value.trim() ?? "";
        setTextIfChanged(summary, groupInitiative ? `${count} ${noun} · initiative ${groupInitiative}` : `${count} ${noun} · not rolled`);
        return;
    }

    const totals = members
        .map(member => member.querySelector<HTMLInputElement>("[data-field='initiative']")?.value.trim() ?? "")
        .filter(value => value !== "")
        .map(Number)
        .filter(Number.isFinite);

    if (totals.length === 0) {
        setTextIfChanged(summary, `${count} ${noun} · not rolled`);
        return;
    }
    if (totals.length < count) {
        setTextIfChanged(summary, `${count} ${noun} · ${totals.length}/${count} rolled`);
        return;
    }

    const average = totals.reduce((sum, value) => sum + value, 0) / totals.length;
    setTextIfChanged(summary, `${count} ${noun} · average ${formatNumber(average)}`);
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
