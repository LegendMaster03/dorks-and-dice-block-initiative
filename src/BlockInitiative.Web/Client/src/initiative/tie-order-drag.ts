/**
 * Adds drag-and-drop ordering to one unresolved initiative-tie list.
 *
 * The list itself remains the source of truth until the DM applies the ruling.
 * Each row represents one indivisible tie unit, so tactical-group members move
 * together without changing the underlying initiative rolls.
 */
export function enableTieOrderDrag(
    list: HTMLOListElement,
    announce: (message: string) => void = () => {}
): void {
    if (list.dataset.tieDragReady === "true") return;
    list.dataset.tieDragReady = "true";
    installStyles(list.ownerDocument);

    let dragging: HTMLElement | null = null;

    for (const item of tieItems(list)) {
        item.draggable = true;

        const row =
            item.querySelector<HTMLElement>(
                ":scope > [data-role='tie-unit-row']");
        if (!row) continue;

        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "bi-tie-drag-handle";
        handle.textContent = "⠿";
        handle.draggable = true;

        const label =
            item.querySelector<HTMLElement>("strong")
                ?.textContent?.trim()
            ?? "tied unit";
        handle.setAttribute("aria-label", `Reorder ${label}`);
        handle.title =
            "Drag to reorder this tied unit. Arrow Up and Arrow Down "
            + "also move it one position.";
        row.prepend(handle);

        item.addEventListener("dragstart", event => {
            dragging = item;
            item.classList.add("bi-tie-dragging");
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(
                    "text/plain",
                    item.dataset.ids ?? "");
            }
        });

        item.addEventListener("dragend", () => {
            if (dragging !== item) return;
            finishDrag(item, list, announce);
            dragging = null;
        });

        handle.addEventListener("keydown", event => {
            if (event.key !== "ArrowUp"
                && event.key !== "ArrowDown") {
                return;
            }

            event.preventDefault();
            const direction =
                event.key === "ArrowUp"
                    ? -1
                    : 1;
            if (!moveTieUnit(item, direction)) {
                announce(
                    `${label} is already at the ${direction < 0 ? "top" : "bottom"} of the tie order.`);
                return;
            }

            handle.focus();
            announcePosition(item, list, announce);
        });
    }

    list.addEventListener("dragover", event => {
        if (!dragging) return;
        event.preventDefault();

        const targetElement =
            event.target instanceof Element
                ? event.target
                : null;
        const target =
            targetElement?.closest<HTMLElement>(".bi-tie-unit")
            ?? null;

        if (!target
            || target === dragging
            || target.parentElement !== list) {
            return;
        }

        const bounds = target.getBoundingClientRect();
        const before =
            event.clientY < bounds.top + bounds.height / 2;

        if (before) {
            list.insertBefore(dragging, target);
        } else {
            list.insertBefore(dragging, target.nextSibling);
        }
    });

    list.addEventListener("drop", event => {
        if (!dragging) return;
        event.preventDefault();
        const item = dragging;
        finishDrag(item, list, announce);
        dragging = null;
    });
}

export function moveTieUnit(
    item: HTMLElement,
    direction: -1 | 1
): boolean {
    const sibling =
        direction < 0
            ? item.previousElementSibling
            : item.nextElementSibling;
    if (!(sibling instanceof HTMLElement)
        || sibling.parentElement !== item.parentElement) {
        return false;
    }

    if (direction < 0) {
        item.parentElement?.insertBefore(item, sibling);
    } else {
        item.parentElement?.insertBefore(sibling, item);
    }
    return true;
}

function tieItems(list: HTMLOListElement): HTMLElement[] {
    return Array.from(
        list.querySelectorAll<HTMLElement>(
            ":scope > .bi-tie-unit[data-ids]"));
}

function finishDrag(
    item: HTMLElement,
    list: HTMLOListElement,
    announce: (message: string) => void
): void {
    item.classList.remove("bi-tie-dragging");
    announcePosition(item, list, announce);
}

function announcePosition(
    item: HTMLElement,
    list: HTMLOListElement,
    announce: (message: string) => void
): void {
    const items = tieItems(list);
    const index = items.indexOf(item);
    if (index < 0) return;

    const label =
        item.querySelector<HTMLElement>("strong")
            ?.textContent?.trim()
        ?? "Tied unit";
    announce(
        `${label} is position ${index + 1} of ${items.length}.`);
}

function installStyles(documentRef: Document): void {
    if (documentRef.head.querySelector(
        "style[data-role='tie-order-drag-style']"
    )) {
        return;
    }

    const style = documentRef.createElement("style");
    style.dataset.role = "tie-order-drag-style";
    style.textContent = `
.block-initiative-app .bi-adjudication{border:1px solid rgba(255,193,7,.55);border-left-width:4px;box-shadow:0 0 0 2px rgba(255,193,7,.14)}
.block-initiative-app .bi-tie-order{margin:.35rem 0 0;padding-left:1.8rem;gap:.4rem}
.block-initiative-app .bi-tie-unit{padding:.4rem .5rem;border:1px solid var(--bi-border);border-radius:.45rem;background:var(--bs-body-bg,transparent)}
.block-initiative-app .bi-tie-unit-row{display:flex;align-items:center;gap:.5rem;min-width:0}
.block-initiative-app .bi-tie-unit-row strong{min-width:0;overflow-wrap:anywhere}
.block-initiative-app .bi-tie-drag-handle{flex:0 0 auto;border:0;background:transparent;color:inherit;padding:.1rem .25rem;border-radius:.3rem;cursor:grab;font-size:1.1rem;line-height:1;opacity:.7}
.block-initiative-app .bi-tie-drag-handle:hover,.block-initiative-app .bi-tie-drag-handle:focus-visible{opacity:1;background:var(--bi-soft)}
.block-initiative-app .bi-tie-dragging{opacity:.48}
.block-initiative-app .bi-tie-dragging .bi-tie-drag-handle{cursor:grabbing}
`;
    documentRef.head.append(style);
}
