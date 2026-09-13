import { registerAfterRender, requestEnhancement } from "./render-lifecycle";
import { searchRulesCoreConditions, toHostedToolHref } from "./rules-core-conditions";
import type { ConditionSearchMatch, RuleBrowserLink } from "./rules-core-conditions";

type TrackedCondition = {
    id: string;
    name: string;
    note: string;
    browserLink: RuleBrowserLink | null;
    origin: "rules-core" | "source" | "manual";
};

type PreviewDetail = {
    response: {
        orderedCombatants: Array<{ id: string; name: string }>;
        blocks: Array<{ id: string; memberOrder: string[] }>;
    };
};

type TurnStateDetail = {
    response: {
        activeBlockId: string | null;
        blocks: Array<{ id: string; memberOrder: string[] }>;
    };
};

const trackedConditions = new Map<string, TrackedCondition[]>();
const initializedDocuments = new WeakSet<Document>();
let lastPreview: PreviewDetail | null = null;
let lastTurnState: TurnStateDetail | null = null;
let initialized = false;

export function initializeConditionTrackingUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    installStyles(root.ownerDocument);
    installDismissHandlers(root.ownerDocument);

    window.addEventListener("block-initiative:preview", event => {
        lastPreview = (event as CustomEvent<PreviewDetail>).detail ?? null;
        requestEnhancement();
    });
    window.addEventListener("block-initiative:state", event => {
        lastTurnState = (event as CustomEvent<TurnStateDetail>).detail ?? null;
        requestEnhancement();
    });

    registerAfterRender("condition-tracking", 90, () => {
        enhanceSetup(root);
        enhancePreview(root);
        enhanceRunner(root);
        ensureConditionDashboard(root);
    });
}

function installStyles(documentRef: Document): void {
    if (documentRef.head.querySelector("style[data-role='condition-tracking-ui-style']")) return;
    const style = documentRef.createElement("style");
    style.dataset.role = "condition-tracking-ui-style";
    style.textContent = `
.block-initiative-app .bi-condition-setup{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;border-top:1px solid var(--bi-border);margin-top:.65rem;padding-top:.65rem}
.block-initiative-app .bi-condition-editor{position:relative;display:flex;flex:1 1 auto;flex-wrap:wrap;gap:.35rem;align-items:center;min-width:0}
.block-initiative-app .bi-condition-chips,.block-initiative-app .bi-condition-inline{display:flex;flex-wrap:wrap;gap:.28rem;align-items:center}
.block-initiative-app .bi-condition-chip,.block-initiative-app .bi-condition-summary-chip{border:1px solid currentColor;border-radius:999px;padding:.14rem .48rem;font-size:.78rem;line-height:1.25;background:transparent;color:inherit}
.block-initiative-app .bi-condition-chip{cursor:pointer}
.block-initiative-app .bi-condition-chip-wrap{position:relative;display:inline-flex}
.block-initiative-app .bi-condition-add{white-space:nowrap}
.block-initiative-app .bi-condition-picker,.block-initiative-app .bi-condition-menu{position:absolute;z-index:60;top:calc(100% + .3rem);right:0;display:grid;gap:.45rem;width:min(22rem,calc(100vw - 2rem));padding:.6rem;border:1px solid var(--bi-border);border-radius:.55rem;background:var(--bs-body-bg,#fff);box-shadow:0 .45rem 1.2rem rgba(0,0,0,.22)}
.block-initiative-app .bi-condition-menu{right:auto;left:0;width:min(18rem,calc(100vw - 2rem))}
.block-initiative-app .bi-condition-picker[hidden],.block-initiative-app .bi-condition-menu[hidden]{display:none!important}
.block-initiative-app .bi-condition-results{display:grid;gap:.2rem;max-height:14rem;overflow:auto}
.block-initiative-app .bi-condition-result{display:block;width:100%;text-align:left;border:1px solid var(--bi-border);border-radius:.4rem;background:transparent;padding:.42rem .5rem}
.block-initiative-app .bi-condition-result strong,.block-initiative-app .bi-condition-result small{display:block}
.block-initiative-app .bi-condition-result small{opacity:.72}
.block-initiative-app .bi-condition-picker .bi-field,.block-initiative-app .bi-condition-menu .bi-field{display:grid;gap:.2rem}
.block-initiative-app .bi-condition-picker label,.block-initiative-app .bi-condition-menu label{font-size:.72rem;font-weight:600;opacity:.78;margin:0}
.block-initiative-app .bi-condition-picker-actions,.block-initiative-app .bi-condition-menu-actions{display:flex;flex-wrap:wrap;gap:.35rem;justify-content:flex-end}
.block-initiative-app .bi-condition-search-status{font-size:.8rem;opacity:.72}
.block-initiative-app .bi-condition-dashboard-list{display:grid;gap:.4rem;margin-top:.45rem}
.block-initiative-app .bi-condition-dashboard-row{display:grid;grid-template-columns:minmax(8rem,14rem) 1fr;gap:.55rem;align-items:center;border:1px solid var(--bi-border);border-radius:.5rem;padding:.5rem .6rem}
.block-initiative-app .bi-condition-dashboard-row.active{border-width:2px}
.block-initiative-app .bi-condition-inline{margin-right:auto}
@media(max-width:600px){.block-initiative-app .bi-condition-dashboard-row{grid-template-columns:1fr}}
`;
    documentRef.head.append(style);
}

function installDismissHandlers(documentRef: Document): void {
    if (initializedDocuments.has(documentRef)) return;
    initializedDocuments.add(documentRef);

    documentRef.addEventListener("pointerdown", event => {
        const target = event.target;
        const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
        if (element?.closest(".bi-condition-editor")) return;
        closeAllConditionPopovers(documentRef);
    });
    documentRef.addEventListener("keydown", event => {
        if (event.key === "Escape") closeAllConditionPopovers(documentRef);
    });
}

function enhanceSetup(root: HTMLElement): void {
    for (const card of root.querySelectorAll<HTMLElement>(".bi-entry[data-id]")) {
        const combatantId = card.dataset.id;
        if (!combatantId || card.querySelector(":scope > .bi-condition-setup")) continue;

        const strip = document.createElement("section");
        strip.className = "bi-condition-setup";
        const label = document.createElement("strong");
        label.textContent = "Conditions";
        strip.append(label, buildConditionEditor(combatantId, root));

        const combatSetup = card.querySelector<HTMLElement>(":scope > [data-combat-setup]");
        combatSetup ? card.insertBefore(strip, combatSetup) : card.append(strip);
    }
}

function enhancePreview(root: HTMLElement): void {
    if (!lastPreview) return;
    const blocks = Array.from(root.querySelectorAll<HTMLElement>(".bi-block"));
    lastPreview.response.blocks.forEach((block, blockIndex) => {
        const blockElement = blocks[blockIndex];
        if (!blockElement) return;
        const rows = Array.from(blockElement.querySelectorAll<HTMLElement>(".bi-member"));
        block.memberOrder.forEach((combatantId, memberIndex) => {
            const row = rows[memberIndex];
            if (row) paintInlineConditions(row, combatantId);
        });
    });
}

function enhanceRunner(root: HTMLElement): void {
    if (!lastTurnState?.response.activeBlockId) return;
    const active = lastTurnState.response.blocks.find(block => block.id === lastTurnState!.response.activeBlockId);
    if (!active) return;

    const rows = Array.from(root.querySelectorAll<HTMLElement>(".bi-runner-member"));
    active.memberOrder.forEach((combatantId, memberIndex) => {
        const row = rows[memberIndex];
        if (row) paintInlineConditions(row, combatantId);
    });
}

function paintInlineConditions(row: HTMLElement, combatantId: string): void {
    const existing = row.querySelector<HTMLElement>(":scope > .bi-condition-inline");
    const conditions = conditionsFor(combatantId);
    if (!conditions.length) {
        existing?.remove();
        return;
    }

    const signature = JSON.stringify(conditions.map(condition => [condition.id, condition.name, condition.note]));
    if (existing?.dataset.conditionSignature === signature) return;

    const container = existing ?? document.createElement("span");
    container.className = "bi-condition-inline";
    container.dataset.conditionSignature = signature;
    container.replaceChildren(...conditions.map(condition => {
        const chip = document.createElement("span");
        chip.className = "bi-condition-summary-chip";
        chip.textContent = conditionLabel(condition);
        chip.title = condition.note ? `${condition.name}: ${condition.note}` : condition.name;
        return chip;
    }));

    if (!existing) {
        const name = row.firstElementChild;
        name ? name.after(container) : row.prepend(container);
    }
}

function ensureConditionDashboard(root: HTMLElement): void {
    const dashboard = root.querySelector<HTMLElement>("[data-combat-dashboard]");
    if (!dashboard || !lastPreview || dashboard.querySelector("[data-condition-dashboard]")) return;

    const activeBlock = lastTurnState?.response.blocks.find(block => block.id === lastTurnState!.response.activeBlockId);
    const activeIds = new Set(activeBlock?.memberOrder ?? []);
    const section = document.createElement("section");
    section.dataset.conditionDashboard = "true";

    const heading = document.createElement("div");
    heading.innerHTML = `<h5 class="h6 mb-1">Conditions</h5><div class="bi-note">Track Rules Core or manual conditions. Block Initiative does not enforce condition effects.</div>`;
    section.append(heading);

    const list = document.createElement("div");
    list.className = "bi-condition-dashboard-list";
    for (const combatant of lastPreview.response.orderedCombatants) {
        const row = document.createElement("article");
        row.className = `bi-condition-dashboard-row${activeIds.has(combatant.id) ? " active" : ""}`;
        const name = document.createElement("strong");
        name.textContent = combatant.name;
        row.append(name, buildConditionEditor(combatant.id, root));
        list.append(row);
    }
    section.append(list);
    dashboard.append(section);
}

function buildConditionEditor(combatantId: string, root: HTMLElement): HTMLElement {
    const editor = document.createElement("div");
    editor.className = "bi-condition-editor";
    editor.dataset.conditionEditorFor = combatantId;
    renderConditionEditor(editor, combatantId, root);
    return editor;
}

function renderConditionEditor(editor: HTMLElement, combatantId: string, root: HTMLElement): void {
    editor.replaceChildren();

    const chips = document.createElement("div");
    chips.className = "bi-condition-chips";
    for (const condition of conditionsFor(combatantId)) {
        chips.append(buildConditionChip(condition, combatantId, root));
    }

    const add = document.createElement("button");
    add.type = "button";
    add.className = "btn btn-sm btn-outline-secondary bi-condition-add";
    add.textContent = "+ Condition";
    add.setAttribute("aria-haspopup", "dialog");
    add.setAttribute("aria-expanded", "false");

    const picker = buildConditionPicker(combatantId, root, add);
    add.onclick = event => {
        event.stopPropagation();
        const shouldOpen = picker.hidden;
        closeAllConditionPopovers(editor.ownerDocument);
        picker.hidden = !shouldOpen;
        add.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
        if (shouldOpen) picker.querySelector<HTMLInputElement>("[data-role='condition-search']")?.focus();
    };

    editor.append(chips, add, picker);
}

function buildConditionChip(condition: TrackedCondition, combatantId: string, root: HTMLElement): HTMLElement {
    const wrapper = document.createElement("span");
    wrapper.className = "bi-condition-chip-wrap";

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "bi-condition-chip";
    chip.dataset.conditionId = condition.id;
    chip.textContent = conditionLabel(condition);
    chip.title = `Manage ${condition.name}`;
    chip.setAttribute("aria-haspopup", "dialog");
    chip.setAttribute("aria-expanded", "false");

    const menu = document.createElement("div");
    menu.className = "bi-condition-menu";
    menu.setAttribute("role", "dialog");
    menu.setAttribute("aria-label", `Manage ${condition.name}`);
    menu.hidden = true;

    const title = document.createElement("strong");
    title.textContent = condition.name;
    const noteField = document.createElement("div");
    noteField.className = "bi-field";
    const noteLabel = document.createElement("label");
    noteLabel.textContent = "Duration / note";
    const note = document.createElement("input");
    note.value = condition.note;
    note.placeholder = "e.g. 2r or until save";
    note.addEventListener("input", () => {
        condition.note = note.value.trim();
        refreshConditionLabels(root, condition);
    });
    noteField.append(noteLabel, note);

    const actions = document.createElement("div");
    actions.className = "bi-condition-menu-actions";
    const href = toHostedToolHref(condition.browserLink);
    if (href) {
        const view = document.createElement("a");
        view.className = "btn btn-sm btn-outline-secondary";
        view.href = href;
        view.target = "_blank";
        view.rel = "noopener noreferrer";
        view.textContent = "View rule";
        actions.append(view);
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn-sm btn-outline-danger";
    remove.textContent = "Remove";
    remove.onclick = () => {
        const remaining = conditionsFor(combatantId).filter(candidate => candidate.id !== condition.id);
        trackedConditions.set(combatantId, remaining);
        refreshConditionUi(root);
    };
    actions.append(remove);
    menu.append(title, noteField, actions);

    chip.onclick = event => {
        event.stopPropagation();
        const shouldOpen = menu.hidden;
        closeAllConditionPopovers(wrapper.ownerDocument);
        menu.hidden = !shouldOpen;
        chip.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
        if (shouldOpen) note.focus();
    };

    wrapper.append(chip, menu);
    return wrapper;
}

function buildConditionPicker(combatantId: string, root: HTMLElement, trigger: HTMLButtonElement): HTMLElement {
    const picker = document.createElement("div");
    picker.className = "bi-condition-picker";
    picker.setAttribute("role", "dialog");
    picker.setAttribute("aria-label", "Add condition");
    picker.hidden = true;

    const searchField = document.createElement("div");
    searchField.className = "bi-field";
    const searchLabel = document.createElement("label");
    searchLabel.textContent = "Condition";
    const search = document.createElement("input");
    search.dataset.role = "condition-search";
    search.placeholder = "Search Rules Core or enter a manual condition";
    search.autocomplete = "off";
    searchField.append(searchLabel, search);

    const noteField = document.createElement("div");
    noteField.className = "bi-field";
    const noteLabel = document.createElement("label");
    noteLabel.textContent = "Duration / note (optional)";
    const note = document.createElement("input");
    note.placeholder = "e.g. 2r or until save";
    noteField.append(noteLabel, note);

    const status = document.createElement("div");
    status.className = "bi-condition-search-status";
    const results = document.createElement("div");
    results.className = "bi-condition-results";

    const actions = document.createElement("div");
    actions.className = "bi-condition-picker-actions";
    const manual = document.createElement("button");
    manual.type = "button";
    manual.className = "btn btn-sm btn-outline-secondary";
    manual.textContent = "Add manually";
    manual.disabled = true;
    manual.onclick = () => {
        const name = search.value.trim();
        if (!name) return;
        addCondition(combatantId, {
            id: crypto.randomUUID(),
            name,
            note: note.value.trim(),
            browserLink: null,
            origin: "manual"
        });
        closeAllConditionPopovers(picker.ownerDocument);
        refreshConditionUi(root);
    };
    actions.append(manual);

    let timer: number | null = null;
    let sequence = 0;
    search.addEventListener("input", () => {
        const query = search.value.trim();
        manual.disabled = query.length === 0;
        results.replaceChildren();
        if (timer !== null) window.clearTimeout(timer);

        if (!root.dataset.toolContextUrl) {
            status.textContent = query
                ? "Rules Core search is available when hosted. You can still add this condition manually."
                : "Enter a condition name. Manual conditions work in standalone mode.";
            return;
        }
        if (query.length < 2) {
            status.textContent = "Type at least 2 characters to search Rules Core, or add the name manually.";
            return;
        }

        const current = ++sequence;
        status.textContent = "Searching Rules Core…";
        timer = window.setTimeout(() => {
            void searchRulesCoreConditions(query).then(matches => {
                if (current !== sequence || search.value.trim() !== query) return;
                paintSearchResults(results, matches, combatantId, note, root);
                status.textContent = matches.length
                    ? `${matches.length} Rules Core match${matches.length === 1 ? "" : "es"}.`
                    : "No Rules Core matches. You can add this condition manually.";
            }).catch(() => {
                if (current !== sequence) return;
                results.replaceChildren();
                status.textContent = "Rules Core condition search is unavailable. You can still add this condition manually.";
            });
        }, 180);
    });

    picker.addEventListener("pointerdown", event => event.stopPropagation());
    picker.append(searchField, noteField, status, results, actions);
    trigger.addEventListener("click", () => {
        if (!root.dataset.toolContextUrl && !search.value.trim()) {
            status.textContent = "Enter a condition name. Manual conditions work in standalone mode.";
        } else if (!status.textContent) {
            status.textContent = "Type at least 2 characters to search Rules Core, or add the name manually.";
        }
    });
    return picker;
}

function paintSearchResults(
    container: HTMLElement,
    matches: ConditionSearchMatch[],
    combatantId: string,
    note: HTMLInputElement,
    root: HTMLElement
): void {
    container.replaceChildren();
    for (const match of matches) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "bi-condition-result";
        const name = document.createElement("strong");
        name.textContent = match.displayName;
        const meta = document.createElement("small");
        meta.textContent = [match.editionDisplayName, match.packageDisplayName].filter(Boolean).join(" · ");
        button.append(name, meta);
        button.onclick = () => {
            addCondition(combatantId, {
                id: crypto.randomUUID(),
                name: match.displayName,
                note: note.value.trim(),
                browserLink: match.browserLink,
                origin: match.kind === "resolved" ? "rules-core" : "source"
            });
            closeAllConditionPopovers(button.ownerDocument);
            refreshConditionUi(root);
        };
        container.append(button);
    }
}

function addCondition(combatantId: string, condition: TrackedCondition): void {
    const conditions = conditionsFor(combatantId);
    trackedConditions.set(combatantId, [...conditions, condition]);
}

function conditionsFor(combatantId: string): TrackedCondition[] {
    return trackedConditions.get(combatantId) ?? [];
}

function conditionLabel(condition: TrackedCondition): string {
    return condition.note ? `${condition.name} · ${condition.note}` : condition.name;
}

function refreshConditionLabels(root: HTMLElement, condition: TrackedCondition): void {
    for (const chip of root.querySelectorAll<HTMLButtonElement>(".bi-condition-chip[data-condition-id]")) {
        if (chip.dataset.conditionId === condition.id) chip.textContent = conditionLabel(condition);
    }
    enhancePreview(root);
    enhanceRunner(root);
}

function refreshConditionUi(root: HTMLElement): void {
    for (const editor of root.querySelectorAll<HTMLElement>("[data-condition-editor-for]")) {
        const combatantId = editor.dataset.conditionEditorFor;
        if (combatantId) renderConditionEditor(editor, combatantId, root);
    }
    enhancePreview(root);
    enhanceRunner(root);
    requestEnhancement();
}

function closeAllConditionPopovers(documentRef: Document): void {
    for (const popover of documentRef.querySelectorAll<HTMLElement>(".bi-condition-picker:not([hidden]), .bi-condition-menu:not([hidden])")) {
        popover.hidden = true;
    }
    for (const trigger of documentRef.querySelectorAll<HTMLElement>(".bi-condition-add[aria-expanded='true'], .bi-condition-chip[aria-expanded='true']")) {
        trigger.setAttribute("aria-expanded", "false");
    }
}
