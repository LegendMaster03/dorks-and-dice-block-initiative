import { searchRulesCoreConditions } from "../integrations/rules-core/conditions";
import { toHostedToolHref } from "../integrations/rules-core/client";
import type { ConditionSearchMatch } from "../integrations/rules-core/conditions";
import {
    addCondition,
    conditionLabel,
    conditionsFor,
    removeCondition,
    updateConditionLevel,
    updateConditionNote
} from "./condition-model";
import type { TrackedCondition } from "./condition-model";

export type ConditionsChangedDetail = {
    combatantId: string;
    structural: boolean;
};

const initializedDocuments = new WeakSet<Document>();

export function initializeConditionEditorUi(documentRef: Document): void {
    installStyles(documentRef);
    installDismissHandlers(documentRef);
}

export function createConditionEditor(
    combatantId: string,
    root: HTMLElement
): HTMLElement {
    const editor = document.createElement("div");
    editor.className = "bi-condition-editor";
    editor.dataset.conditionEditorFor = combatantId;
    renderConditionEditor(editor, combatantId, root);
    return editor;
}

export function renderConditionEditor(
    editor: HTMLElement,
    combatantId: string,
    root: HTMLElement
): void {
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
        if (shouldOpen) {
            picker.querySelector<HTMLInputElement>(
                "[data-role='condition-search']")?.focus();
        }
    };

    editor.append(chips, add, picker);
}

function buildConditionChip(
    condition: TrackedCondition,
    combatantId: string,
    root: HTMLElement
): HTMLElement {
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

    const levelField = document.createElement("div");
    levelField.className = "bi-field";
    const levelLabel = document.createElement("label");
    levelLabel.textContent = "Level (optional)";
    const level = document.createElement("input");
    level.type = "number";
    level.min = "1";
    level.step = "1";
    level.value =
        condition.level === null
            ? ""
            : String(condition.level);
    level.addEventListener("input", () => {
        const raw = level.value.trim();
        const parsed =
            raw && Number.isInteger(Number(raw))
                && Number(raw) >= 1
                ? Number(raw)
                : null;
        const updated = updateConditionLevel(
            combatantId,
            condition.id,
            parsed);
        if (!updated) return;
        refreshConditionLabels(root, updated);
        notifyConditionChange(root, combatantId, false);
    });
    levelField.append(levelLabel, level);

    const noteField = document.createElement("div");
    noteField.className = "bi-field";
    const noteLabel = document.createElement("label");
    noteLabel.textContent = "Duration / note";
    const note = document.createElement("input");
    note.value = condition.note;
    note.placeholder = "e.g. 2r or until save";
    note.addEventListener("input", () => {
        const updated = updateConditionNote(
            combatantId,
            condition.id,
            note.value.trim());
        if (!updated) return;

        refreshConditionLabels(root, updated);
        notifyConditionChange(root, combatantId, false);
    });
    noteField.append(noteLabel, note);

    const actions = document.createElement("div");
    actions.className = "bi-condition-menu-actions";
    const href =
        toHostedToolHref(condition.browserLink)
        ?? condition.browserHref;
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
        removeCondition(combatantId, condition.id);
        notifyConditionChange(root, combatantId, true);
    };
    actions.append(remove);
    menu.append(title, levelField, noteField, actions);

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

function buildConditionPicker(
    combatantId: string,
    root: HTMLElement,
    trigger: HTMLButtonElement
): HTMLElement {
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

    const levelField = document.createElement("div");
    levelField.className = "bi-field";
    const levelLabel = document.createElement("label");
    levelLabel.textContent = "Level (optional)";
    const level = document.createElement("input");
    level.type = "number";
    level.min = "1";
    level.step = "1";
    level.placeholder = "e.g. 2";
    levelField.append(levelLabel, level);

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
            level: readConditionLevel(level),
            note: note.value.trim(),
            browserLink: null,
            browserHref: null,
            origin: "manual"
        });
        closeAllConditionPopovers(picker.ownerDocument);
        notifyConditionChange(root, combatantId, true);
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
                ? "Rules Core search is available when hosted. "
                    + "You can still add this condition manually."
                : "Enter a condition name. Manual conditions work in standalone mode.";
            return;
        }

        if (query.length < 2) {
            status.textContent =
                "Type at least 2 characters to search Rules Core, "
                + "or add the name manually.";
            return;
        }

        const current = ++sequence;
        status.textContent = "Searching Rules Core…";
        timer = window.setTimeout(() => {
            void searchRulesCoreConditions(query)
                .then(matches => {
                    if (current !== sequence
                        || search.value.trim() !== query) {
                        return;
                    }

                    paintSearchResults(
                        results,
                        matches,
                        combatantId,
                        level,
                        note,
                        root);
                    status.textContent = matches.length
                        ? `${matches.length} Rules Core match${matches.length === 1 ? "" : "es"}.`
                        : "No Rules Core matches. "
                            + "You can add this condition manually.";
                })
                .catch(() => {
                    if (current !== sequence) return;
                    results.replaceChildren();
                    status.textContent =
                        "Rules Core condition search is unavailable. "
                        + "You can still add this condition manually.";
                });
        }, 180);
    });

    picker.addEventListener(
        "pointerdown",
        event => event.stopPropagation());
    picker.append(
        searchField,
        levelField,
        noteField,
        status,
        results,
        actions);

    trigger.addEventListener("click", () => {
        if (!root.dataset.toolContextUrl
            && !search.value.trim()) {
            status.textContent =
                "Enter a condition name. "
                + "Manual conditions work in standalone mode.";
        } else if (!status.textContent) {
            status.textContent =
                "Type at least 2 characters to search Rules Core, "
                + "or add the name manually.";
        }
    });

    return picker;
}

function paintSearchResults(
    container: HTMLElement,
    matches: ConditionSearchMatch[],
    combatantId: string,
    level: HTMLInputElement,
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
        meta.textContent = [
            match.editionDisplayName,
            match.packageDisplayName
        ].filter(Boolean).join(" · ");

        button.append(name, meta);
        button.onclick = () => {
            addCondition(combatantId, {
                id: crypto.randomUUID(),
                name: match.displayName,
                level: readConditionLevel(level),
                note: note.value.trim(),
                browserLink: match.browserLink,
                browserHref: null,
                origin:
                    match.kind === "resolved"
                        ? "rules-core"
                        : "source"
            });
            closeAllConditionPopovers(button.ownerDocument);
            notifyConditionChange(root, combatantId, true);
        };

        container.append(button);
    }
}

function refreshConditionLabels(
    root: HTMLElement,
    condition: TrackedCondition
): void {
    for (const chip of root.querySelectorAll<HTMLButtonElement>(
        ".bi-condition-chip[data-condition-id]"
    )) {
        if (chip.dataset.conditionId === condition.id) {
            chip.textContent = conditionLabel(condition);
        }
    }
}

function notifyConditionChange(
    root: HTMLElement,
    combatantId: string,
    structural: boolean
): void {
    root.dispatchEvent(
        new CustomEvent<ConditionsChangedDetail>(
            "block-initiative:conditions-changed",
            {
                detail: {
                    combatantId,
                    structural
                }
            }));
}

function closeAllConditionPopovers(documentRef: Document): void {
    for (const popover of documentRef.querySelectorAll<HTMLElement>(
        ".bi-condition-picker:not([hidden]), "
        + ".bi-condition-menu:not([hidden])"
    )) {
        popover.hidden = true;
    }

    for (const trigger of documentRef.querySelectorAll<HTMLElement>(
        ".bi-condition-add[aria-expanded='true'], "
        + ".bi-condition-chip[aria-expanded='true']"
    )) {
        trigger.setAttribute("aria-expanded", "false");
    }
}

function installDismissHandlers(documentRef: Document): void {
    if (initializedDocuments.has(documentRef)) return;
    initializedDocuments.add(documentRef);

    documentRef.addEventListener("pointerdown", event => {
        const target = event.target;
        const element =
            target instanceof Element
                ? target
                : target instanceof Node
                    ? target.parentElement
                    : null;

        if (element?.closest(".bi-condition-editor")) return;
        closeAllConditionPopovers(documentRef);
    });

    documentRef.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeAllConditionPopovers(documentRef);
        }
    });
}

function installStyles(documentRef: Document): void {
    if (documentRef.head.querySelector(
        "style[data-role='condition-tracking-ui-style']"
    )) {
        return;
    }

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
.block-initiative-app .bi-condition-inline{margin-right:auto}
`;
    documentRef.head.append(style);
}


function readConditionLevel(
    input: HTMLInputElement
): number | null {
    const raw = input.value.trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isInteger(value) && value >= 1
        ? value
        : null;
}
