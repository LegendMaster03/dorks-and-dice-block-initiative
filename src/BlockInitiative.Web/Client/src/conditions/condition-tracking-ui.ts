import { registerAfterRender, requestEnhancement } from "../render-lifecycle";
import {
    createConditionEditor,
    initializeConditionEditorUi,
    renderConditionEditor
} from "./condition-editor";
import type { ConditionsChangedDetail } from "./condition-editor";
import {
    conditionLabel,
    conditionsFor,
    pruneConditions
} from "./condition-model";

type PreviewDetail = {
    response: {
        orderedCombatants: Array<{ id: string; name: string }>;
        blocks: Array<{ id: string; memberOrder: string[] }>;
    };
};

const runnerConditionEditors = new Map<string, HTMLElement>();
let lastPreview: PreviewDetail | null = null;
let initialized = false;

export function initializeConditionTrackingUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    initializeConditionEditorUi(root.ownerDocument);

    window.addEventListener("block-initiative:preview", event => {
        lastPreview =
            (event as CustomEvent<PreviewDetail>).detail
            ?? null;

        const activeIds = new Set(
            lastPreview?.response.orderedCombatants
                .map(combatant => combatant.id)
            ?? []);

        for (const id of runnerConditionEditors.keys()) {
            if (!activeIds.has(id)) {
                runnerConditionEditors.delete(id);
            }
        }
        pruneConditions(activeIds);

        requestEnhancement();
    });

    root.addEventListener(
        "block-initiative:conditions-changed",
        event => {
            const detail =
                (event as CustomEvent<ConditionsChangedDetail>).detail;
            if (!detail?.combatantId) return;

            if (detail.structural) {
                refreshEditorsForCombatant(
                    root,
                    detail.combatantId);
            }

            enhancePreview(root);
            requestEnhancement();
        });

    registerAfterRender(
        "condition-tracking",
        90,
        () => {
            enhanceSetup(root);
            enhancePreview(root);
        });
}

export function ensureRunnerConditionEditor(
    root: HTMLElement,
    combatantId: string
): HTMLElement {
    let editor = runnerConditionEditors.get(combatantId);

    if (!editor) {
        editor = createConditionEditor(combatantId, root);
        editor.dataset.conditionEditorRole = "runner";
        runnerConditionEditors.set(combatantId, editor);
    } else if (!root.contains(editor)) {
        renderConditionEditor(editor, combatantId, root);
    }

    return editor;
}

function enhanceSetup(root: HTMLElement): void {
    for (const card of root.querySelectorAll<HTMLElement>(
        ".bi-entry[data-id]"
    )) {
        const combatantId = card.dataset.id;
        if (!combatantId
            || card.querySelector(
                ":scope > .bi-condition-setup")) {
            continue;
        }

        const strip = document.createElement("section");
        strip.className = "bi-condition-setup";

        const label = document.createElement("strong");
        label.textContent = "Conditions";

        strip.append(
            label,
            createConditionEditor(combatantId, root));

        const combatSetup =
            card.querySelector<HTMLElement>(
                ":scope > [data-combat-setup]");
        combatSetup
            ? card.insertBefore(strip, combatSetup)
            : card.append(strip);
    }
}

function enhancePreview(root: HTMLElement): void {
    if (!lastPreview) return;

    const blocks = Array.from(
        root.querySelectorAll<HTMLElement>(".bi-block"));

    lastPreview.response.blocks.forEach(
        (block, blockIndex) => {
            const blockElement = blocks[blockIndex];
            if (!blockElement) return;

            const rows = Array.from(
                blockElement.querySelectorAll<HTMLElement>(
                    ".bi-member"));

            block.memberOrder.forEach(
                (combatantId, memberIndex) => {
                    const row = rows[memberIndex];
                    if (row) {
                        paintInlineConditions(
                            row,
                            combatantId);
                    }
                });
        });
}

function paintInlineConditions(
    row: HTMLElement,
    combatantId: string
): void {
    const existing =
        row.querySelector<HTMLElement>(
            ":scope > .bi-condition-inline");
    const conditions = conditionsFor(combatantId);

    if (!conditions.length) {
        existing?.remove();
        return;
    }

    const signature = JSON.stringify(
        conditions.map(condition => [
            condition.id,
            condition.name,
            condition.note
        ]));

    if (existing?.dataset.conditionSignature === signature) {
        return;
    }

    const container =
        existing ?? document.createElement("span");
    container.className = "bi-condition-inline";
    container.dataset.conditionSignature = signature;

    container.replaceChildren(
        ...conditions.map(condition => {
            const chip = document.createElement("span");
            chip.className = "bi-condition-summary-chip";
            chip.textContent = conditionLabel(condition);
            chip.title = condition.note
                ? `${condition.name}: ${condition.note}`
                : condition.name;
            return chip;
        }));

    if (!existing) {
        const name = row.firstElementChild;
        name
            ? name.after(container)
            : row.prepend(container);
    }
}

function refreshEditorsForCombatant(
    root: HTMLElement,
    combatantId: string
): void {
    for (const editor of root.querySelectorAll<HTMLElement>(
        "[data-condition-editor-for]"
    )) {
        if (editor.dataset.conditionEditorFor !== combatantId) {
            continue;
        }

        renderConditionEditor(
            editor,
            combatantId,
            root);
    }
}
