import {
    publishInitiativeTurnState,
    requestInitiativeTurnState
} from "../api";
import type {
    InitiativePreviewRequest,
    InitiativePreviewResponse,
    InitiativeTurnStateResponse
} from "../api";
import {
    createBlockBadges,
    friendlyAlliance
} from "./presentation";
import {
    onEncounterRunnerSessionReplacement
} from "./runner-session-events";

type RunnerSession = {
    request: InitiativePreviewRequest;
    preview: InitiativePreviewResponse;
    state: InitiativeTurnStateResponse;
};

export type EncounterRunnerOptions = {
    results: HTMLElement;
    setup: HTMLElement;
    previewButton: HTMLButtonElement;
    getStateUrl: () => string | null;
    groupName: (groupId: string) => string;
    showError: (error: unknown) => void;
    onEditingChanged: () => void;
};

/**
 * Owns the running encounter lifecycle and reversible turn history.
 *
 * app.ts supplies service/location dependencies, while this controller owns
 * runner state, advance/undo, edit/resume, and runner presentation.
 */
export class EncounterRunnerController {
    private session: RunnerSession | null = null;
    private history: InitiativeTurnStateResponse[] = [];
    private editing = false;

    public constructor(
        private readonly options: EncounterRunnerOptions
    ) {
        onEncounterRunnerSessionReplacement(
            detail => {
                this.session = {
                    request: clonePreviewRequest(
                        detail.request),
                    preview: detail.preview,
                    state: detail.state
                };
                this.history = [];
                this.editing = false;
                this.render();
            });
    }

    public get isEditing(): boolean {
        return this.editing;
    }

    public async start(
        request: InitiativePreviewRequest,
        preview: InitiativePreviewResponse
    ): Promise<void> {
        const stateUrl = this.options.getStateUrl();
        if (!stateUrl) return;

        this.options.setup.hidden = true;
        this.editing = false;
        this.options.results.innerHTML =
            '<section class="card card-body">Loading encounter…</section>';

        try {
            const result =
                await requestInitiativeTurnState(
                    stateUrl,
                    {
                        ...request,
                        advanceCount: 0
                    });

            this.session = {
                request:
                    previewRequestFromStateRequest(
                        result.request),
                preview,
                state: result.response
            };
            this.history = [];
            publishInitiativeTurnState(result, "start");
            this.render();
        } catch (error) {
            this.options.setup.hidden = false;
            this.options.results.replaceChildren();
            this.options.showError(error);
        }
    }

    public async resume(
        request: InitiativePreviewRequest,
        preview: InitiativePreviewResponse
    ): Promise<void> {
        const stateUrl = this.options.getStateUrl();
        if (!stateUrl || !this.session) return;

        const active =
            this.session.state.blocks.find(
                block => block.id === this.session!.state.activeBlockId);
        const availableIds =
            new Set(request.combatants.map(combatant => combatant.id));
        const anchor =
            active?.memberOrder.find(id => availableIds.has(id));

        if (!anchor) {
            this.options.showError(new Error(
                "Keep at least one combatant from the currently active block "
                + "so the running encounter can be resumed."));
            return;
        }

        this.options.results.innerHTML =
            '<section class="card card-body">Resuming encounter…</section>';

        try {
            const result =
                await requestInitiativeTurnState(
                    stateUrl,
                    {
                        ...request,
                        advanceCount: 0,
                        resumeRound:
                            this.session.state.round,
                        resumeActiveCombatantId:
                            anchor,
                        resumeCyclicMergeCompleted:
                            this.session.state
                                .cyclicMergeCompleted
                    });

            this.session = {
                request:
                    previewRequestFromStateRequest(
                        result.request),
                preview,
                state: result.response
            };
            this.history = [];
            this.editing = false;

            this.options.setup
                .querySelector("[data-role='running-edit-note']")
                ?.remove();
            this.options.previewButton.textContent =
                "Build initiative blocks";
            this.options.setup.hidden = true;
            publishInitiativeTurnState(result, "resume");
            this.render();
        } catch (error) {
            this.options.setup.hidden = false;
            this.options.results.replaceChildren();
            this.options.showError(error);
        }
    }

    private async advance(): Promise<void> {
        const stateUrl = this.options.getStateUrl();
        if (!stateUrl || !this.session) return;

        const active =
            this.session.state.blocks.find(
                block => block.id === this.session!.state.activeBlockId);
        const anchor = active?.memberOrder[0];
        if (!anchor) return;

        this.options.results.innerHTML =
            '<section class="card card-body">Advancing encounter…</section>';

        try {
            const result =
                await requestInitiativeTurnState(
                    stateUrl,
                    {
                        ...this.session.request,
                        advanceCount: 1,
                        resumeRound:
                            this.session.state.round,
                        resumeActiveCombatantId:
                            anchor,
                        resumeCyclicMergeCompleted:
                            this.session.state
                                .cyclicMergeCompleted
                    });

            this.history.push(
                this.session.state);
            this.session = {
                ...this.session,
                request:
                    previewRequestFromStateRequest(
                        result.request),
                state: result.response
            };
            publishInitiativeTurnState(result, "advance");
            this.render();
        } catch (error) {
            this.render();
            this.options.showError(error);
        }
    }

    private undoAdvance(): void {
        if (!this.session || this.history.length === 0) return;

        const previous = this.history.pop();
        if (!previous) return;

        this.session = {
            ...this.session,
            state: previous
        };
        publishInitiativeTurnState(
            {
                request:
                    stateRequestForPublishedState(
                        this.session.request,
                        previous),
                response: previous
            },
            "previous");
        this.render();
    }

    private beginEdit(): void {
        if (!this.session) return;

        this.editing = true;
        this.options.setup.hidden = false;
        this.options.results.replaceChildren();
        this.options.previewButton.textContent =
            "Review encounter changes";

        let note =
            this.options.setup.querySelector<HTMLElement>(
                "[data-role='running-edit-note']");
        if (!note) {
            note = document.createElement("div");
            note.dataset.role = "running-edit-note";
            note.className =
                "bi-message bi-warning bi-running-edit-note";
            this.options.setup.insertBefore(
                note,
                this.options.setup.children[1] ?? null);
        }

        note.textContent =
            `Editing the running encounter in round ${this.session.state.round}. `
            + "Add combatants to an existing side or create a new side below, "
            + "then review the updated blocks. The current active turn will be preserved.";

        this.options.onEditingChanged();
        this.options.setup.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    private render(): void {
        if (!this.session) return;

        const { preview, state } = this.session;
        const byId =
            new Map(
                preview.orderedCombatants.map(combatant => [
                    combatant.id,
                    combatant
                ]));
        const activeIndex =
            state.blocks.findIndex(
                block => block.id === state.activeBlockId);
        const active =
            activeIndex >= 0
                ? state.blocks[activeIndex]
                : null;

        this.options.results.replaceChildren();

        const card = document.createElement("section");
        card.className = "card card-body bi-grid";

        const top = document.createElement("div");
        top.className = "bi-row";

        const title = document.createElement("div");
        const round = document.createElement("strong");
        round.textContent = `Round ${state.round}`;

        const heading = document.createElement("h3");
        heading.className = "h5 mb-0";
        heading.textContent =
            active
                ? `Block ${activeIndex + 1} is active`
                : "Encounter";

        title.append(round, heading);

        const edit = document.createElement("button");
        edit.className = "btn btn-sm btn-outline-secondary";
        edit.dataset.action = "edit-running-encounter";
        edit.textContent = "Add / edit combatants";
        edit.onclick = () => this.beginEdit();

        top.append(title, edit);
        card.append(top);

        if (state.lastAdvance?.cyclicMergeCompleted) {
            card.append(message(
                "Round 1 complete. The lower same-side block joined the "
                + "higher initiative block for round 2 onward."));
        } else if (state.lastAdvance?.roundAdvanced) {
            card.append(message(
                `Round ${state.round} started.`));
        }

        if (active) {
            card.append(
                this.renderActiveBlock(active, byId));
        }

        card.append(this.renderSequence(state));
        card.append(this.renderActions());
        this.options.results.append(card);
    }

    private renderActiveBlock(
        active: InitiativeTurnStateResponse["blocks"][number],
        byId: Map<
            string,
            InitiativePreviewResponse["orderedCombatants"][number]>
    ): HTMLElement {
        const panel = document.createElement("div");
        panel.className = "bi-active bi-grid";

        const head = document.createElement("div");
        head.className = "bi-row";

        const text = document.createElement("div");
        const heading = document.createElement("h4");
        heading.className = "h5 mb-0";
        heading.textContent =
            `${friendlyAlliance(active.allianceId)} block`;

        const hint = document.createElement("div");
        hint.className = "bi-muted";
        hint.textContent =
            "Finish this side turn before advancing.";

        text.append(heading, hint);
        head.append(
            text,
            createBlockBadges(active.allianceId, active.blockType));
        panel.append(head);

        const members = document.createElement("div");
        members.className = "bi-list";

        for (const id of active.memberOrder) {
            const combatant = byId.get(id);

            const member = document.createElement("div");
            member.className = "bi-runner-member bi-row";

            const name = document.createElement("strong");
            name.textContent = combatant?.name ?? id;

            const meta = document.createElement("span");
            meta.className = "bi-muted";
            const labels = [
                combatant?.tacticalGroupId
                    ? this.options.groupName(combatant.tacticalGroupId)
                    : "",
                combatant?.blockType === "kaiju"
                    ? "Kaiju"
                    : ""
            ].filter(Boolean);
            meta.textContent = labels.join(" · ");

            member.append(name, meta);
            members.append(member);
        }

        panel.append(members);

        if (active.allianceId === "players"
            && active.memberOrder.length > 1) {
            const note = document.createElement("div");
            note.className = "bi-muted";
            note.textContent =
                "Players may act in any order within this block.";
            panel.append(note);
        }

        return panel;
    }

    private renderSequence(
        state: InitiativeTurnStateResponse
    ): HTMLElement {
        const sequence = document.createElement("div");
        sequence.className = "bi-sequence";

        state.blocks.forEach((block, index) => {
            const chip = document.createElement("span");
            chip.className =
                `bi-seq${block.id === state.activeBlockId ? " active" : ""}`;

            const suffix =
                block.blockType === "kaiju"
                    ? " · Kaiju"
                    : block.blockType === "mixed"
                        ? " · mixed"
                        : "";

            chip.textContent =
                `${index + 1}. ${friendlyAlliance(block.allianceId)}${suffix}`;
            sequence.append(chip);
        });

        return sequence;
    }

    private renderActions(): HTMLElement {
        const actions = document.createElement("div");
        actions.className = "bi-actions bi-primary";

        const previous = document.createElement("button");
        previous.className = "btn btn-outline-secondary";
        previous.dataset.action = "previous-turn";
        previous.textContent = "Previous block";
        previous.disabled = this.history.length === 0;
        previous.onclick = () => this.undoAdvance();

        const next = document.createElement("button");
        next.className = "btn btn-primary";
        next.dataset.action = "next-turn";
        next.textContent = "Next block";
        next.onclick = () => void this.advance();

        actions.append(previous, next);
        return actions;
    }
}

function message(text: string): HTMLElement {
    const note = document.createElement("div");
    note.className = "bi-message bi-success";
    note.textContent = text;
    return note;
}


function previewRequestFromStateRequest(
    request: import("../api").InitiativeTurnStateRequest
): InitiativePreviewRequest {
    return {
        combatants:
            request.combatants.map(
                combatant => ({ ...combatant })),
        manualOrderOverride:
            request.manualOrderOverride
                ? [...request.manualOrderOverride]
                : null,
        tacticalGroupMode:
            request.tacticalGroupMode,
        initiativeMode:
            request.initiativeMode
    };
}

function stateRequestForPublishedState(
    request: InitiativePreviewRequest,
    state: InitiativeTurnStateResponse
): import("../api").InitiativeTurnStateRequest {
    const active =
        state.blocks.find(
            block => block.id === state.activeBlockId);
    return {
        ...clonePreviewRequest(request),
        advanceCount: 0,
        resumeRound: state.round,
        resumeActiveCombatantId:
            active?.memberOrder[0] ?? null,
        resumeCyclicMergeCompleted:
            state.cyclicMergeCompleted
    };
}

function clonePreviewRequest(
    request: InitiativePreviewRequest
): InitiativePreviewRequest {
    return {
        ...request,
        combatants:
            request.combatants.map(
                combatant => ({ ...combatant })),
        manualOrderOverride:
            request.manualOrderOverride
                ? [...request.manualOrderOverride]
                : null
    };
}
