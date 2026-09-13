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

let lastPreview: PreviewDetail | null = null;
let observer: MutationObserver | null = null;
let scheduled = false;

export function initializeConditionLayoutUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || observer) return;

    installStyles(root.ownerDocument);
    window.addEventListener("block-initiative:preview", event => {
        lastPreview = (event as CustomEvent<PreviewDetail>).detail ?? null;
        schedule(root);
    });

    observer = new MutationObserver(() => schedule(root));
    observer.observe(root, { childList: true, subtree: true });
    schedule(root);
}

function installStyles(documentRef: Document): void {
    if (documentRef.head.querySelector("style[data-role='condition-layout-ui-style']")) return;

    const style = documentRef.createElement("style");
    style.dataset.role = "condition-layout-ui-style";
    style.textContent = `
.block-initiative-app .bi-health-row.bi-condition-merged{display:grid;grid-template-columns:max-content minmax(12rem,1fr);gap:.45rem .75rem;align-items:center}
.block-initiative-app .bi-health-row.bi-condition-merged > .bi-row{grid-column:1/-1}
.block-initiative-app .bi-health-row.bi-condition-merged > .bi-hp-editor,
.block-initiative-app .bi-health-row.bi-condition-merged > .bi-combat-controls{grid-column:1}
.block-initiative-app .bi-health-row.bi-condition-merged > .bi-combat-condition-control{grid-column:2}
.block-initiative-app .bi-combat-condition-control{display:grid;grid-template-columns:auto minmax(0,1fr);gap:.45rem;align-items:center;min-width:0}
.block-initiative-app .bi-combat-condition-label{font-size:.78rem;font-weight:600;opacity:.78;white-space:nowrap}
.block-initiative-app .bi-kaiju-panel > .bi-combat-condition-control{border-top:1px solid var(--bi-border);padding-top:.55rem}
.block-initiative-app .bi-condition-only-list{display:grid;gap:.4rem}
.block-initiative-app .bi-condition-only-row{margin:0}
@media(max-width:700px){
  .block-initiative-app .bi-health-row.bi-condition-merged{grid-template-columns:1fr}
  .block-initiative-app .bi-health-row.bi-condition-merged > .bi-row,
  .block-initiative-app .bi-health-row.bi-condition-merged > .bi-hp-editor,
  .block-initiative-app .bi-health-row.bi-condition-merged > .bi-combat-controls,
  .block-initiative-app .bi-health-row.bi-condition-merged > .bi-combat-condition-control{grid-column:1}
  .block-initiative-app .bi-combat-condition-control{grid-template-columns:1fr}
}
`;
    documentRef.head.append(style);
}

function schedule(root: HTMLElement): void {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
        scheduled = false;
        enhance(root);
    });
}

function enhance(root: HTMLElement): void {
    if (!lastPreview) return;

    const dashboard = root.querySelector<HTMLElement>("[data-combat-dashboard]");
    if (!dashboard) return;

    const conditionSection = dashboard.querySelector<HTMLElement>("[data-condition-dashboard]");
    if (!conditionSection || conditionSection.dataset.conditionLayoutPlaceholder === "true") return;

    const subtitle = dashboard.querySelector<HTMLElement>(":scope > div:first-child > .bi-muted");
    if (subtitle) {
        subtitle.textContent = "Health, conditions, and Kaiju state remain editable even when another block is active.";
    }

    const conditionRows = Array.from(conditionSection.querySelectorAll<HTMLElement>(".bi-condition-dashboard-row"));
    const rowByCombatantId = new Map<string, HTMLElement>();
    for (const row of conditionRows) {
        const editor = row.querySelector<HTMLElement>("[data-condition-editor-for]");
        const combatantId = editor?.dataset.conditionEditorFor;
        if (combatantId) rowByCombatantId.set(combatantId, row);
    }

    const represented = new Set<string>();
    const standardCombatants = lastPreview.response.orderedCombatants.filter(
        combatant => combatant.allianceId !== "players" && combatant.blockType === "standard"
    );
    const healthRows = Array.from(dashboard.querySelectorAll<HTMLElement>(".bi-health-row"));
    standardCombatants.forEach((combatant, index) => {
        const target = healthRows[index];
        const sourceRow = rowByCombatantId.get(combatant.id);
        if (!target || !sourceRow) return;

        const editor = sourceRow.querySelector<HTMLElement>("[data-condition-editor-for]");
        if (!editor) return;
        attachConditionEditor(target, editor);
        target.classList.add("bi-condition-merged");
        represented.add(combatant.id);
    });

    const kaijuCombatants = lastPreview.response.orderedCombatants.filter(combatant => combatant.blockType === "kaiju");
    const kaijuPanels = Array.from(dashboard.querySelectorAll<HTMLElement>(".bi-kaiju-panel"));
    kaijuCombatants.forEach((combatant, index) => {
        const target = kaijuPanels[index];
        const sourceRow = rowByCombatantId.get(combatant.id);
        if (!target || !sourceRow) return;

        const editor = sourceRow.querySelector<HTMLElement>("[data-condition-editor-for]");
        if (!editor) return;
        attachConditionEditor(target, editor);
        represented.add(combatant.id);
    });

    const remaining = lastPreview.response.orderedCombatants.filter(combatant => !represented.has(combatant.id));
    if (remaining.length) {
        const list = document.createElement("div");
        list.className = "bi-condition-only-list";
        list.setAttribute("aria-label", "Combatants without health tracking");

        for (const combatant of remaining) {
            const row = rowByCombatantId.get(combatant.id);
            if (!row) continue;
            row.classList.add("bi-condition-only-row");
            list.append(row);
        }

        if (list.childElementCount) dashboard.append(list);
    }

    conditionSection.replaceChildren();
    conditionSection.hidden = true;
    conditionSection.dataset.conditionLayoutPlaceholder = "true";
}

function attachConditionEditor(target: HTMLElement, editor: HTMLElement): void {
    if (target.querySelector(":scope > .bi-combat-condition-control")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "bi-combat-condition-control";
    const label = document.createElement("span");
    label.className = "bi-combat-condition-label";
    label.textContent = "Conditions";
    wrapper.append(label, editor);
    target.append(wrapper);
}
