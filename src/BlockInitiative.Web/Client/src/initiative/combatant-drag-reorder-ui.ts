import {
    getRuntimeManualOrder,
    loadInitiativeTurnState,
    previewInitiative,
    setRuntimeManualOrder
} from "../api";
import type {
    InitiativePreviewRequest,
    InitiativePreviewResponse,
    InitiativeTurnStateRequest,
    InitiativeTurnStateResponse
} from "../api";
import { moveCombatantByOffset, sameMembers, sameOrder } from "./combatant-reorder";
import { initiativePreviewUrl, initiativeStateUrl, loadToolHostContext } from "../host";
import { registerAfterRender, requestEnhancement } from "../render-lifecycle";

type PreviewDetail = {
    request: InitiativePreviewRequest;
    response: InitiativePreviewResponse;
};

type StateDetail = {
    request: InitiativeTurnStateRequest;
    response: InitiativeTurnStateResponse;
};

type Endpoints = {
    previewUrl: string;
    stateUrl: string;
};

type DragSession = {
    combatantId: string;
    combatantName: string;
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
    source: HTMLElement;
    handle: HTMLButtonElement;
    indicator: HTMLElement;
    originalOrder: string[];
};

let initialized = false;
let lastPreview: PreviewDetail | null = null;
let lastState: StateDetail | null = null;
let baselineRequest: InitiativePreviewRequest | null = null;
let baselineOrder: string[] | null = null;
let reorderHistory: string[][] = [];
let applying = false;
let dragSession: DragSession | null = null;
let pendingFocusId: string | null = null;
let liveRegion: HTMLElement | null = null;
let endpointsPromise: Promise<Endpoints> | null = null;

export function initializeCombatantDragReorderUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    installStyles(root.ownerDocument);
    liveRegion = ensureLiveRegion(root);
    endpointsPromise = resolveEndpoints(root);

    window.addEventListener("block-initiative:preview", event => {
        const detail = (event as CustomEvent<PreviewDetail>).detail;
        if (!detail?.request || !detail?.response) return;
        lastPreview = detail;
        requestEnhancement();
    });

    window.addEventListener("block-initiative:state", event => {
        const detail = (event as CustomEvent<StateDetail>).detail;
        if (!detail?.request || !detail?.response) return;
        lastState = detail;

        // A zero-advance state load that did not originate from this module is
        // a new or explicitly resumed encounter state. Treat that order as the
        // reset point and start a fresh undo history.
        if (!applying && detail.request.advanceCount === 0) {
            baselineRequest = previewRequestFrom(detail.request);
            baselineOrder = stateOrder(detail.response);
            reorderHistory = [];
        }

        requestEnhancement();
        focusPendingHandle(root);
    });

    registerAfterRender("combatant-drag-reorder", 125, () => enhance(root));
}

function enhance(root: HTMLElement): void {
    if (!lastPreview || !lastState) return;
    const runner = root.querySelector<HTMLElement>("[data-runner-blocks]")?.closest<HTMLElement>("section.card.card-body.bi-grid");
    if (!runner) return;

    ensureReorderControls(runner, root);
    for (const card of runner.querySelectorAll<HTMLElement>(".bi-runner-member[data-combatant-id]")) {
        ensureDragHandle(card, root);
    }
    updateReorderControls(runner);
}

function ensureDragHandle(card: HTMLElement, root: HTMLElement): void {
    const combatantId = card.dataset.combatantId;
    if (!combatantId) return;

    let handle = card.querySelector<HTMLButtonElement>(":scope > .bi-drag-handle");
    if (!handle) {
        handle = document.createElement("button");
        handle.type = "button";
        handle.className = "bi-drag-handle";
        handle.textContent = "⠿";
        handle.dataset.action = "reorder-combatant";
        handle.title = "Drag to reorder this combatant. Arrow Up and Arrow Down also move it one position.";
        card.insertBefore(handle, card.firstChild);
    }

    const name = combatantName(card);
    handle.setAttribute("aria-label", `Reorder ${name}`);
    if (handle.dataset.reorderReady === "true") return;
    handle.dataset.reorderReady = "true";

    handle.addEventListener("pointerdown", event => beginPointerDrag(event, card, handle!, root));
    handle.addEventListener("pointermove", event => updatePointerDrag(event, root));
    handle.addEventListener("pointerup", event => finishPointerDrag(event, root, true));
    handle.addEventListener("pointercancel", event => finishPointerDrag(event, root, false));
    handle.addEventListener("lostpointercapture", event => {
        if (dragSession?.pointerId === event.pointerId) finishPointerDrag(event, root, false);
    });
    handle.addEventListener("keydown", event => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        if (applying) return;

        const order = currentStateOrder();
        const next = moveCombatantByOffset(order, combatantId, event.key === "ArrowUp" ? -1 : 1);
        if (sameOrder(order, next)) {
            announce(`${name} is already at the ${event.key === "ArrowUp" ? "top" : "bottom"} of the order.`);
            return;
        }
        void applyOrder(next, combatantId, "push");
    });
}

function beginPointerDrag(
    event: PointerEvent,
    card: HTMLElement,
    handle: HTMLButtonElement,
    root: HTMLElement
): void {
    if (applying || dragSession) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const combatantId = card.dataset.combatantId;
    if (!combatantId) return;

    const originalOrder = currentStateOrder();
    if (!originalOrder.includes(combatantId)) return;

    event.preventDefault();
    const indicator = document.createElement("div");
    indicator.className = "bi-drop-indicator";
    indicator.setAttribute("aria-hidden", "true");

    dragSession = {
        combatantId,
        combatantName: combatantName(card),
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        source: card,
        handle,
        indicator,
        originalOrder
    };

    handle.setPointerCapture(event.pointerId);
    card.classList.add("bi-drag-source");
    root.classList.add("bi-card-dragging");
    announce(`Moving ${dragSession.combatantName}.`);
}

function updatePointerDrag(event: PointerEvent, root: HTMLElement): void {
    const session = dragSession;
    if (!session || event.pointerId !== session.pointerId) return;

    const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
    if (!session.moved && distance < 5) return;
    session.moved = true;
    event.preventDefault();

    placeDropIndicator(root, event.clientX, event.clientY, session);
    autoScroll(event.clientY);
}

function finishPointerDrag(event: PointerEvent, root: HTMLElement, apply: boolean): void {
    const session = dragSession;
    if (!session || event.pointerId !== session.pointerId) return;

    let nextOrder: string[] | null = null;
    if (apply && session.moved && session.indicator.isConnected) {
        nextOrder = orderFromIndicator(root, session);
    }

    cleanupDrag(root, session);
    if (!nextOrder || sameOrder(session.originalOrder, nextOrder)) {
        if (session.moved) announce(`${session.combatantName} stayed in the same position.`);
        return;
    }

    void applyOrder(nextOrder, session.combatantId, "push");
}

function cleanupDrag(root: HTMLElement, session: DragSession): void {
    if (session.handle.hasPointerCapture(session.pointerId)) {
        session.handle.releasePointerCapture(session.pointerId);
    }
    session.indicator.remove();
    session.source.classList.remove("bi-drag-source");
    root.classList.remove("bi-card-dragging");
    dragSession = null;
}

function placeDropIndicator(root: HTMLElement, clientX: number, clientY: number, session: DragSession): void {
    const hit = root.ownerDocument.elementFromPoint(clientX, clientY);
    const hitElement = hit instanceof Element ? hit : null;
    const targetCard = hitElement?.closest<HTMLElement>(".bi-runner-member[data-combatant-id]");

    if (targetCard && targetCard !== session.source) {
        const container = targetCard.parentElement;
        if (!container?.classList.contains("bi-runner-members")) return;
        const rect = targetCard.getBoundingClientRect();
        const before = clientY < rect.top + rect.height / 2;
        container.insertBefore(session.indicator, before ? targetCard : targetCard.nextSibling);
        return;
    }

    const directBlock = hitElement?.closest<HTMLElement>("[data-runner-block]");
    const block = directBlock ?? nearestBlock(root, clientY);
    const container = block?.querySelector<HTMLElement>(":scope > .bi-runner-members");
    if (!container) return;

    const cards = Array.from(container.querySelectorAll<HTMLElement>(":scope > .bi-runner-member[data-combatant-id]"))
        .filter(card => card !== session.source);
    if (!cards.length) {
        container.append(session.indicator);
        return;
    }

    const firstRect = cards[0].getBoundingClientRect();
    const lastRect = cards[cards.length - 1].getBoundingClientRect();
    if (clientY <= firstRect.top + firstRect.height / 2) container.insertBefore(session.indicator, cards[0]);
    else if (clientY >= lastRect.top + lastRect.height / 2) container.append(session.indicator);
}

function nearestBlock(root: HTMLElement, clientY: number): HTMLElement | null {
    let best: HTMLElement | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const block of root.querySelectorAll<HTMLElement>("[data-runner-block]")) {
        const rect = block.getBoundingClientRect();
        const distance = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
        if (distance < bestDistance) {
            best = block;
            bestDistance = distance;
        }
    }
    return best;
}

function orderFromIndicator(root: HTMLElement, session: DragSession): string[] | null {
    const order: string[] = [];
    let inserted = false;

    for (const block of root.querySelectorAll<HTMLElement>("[data-runner-block]")) {
        const members = block.querySelector<HTMLElement>(":scope > .bi-runner-members");
        if (!members) continue;
        for (const child of Array.from(members.children)) {
            if (child === session.indicator) {
                order.push(session.combatantId);
                inserted = true;
                continue;
            }
            if (!(child instanceof HTMLElement) || !child.classList.contains("bi-runner-member")) continue;
            const id = child.dataset.combatantId;
            if (id && id !== session.combatantId) order.push(id);
        }
    }

    if (!inserted) return null;
    return sameMembers(order, session.originalOrder) ? order : null;
}

function ensureReorderControls(runner: HTMLElement, root: HTMLElement): void {
    const controls = runner.querySelector<HTMLElement>("[data-role='runner-view-controls']");
    if (!controls) return;

    if (!controls.querySelector("[data-action='undo-combatant-reorder']")) {
        const undo = document.createElement("button");
        undo.type = "button";
        undo.className = "btn btn-sm btn-outline-secondary";
        undo.dataset.action = "undo-combatant-reorder";
        undo.textContent = "Undo reorder";
        undo.title = "Undo the most recent combatant drag or keyboard reorder.";
        undo.onclick = () => {
            const target = reorderHistory[reorderHistory.length - 1];
            if (target) void applyOrder(target, null, "undo");
        };
        controls.insertBefore(undo, controls.firstChild);
    }

    if (!controls.querySelector("[data-action='reset-combatant-order']")) {
        const reset = document.createElement("button");
        reset.type = "button";
        reset.className = "btn btn-sm btn-outline-secondary";
        reset.dataset.action = "reset-combatant-order";
        reset.textContent = "Reset order";
        reset.title = "Restore the initiative order from when this encounter state was started or resumed.";
        reset.onclick = () => {
            if (baselineOrder) void applyOrder(baselineOrder, null, "reset");
        };
        const undo = controls.querySelector<HTMLElement>("[data-action='undo-combatant-reorder']");
        undo?.after(reset);
    }

    let hint = runner.querySelector<HTMLElement>(":scope > [data-role='reorder-hint']");
    if (!hint) {
        hint = document.createElement("div");
        hint.className = "bi-muted bi-reorder-hint";
        hint.dataset.role = "reorder-hint";
        hint.textContent = "Drag the grip on a combatant card to organize the order or move it across a block boundary. Blocks are re-derived after the drop.";
        const stack = runner.querySelector<HTMLElement>(":scope > [data-runner-blocks]");
        stack ? runner.insertBefore(hint, stack) : runner.append(hint);
    }

    root.classList.toggle("bi-reorder-busy", applying);
}

function updateReorderControls(runner: HTMLElement): void {
    const current = currentStateOrder();
    const undo = runner.querySelector<HTMLButtonElement>("[data-action='undo-combatant-reorder']");
    const reset = runner.querySelector<HTMLButtonElement>("[data-action='reset-combatant-order']");
    if (undo) undo.disabled = applying || reorderHistory.length === 0;
    if (reset) reset.disabled = applying || !baselineOrder || sameOrder(current, baselineOrder);

    for (const handle of runner.querySelectorAll<HTMLButtonElement>(".bi-drag-handle")) {
        handle.disabled = applying;
    }
}

async function applyOrder(
    order: string[],
    focusId: string | null,
    historyMode: "push" | "undo" | "reset"
): Promise<void> {
    if (applying || !lastPreview || !lastState || !endpointsPromise) return;

    const current = currentStateOrder();
    const expectedIds = lastPreview.response.orderedCombatants.map(combatant => combatant.id);
    if (!sameMembers(order, expectedIds) || !sameMembers(current, expectedIds)) {
        announce("The combatant list changed while reordering. Rebuild the encounter before trying again.");
        return;
    }
    if (sameOrder(order, current)) return;

    const active = lastState.response.blocks.find(block => block.id === lastState!.response.activeBlockId);
    const anchor = active?.memberOrder[0];
    if (!anchor) {
        announce("The active turn could not be preserved, so the reorder was not applied.");
        return;
    }

    const requestBase = baselineRequest ?? previewRequestFrom(lastPreview.request);
    const previousRuntime = getRuntimeManualOrder();
    const previousOrder = [...current];
    const previousState = lastState.response;
    applying = true;
    requestEnhancement();

    try {
        const endpoints = await endpointsPromise;
        setRuntimeManualOrder(order);
        const request: InitiativePreviewRequest = {
            ...requestBase,
            combatants: requestBase.combatants.map(combatant => ({ ...combatant })),
            manualOrderOverride: [...order]
        };
        const preview = await previewInitiative(endpoints.previewUrl, request);
        if (preview.requiresAdjudication) {
            throw new Error("The reordered initiative still requires a DM ruling.");
        }

        await loadInitiativeTurnState(endpoints.stateUrl, {
            ...request,
            advanceCount: 0,
            resumeRound: previousState.round,
            resumeActiveCombatantId: anchor,
            resumeCyclicMergeCompleted: previousState.cyclicMergeCompleted
        });

        if (historyMode === "push") reorderHistory.push(previousOrder);
        else if (historyMode === "undo") reorderHistory.pop();
        else reorderHistory = [];

        pendingFocusId = focusId;
        const blockCount = lastState?.response.blocks.length ?? preview.blocks.length;
        announce(`Initiative order updated. ${blockCount} block${blockCount === 1 ? "" : "s"} now derived from the DM order.`);
    } catch (error) {
        setRuntimeManualOrder(previousRuntime);
        announce(error instanceof Error ? error.message : "The initiative order could not be updated.");
    } finally {
        applying = false;
        requestEnhancement();
        focusPendingHandle(document.getElementById("tool-root") as HTMLElement | null);
    }
}

function currentStateOrder(): string[] {
    return lastState ? stateOrder(lastState.response) : [];
}

function stateOrder(state: InitiativeTurnStateResponse): string[] {
    return state.blocks.flatMap(block => block.memberOrder);
}

function previewRequestFrom(request: InitiativePreviewRequest | InitiativeTurnStateRequest): InitiativePreviewRequest {
    return {
        combatants: request.combatants.map(combatant => ({ ...combatant })),
        manualOrderOverride: request.manualOrderOverride ? [...request.manualOrderOverride] : null,
        tacticalGroupMode: request.tacticalGroupMode
    };
}

async function resolveEndpoints(root: HTMLElement): Promise<Endpoints> {
    const contextUrl = root.dataset.toolContextUrl;
    if (!contextUrl) {
        return {
            previewUrl: initiativePreviewUrl(null),
            stateUrl: initiativeStateUrl(null)
        };
    }

    const context = await loadToolHostContext(contextUrl);
    return {
        previewUrl: initiativePreviewUrl(context),
        stateUrl: initiativeStateUrl(context)
    };
}

function autoScroll(clientY: number): void {
    const threshold = 72;
    if (clientY < threshold) window.scrollBy({ top: -24, behavior: "auto" });
    else if (clientY > window.innerHeight - threshold) window.scrollBy({ top: 24, behavior: "auto" });
}

function combatantName(card: HTMLElement): string {
    return card.querySelector<HTMLElement>(".bi-runner-member-identity strong")?.textContent?.trim()
        || card.dataset.combatantId
        || "combatant";
}

function ensureLiveRegion(root: HTMLElement): HTMLElement {
    let region = root.querySelector<HTMLElement>("[data-role='reorder-live-region']");
    if (region) return region;
    region = document.createElement("div");
    region.dataset.role = "reorder-live-region";
    region.className = "visually-hidden";
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    root.append(region);
    return region;
}

function announce(message: string): void {
    if (!liveRegion) return;
    liveRegion.textContent = "";
    window.setTimeout(() => {
        if (liveRegion) liveRegion.textContent = message;
    }, 0);
}

function focusPendingHandle(root: HTMLElement | null): void {
    if (!root || !pendingFocusId || applying) return;
    const id = pendingFocusId;
    pendingFocusId = null;
    window.setTimeout(() => {
        for (const card of root.querySelectorAll<HTMLElement>(".bi-runner-member[data-combatant-id]")) {
            if (card.dataset.combatantId !== id) continue;
            card.querySelector<HTMLButtonElement>(":scope > .bi-drag-handle")?.focus();
            break;
        }
    }, 0);
}

function installStyles(documentRef: Document): void {
    if (documentRef.head.querySelector("style[data-role='combatant-drag-reorder-style']")) return;
    const style = documentRef.createElement("style");
    style.dataset.role = "combatant-drag-reorder-style";
    style.textContent = `
.block-initiative-app .bi-drag-handle{flex:0 0 auto;border:0;background:transparent;color:inherit;padding:.1rem .28rem;margin:-.05rem .05rem 0 -.1rem;border-radius:.3rem;cursor:grab;font-size:1.1rem;line-height:1;touch-action:none;opacity:.62}
.block-initiative-app .bi-drag-handle:hover,.block-initiative-app .bi-drag-handle:focus-visible{opacity:1;background:var(--bi-soft)}
.block-initiative-app .bi-drag-handle:active{cursor:grabbing}
.block-initiative-app .bi-runner-member.bi-drag-source{opacity:.42}
.block-initiative-app.bi-card-dragging,.block-initiative-app.bi-card-dragging *{user-select:none}
.block-initiative-app .bi-drop-indicator{height:4px;min-height:4px;border-radius:999px;background:currentColor;opacity:.72;margin:.1rem 0;pointer-events:none}
.block-initiative-app .bi-reorder-hint{font-size:.82rem;margin-top:-.15rem}
.block-initiative-app.bi-reorder-busy .bi-drag-handle{cursor:wait}
`;
    documentRef.head.append(style);
}
