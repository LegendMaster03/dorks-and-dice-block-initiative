import type {
    InitiativePreviewRequest,
    InitiativePreviewResponse
} from "../api";
import {
    createBadge,
    createBlockBadges,
    formatNumber,
    friendlyAlliance
} from "./presentation";

export type InitiativePreviewViewOptions = {
    results: HTMLElement;
    preview: InitiativePreviewResponse;
    request: InitiativePreviewRequest;
    editingRunningEncounter: boolean;
    groupName: (groupId: string) => string;
    onApplyManualOrder: (order: string[]) => void;
    onStart: () => void;
    onResume: () => void;
};

/**
 * Renders initiative review/adjudication without owning encounter state.
 *
 * The application supplies callbacks for rebuilding a tied order and for
 * starting/resuming the runner. This module owns only preview presentation.
 */
export function renderInitiativePreview(
    options: InitiativePreviewViewOptions
): void {
    const {
        results,
        preview,
        request,
        editingRunningEncounter
    } = options;

    results.replaceChildren();
    results.append(renderSummary(preview, editingRunningEncounter));

    if (preview.issues.length) {
        results.append(renderTie(options));
    }

    if (preview.usesManualOrderOverride) {
        const note = document.createElement("div");
        note.className = "bi-message bi-success";
        note.textContent =
            "DM tie order applied. Original initiative rolls and "
            + "tactical-group calculations are unchanged.";
        results.append(note);
    }

    results.append(renderBlockOrder(options));
}

function renderSummary(
    preview: InitiativePreviewResponse,
    editingRunningEncounter: boolean
): HTMLElement {
    const summary = document.createElement("section");
    summary.className = "card card-body";

    const row = document.createElement("div");
    row.className = "bi-row";

    const text = document.createElement("div");
    const title = document.createElement("h3");
    title.className = "h5 mb-1";
    title.textContent = preview.requiresAdjudication
        ? "One ruling is needed"
        : editingRunningEncounter
            ? "Updated initiative blocks are ready"
            : "Initiative blocks are ready";

    const detail = document.createElement("div");
    detail.className = "bi-muted";
    detail.textContent = preview.requiresAdjudication
        ? "Resolve the opposing tie below before continuing."
        : editingRunningEncounter
            ? "Review the new block order, then resume on the same active turn."
            : "Review the derived order, then start encounter tracking.";

    text.append(title, detail);
    row.append(
        text,
        createBadge(
            `${preview.blocks.length} block${preview.blocks.length === 1 ? "" : "s"}`));
    summary.append(row);
    return summary;
}

function renderBlockOrder(
    options: InitiativePreviewViewOptions
): HTMLElement {
    const {
        preview,
        request,
        editingRunningEncounter,
        groupName
    } = options;

    const byId = new Map(
        preview.orderedCombatants.map(combatant => [
            combatant.id,
            combatant
        ]));

    const section = document.createElement("section");
    section.className = "card card-body";

    const heading = document.createElement("h3");
    heading.className = "h5 mb-1";
    heading.textContent = "Block order";

    const description = document.createElement("p");
    description.className = "bi-muted";
    description.textContent =
        "Initiative placement is sorted normally. Every contiguous run from "
        + "one side becomes one turn block; Standard and Kaiju members can "
        + "therefore share a side turn without creating consecutive same-side blocks.";

    section.append(heading, description);

    const list = document.createElement("div");
    list.className = "bi-blocks";

    preview.blocks.forEach((block, index) => {
        const element = document.createElement("article");
        element.className = "bi-block";

        const head = document.createElement("div");
        head.className = "bi-block-head";

        const label = document.createElement("strong");
        label.textContent = `Block ${index + 1}`;
        head.append(
            label,
            createBlockBadges(block.allianceId, block.blockType));

        const body = document.createElement("div");
        body.className = "bi-block-body";

        for (const id of block.memberOrder) {
            const combatant = byId.get(id);
            const row = document.createElement("div");
            row.className = "bi-member";

            const name = document.createElement("span");
            name.textContent = combatant?.name ?? id;

            const initiative = document.createElement("span");
            initiative.className = "bi-muted";

            if (combatant) {
                const groupLabel = combatant.tacticalGroupId
                    ? ` · ${groupName(combatant.tacticalGroupId)}`
                    : "";
                const effective =
                    combatant.effectiveInitiative !== combatant.initiativeTotal
                        ? ` → position ${formatNumber(combatant.effectiveInitiative)}`
                        : "";
                const kaiju =
                    combatant.blockType === "kaiju" ? " · Kaiju" : "";

                initiative.textContent =
                    `Roll ${formatNumber(combatant.initiativeTotal)}`
                    + effective
                    + groupLabel
                    + kaiju;
            }

            row.append(name, initiative);
            body.append(row);
        }

        if (block.allianceId === "players"
            && block.memberOrder.length > 1) {
            const note = document.createElement("div");
            note.className = "bi-muted mt-2";
            note.textContent =
                "Players in this block may choose their order.";
            body.append(note);
        }

        element.append(head, body);
        list.append(element);
    });

    section.append(list, renderRoundBoundary(preview));

    if (!preview.requiresAdjudication) {
        section.append(renderStartAction(options));
    }

    return section;
}

function renderStartAction(
    options: InitiativePreviewViewOptions
): HTMLElement {
    const action = document.createElement("div");
    action.className = "bi-row bi-primary";

    const text = document.createElement("div");
    text.innerHTML = options.editingRunningEncounter
        ? "<strong>Resume?</strong><div class='bi-muted'>"
            + "The current round and active side turn will be preserved.</div>"
        : "<strong>Ready?</strong><div class='bi-muted'>"
            + "Tracking starts on the first active block in round 1.</div>";

    const button = document.createElement("button");
    button.className = "btn btn-primary";
    button.dataset.action =
        options.editingRunningEncounter
            ? "resume-encounter"
            : "start-encounter";
    button.textContent =
        options.editingRunningEncounter
            ? "Resume encounter"
            : "Start encounter";
    button.onclick =
        options.editingRunningEncounter
            ? options.onResume
            : options.onStart;

    action.append(text, button);
    return action;
}

function renderTie(
    options: InitiativePreviewViewOptions
): HTMLElement {
    const { preview, request } = options;

    const box = document.createElement("section");
    box.className = "bi-message bi-warning";

    const title = document.createElement("strong");
    title.textContent = "DM ruling needed";

    const description = document.createElement("p");
    description.textContent =
        "Opposing placements tied. Reorder the tied units only; "
        + "grouped units stay together.";

    box.append(title, description);

    for (const issue of preview.issues) {
        const list = document.createElement("ol");
        list.className = "bi-list";
        list.dataset.tie = "true";

        for (const unit of tieUnits(
            issue.combatantIds,
            preview,
            request,
            options.groupName)) {
            const item = document.createElement("li");
            item.className = "bi-row";
            item.dataset.ids = unit.ids.join(",");

            const label = document.createElement("strong");
            label.textContent = unit.label;

            const controls = document.createElement("span");
            controls.className = "bi-badges";

            for (const [buttonLabel, direction]
                of [["Earlier", -1], ["Later", 1]] as const) {
                const button = document.createElement("button");
                button.className = "btn btn-sm btn-outline-secondary";
                button.textContent = buttonLabel;
                button.onclick = () => move(item, direction);
                controls.append(button);
            }

            item.append(label, controls);
            list.append(item);
        }

        box.append(list);
    }

    const apply = document.createElement("button");
    apply.className = "btn btn-outline-secondary mt-2";
    apply.textContent = "Apply DM tie order";
    apply.onclick = () => {
        const order =
            preview.orderedCombatants.map(combatant => combatant.id);

        box.querySelectorAll<HTMLOListElement>("[data-tie='true']")
            .forEach(list => {
                const units =
                    Array.from(
                        list.querySelectorAll<HTMLElement>("[data-ids]"))
                    .map(item =>
                        (item.dataset.ids ?? "")
                            .split(",")
                            .filter(Boolean));

                const tiedIds = units.flat();
                const positions =
                    order
                        .map((id, index) =>
                            tiedIds.includes(id) ? index : -1)
                        .filter(index => index >= 0)
                        .sort((left, right) => left - right);
                const flattened = units.flat();

                positions.forEach((position, index) => {
                    order[position] = flattened[index];
                });
            });

        options.onApplyManualOrder(order);
    };

    box.append(apply);
    return box;
}

function tieUnits(
    ids: string[],
    preview: InitiativePreviewResponse,
    request: InitiativePreviewRequest,
    groupName: (groupId: string) => string
): Array<{ ids: string[]; label: string }> {
    const byId = new Map(
        preview.orderedCombatants.map(combatant => [
            combatant.id,
            combatant
        ]));

    const units: Array<{ ids: string[]; label: string }> = [];
    const usedGroups = new Set<string>();

    for (const id of ids) {
        const combatant = byId.get(id);
        if (!combatant) continue;

        if (request.tacticalGroupMode !== "individual"
            && combatant.tacticalGroupId) {
            if (usedGroups.has(combatant.tacticalGroupId)) continue;
            usedGroups.add(combatant.tacticalGroupId);

            const members =
                ids
                    .map(candidateId => byId.get(candidateId))
                    .filter(candidate =>
                        candidate?.tacticalGroupId
                            === combatant.tacticalGroupId)
                    .map(candidate => candidate!);

            units.push({
                ids: members.map(member => member.id),
                label:
                    `${groupName(combatant.tacticalGroupId)} — `
                    + members.map(member => member.name).join(", ")
            });
            continue;
        }

        units.push({
            ids: [id],
            label:
                `${combatant.name} — `
                + friendlyAlliance(combatant.allianceId)
        });
    }

    return units;
}

function move(
    element: HTMLElement,
    direction: -1 | 1
): void {
    const sibling =
        direction < 0
            ? element.previousElementSibling
            : element.nextElementSibling;
    if (!sibling) return;

    if (direction < 0) {
        element.parentElement?.insertBefore(element, sibling);
    } else {
        element.parentElement?.insertBefore(sibling, element);
    }
}

function renderRoundBoundary(
    preview: InitiativePreviewResponse
): HTMLElement {
    const container = document.createElement("div");
    container.className = "bi-list mt-3";

    const title = document.createElement("strong");
    title.textContent = "Round boundary";

    const note = document.createElement("div");
    note.className = "bi-message bi-warning";

    if (!preview.cyclicMerge) {
        note.textContent =
            `After Block ${preview.blocks.length}, return to Block 1 `
            + "for the next round.";
    } else {
        const bottom =
            preview.blocks.findIndex(
                block =>
                    block.id === preview.cyclicMerge!.bottomBlockId)
            + 1;
        const top =
            preview.blocks.findIndex(
                block =>
                    block.id === preview.cyclicMerge!.topBlockId)
            + 1;

        note.textContent =
            `Round 1: Block ${bottom} does not take a separate activation. `
            + `It joins same-side Block ${top}, which remains at the higher `
            + "initiative position from round 2 onward.";
    }

    container.append(title, note);
    return container;
}
