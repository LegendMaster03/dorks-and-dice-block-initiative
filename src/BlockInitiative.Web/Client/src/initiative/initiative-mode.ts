import { registerAfterRender, requestEnhancement } from "../render-lifecycle";

export type InitiativeMode = "block" | "standard";

type PreviewDetail = {
    request?: { initiativeMode?: InitiativeMode };
    response: {
        orderedCombatants: Array<{
            id: string;
            name: string;
            allianceId: string;
            blockType: "standard" | "kaiju" | "mixed";
        }>;
        blocks: Array<{
            id: string;
            allianceId: string;
            blockType: "standard" | "kaiju" | "mixed";
            memberOrder: string[];
        }>;
    };
};

type StateDetail = {
    request?: { initiativeMode?: InitiativeMode };
    response: {
        round: number;
        activeBlockId: string | null;
        blocks: Array<{
            id: string;
            allianceId: string;
            blockType: "standard" | "kaiju" | "mixed";
            memberOrder: string[];
        }>;
    };
};

const storageKey = "dorks-and-dice:block-initiative:initiative-mode:v1";
let initiativeMode: InitiativeMode = readStoredMode();
let initialized = false;
let lastPreview: PreviewDetail | null = null;
let lastState: StateDetail | null = null;

export function getInitiativeMode(): InitiativeMode {
    return initiativeMode;
}

export function setInitiativeMode(
    mode: InitiativeMode,
    persist = true
): void {
    initiativeMode =
        mode === "standard"
            ? "standard"
            : "block";
    if (persist) writeStoredMode(initiativeMode);
    requestEnhancement();
}

export function initializeInitiativeModeUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    installStyles(root.ownerDocument);

    root.addEventListener("change", event => {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement) || target.dataset.role !== "initiative-mode") return;

        const nextMode: InitiativeMode = target.value === "standard" ? "standard" : "block";
        if (nextMode === initiativeMode) return;

        setInitiativeMode(nextMode);

        // The base app already owns the setup invalidation path. Re-dispatching
        // the existing initiative-method change event clears stale preview/runner
        // output without creating a second encounter-state implementation.
        const enemyMethod = root.querySelector<HTMLSelectElement>("[data-role='enemy-method']");
        if (enemyMethod) enemyMethod.dispatchEvent(new Event("change", { bubbles: true }));
        else requestEnhancement();
    });

    // The encounter reset handler reloads immediately, so clear this companion
    // preference during capture before the persistence module handles the click.
    root.addEventListener("click", event => {
        const target = event.target;
        const element = target instanceof Element ? target : null;
        if (!element?.closest("[data-action='reset-persisted-encounter']")) return;
        clearStoredMode();
    }, true);

    window.addEventListener("block-initiative:preview", event => {
        lastPreview = (event as CustomEvent<PreviewDetail>).detail ?? null;
        requestEnhancement();
    });

    window.addEventListener("block-initiative:state", event => {
        lastState = (event as CustomEvent<StateDetail>).detail ?? null;
        requestEnhancement();
    });

    registerAfterRender("initiative-mode", 205, () => enhance(root));
    ensureModeControl(root);
}

function enhance(root: HTMLElement): void {
    ensureModeControl(root);
    updateSetupCopy(root);
    if (initiativeMode !== "standard") return;
    updatePreviewCopy(root);
    updateRunnerCopy(root);
}

function ensureModeControl(root: HTMLElement): void {
    const setup = root.querySelector<HTMLElement>("[data-role='setup']");
    if (!setup) return;

    let panel = setup.querySelector<HTMLElement>("[data-initiative-mode-control]");
    if (!panel) {
        panel = document.createElement("div");
        panel.className = "bi-initiative-mode-control";
        panel.dataset.initiativeModeControl = "true";

        const field = document.createElement("div");
        field.className = "bi-field";
        const label = document.createElement("label");
        label.htmlFor = "bi-initiative-mode";
        label.textContent = "Initiative mode";
        const select = document.createElement("select");
        select.id = "bi-initiative-mode";
        select.dataset.role = "initiative-mode";
        select.add(new Option("Block Initiative", "block"));
        select.add(new Option("Standard Initiative", "standard"));
        field.append(label, select);

        const help = document.createElement("div");
        help.className = "bi-muted";
        help.dataset.role = "initiative-mode-help";
        panel.append(field, help);

        const intro = setup.firstElementChild;
        if (intro?.nextSibling) setup.insertBefore(panel, intro.nextSibling);
        else setup.append(panel);
    }

    const select = panel.querySelector<HTMLSelectElement>("[data-role='initiative-mode']");
    if (select && select.value !== initiativeMode) select.value = initiativeMode;

    const help = panel.querySelector<HTMLElement>("[data-role='initiative-mode-help']");
    if (help) {
        help.textContent = initiativeMode === "standard"
            ? "Each combatant takes an individual turn in descending initiative order. Block merging and within-block reordering are disabled."
            : "Adjacent combatants on the same side share a turn block, including the existing round-boundary merge rule.";
    }
}

function updateSetupCopy(root: HTMLElement): void {
    const standard = initiativeMode === "standard";
    const steps = Array.from(root.querySelectorAll<HTMLElement>(".bi-steps .bi-step"));
    const orderStep = steps[1];
    if (orderStep) {
        const title = orderStep.querySelector("strong");
        const detail = orderStep.querySelector<HTMLElement>(".bi-muted");
        if (title) title.textContent = standard ? "2. Build order" : "2. Build blocks";
        if (detail) {
            detail.textContent = standard
                ? "Initiative placement determines one individual turn for each combatant."
                : "Initiative placement and side determine turn blocks. Adjacent members of one side always share a turn block.";
        }
    }

    const blockRule = root.querySelector<HTMLElement>("[data-role='block-rule-copy']");
    if (blockRule) blockRule.hidden = standard;

    const previewButton = root.querySelector<HTMLButtonElement>("[data-action='preview']");
    if (previewButton?.textContent === "Build initiative blocks" || previewButton?.textContent === "Build initiative order") {
        previewButton.textContent = standard ? "Build initiative order" : "Build initiative blocks";
    }

    const status = root.querySelector<HTMLElement>("[data-role='setup-status']");
    if (status?.textContent) {
        if (standard) status.textContent = status.textContent.replace("initiative blocks", "initiative order");
        else status.textContent = status.textContent.replace("initiative order", "initiative blocks");
    }

    const groupControls = root.querySelector<HTMLElement>("[data-action='add-group']")?.closest(".bi-row");
    const groupNote = groupControls?.querySelector<HTMLElement>(".bi-muted");
    if (groupNote) {
        groupNote.textContent = standard
            ? "Groups determine non-player initiative placement; each combatant still receives an individual turn."
            : "Groups are roster units; actual turn blocks are always derived from side and initiative placement.";
    }
}

function updatePreviewCopy(root: HTMLElement): void {
    const preview = lastPreview?.response;
    const results = root.querySelector<HTMLElement>("[data-role='results']");
    if (!preview || !results) return;

    for (const heading of results.querySelectorAll<HTMLElement>("h3")) {
        if (heading.textContent === "Initiative blocks are ready") heading.textContent = "Initiative order is ready";
        else if (heading.textContent === "Updated initiative blocks are ready") heading.textContent = "Updated initiative order is ready";
        else if (heading.textContent === "Block order") heading.textContent = "Initiative order";
    }

    for (const muted of results.querySelectorAll<HTMLElement>(".bi-muted")) {
        if (muted.textContent === "Review the derived order, then start encounter tracking.") {
            muted.textContent = "Review the individual turn order, then start encounter tracking.";
        } else if (muted.textContent === "Review the new block order, then resume on the same active turn.") {
            muted.textContent = "Review the new initiative order, then resume on the same active turn.";
        } else if (muted.textContent === "Initiative placement is sorted normally. Every contiguous run from one side becomes one turn block; Standard and Kaiju members can therefore share a side turn without creating consecutive same-side blocks.") {
            muted.textContent = "Initiative is sorted normally and each combatant receives one turn. Tactical-group initiative can still affect placement, but it does not combine combatants into a shared turn.";
        } else if (muted.textContent === "Tracking starts on the first active block in round 1.") {
            muted.textContent = "Tracking starts on the first combatant in round 1.";
        }
    }

    for (const badge of results.querySelectorAll<HTMLElement>(".bi-badge")) {
        if (/^\d+ blocks?$/.test(badge.textContent ?? "")) {
            badge.textContent = `${preview.blocks.length} turn${preview.blocks.length === 1 ? "" : "s"}`;
        }
    }

    results.querySelectorAll<HTMLElement>(".bi-block .bi-block-head strong").forEach((heading, index) => {
        heading.textContent = `Turn ${index + 1}`;
    });

    const tieDescription = Array.from(results.querySelectorAll<HTMLParagraphElement>(".bi-message.bi-warning p"))
        .find(paragraph => paragraph.textContent === "Opposing placements tied. Reorder the tied units only; grouped units stay together.");
    if (tieDescription) {
        tieDescription.textContent = "Initiative placements tied. Reorder the tied units only; grouped units stay together.";
    }

    const roundBoundary = Array.from(results.querySelectorAll<HTMLElement>("strong"))
        .find(element => element.textContent === "Round boundary")?.parentElement;
    const boundaryNote = roundBoundary?.querySelector<HTMLElement>(".bi-message");
    if (boundaryNote) {
        boundaryNote.textContent = `After Turn ${preview.blocks.length}, return to Turn 1 for the next round.`;
    }
}

function updateRunnerCopy(root: HTMLElement): void {
    const preview = lastPreview?.response;
    const state = lastState?.response;
    if (!preview || !state) return;

    const stack = root.querySelector<HTMLElement>("[data-runner-blocks]");
    const runner = stack?.closest<HTMLElement>("section.card.card-body.bi-grid");
    if (!stack || !runner) return;

    const byId = new Map(preview.orderedCombatants.map(combatant => [combatant.id, combatant]));
    const activeIndex = state.blocks.findIndex(block => block.id === state.activeBlockId);
    const activeBlock = activeIndex >= 0 ? state.blocks[activeIndex] : null;
    const activeCombatant = activeBlock ? byId.get(activeBlock.memberOrder[0]) : null;

    const topHeading = runner.querySelector<HTMLElement>(":scope > .bi-row h3");
    if (topHeading && activeCombatant) topHeading.textContent = `${activeCombatant.name} is active`;

    const blockElements = Array.from(stack.querySelectorAll<HTMLElement>(":scope > [data-runner-block]"));
    blockElements.forEach((element, index) => {
        const block = state.blocks[index];
        if (!block) return;
        const combatant = byId.get(block.memberOrder[0]);
        const eyebrow = element.querySelector<HTMLElement>(".bi-runner-block-number");
        const heading = element.querySelector<HTMLElement>(".bi-runner-block-head h4");
        if (eyebrow) eyebrow.textContent = `Turn ${index + 1}`;
        if (heading) heading.textContent = combatant?.name ?? `Turn ${index + 1}`;
    });

    const navigation = Array.from(runner.querySelectorAll<HTMLButtonElement>(":scope > .bi-sequence .bi-block-jump"));
    navigation.forEach((button, index) => {
        const block = state.blocks[index];
        if (!block) return;
        const combatant = byId.get(block.memberOrder[0]);
        const suffix = combatant?.blockType === "kaiju" ? " · Kaiju" : "";
        button.textContent = `${index + 1}. ${combatant?.name ?? "Turn"}${suffix}`;
    });

    const activeToggle = runner.querySelector<HTMLButtonElement>("[data-action='toggle-active-block-highlight']");
    if (activeToggle?.textContent) activeToggle.textContent = activeToggle.textContent.replace("active block", "active turn");
    if (activeToggle?.title) activeToggle.title = activeToggle.title.replaceAll("block", "turn").replaceAll("Block", "Turn");

    const previous = runner.querySelector<HTMLButtonElement>("[data-action='previous-turn']");
    if (previous) previous.textContent = "Previous turn";

    const next = runner.querySelector<HTMLButtonElement>("[data-action='next-turn']");
    if (next) next.textContent = "Next turn";

    const hint = runner.querySelector<HTMLElement>("[data-role='reorder-hint']");
    if (hint) {
        hint.textContent = "Drag the grip on a combatant card to organize the initiative order. The individual turn order is rebuilt after the drop.";
    }
}

function readStoredMode(): InitiativeMode {
    try {
        return window.localStorage.getItem(storageKey) === "standard" ? "standard" : "block";
    } catch {
        return "block";
    }
}

function writeStoredMode(mode: InitiativeMode): void {
    try {
        window.localStorage.setItem(storageKey, mode);
    } catch {
        // Mode still applies for the current page when browser storage is unavailable.
    }
}

function clearStoredMode(): void {
    initiativeMode = "block";
    try {
        window.localStorage.removeItem(storageKey);
    } catch {
        // Reload still resets the in-memory mode to the default for this page lifecycle.
    }
}

function installStyles(documentRef: Document): void {
    if (documentRef.head.querySelector("style[data-role='initiative-mode-style']")) return;

    const style = documentRef.createElement("style");
    style.dataset.role = "initiative-mode-style";
    style.textContent = `
.block-initiative-app .bi-initiative-mode-control{
  display:grid;grid-template-columns:minmax(14rem,24rem) minmax(16rem,1fr);gap:.7rem;align-items:end;
  padding:.65rem;border:1px solid var(--bi-border);border-radius:.55rem;background:var(--bi-soft)
}
.block-initiative-app .bi-initiative-mode-control select{max-width:24rem}
@media(max-width:900px){.block-initiative-app .bi-initiative-mode-control{grid-template-columns:1fr}}
`;
    documentRef.head.append(style);
}
