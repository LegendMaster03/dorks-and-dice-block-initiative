import { registerAfterRender } from "./render-lifecycle";

let initialized = false;

export function initializeEncounterRunnerPolishUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    installStyles(root.ownerDocument);

    root.addEventListener("click", event => {
        const target = event.target;
        const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
        const trigger = element?.closest<HTMLButtonElement>(".bi-card-context-trigger");
        if (!trigger || !root.contains(trigger)) return;

        // The card-affordance handler opens/closes the menu on the trigger first.
        // This bubble-phase handler then chooses the horizontal direction using
        // the actual rendered width so the menu stays inside the viewport.
        const wrapper = trigger.closest<HTMLElement>(".bi-card-context-wrap");
        const menu = wrapper?.querySelector<HTMLElement>(":scope > .bi-card-context-menu");
        if (!menu || menu.hidden) return;
        positionContextMenu(trigger, menu);
    });

    window.addEventListener("resize", () => {
        for (const menu of root.querySelectorAll<HTMLElement>(".bi-card-context-menu:not([hidden])")) {
            const trigger = menu.parentElement?.querySelector<HTMLButtonElement>(":scope > .bi-card-context-trigger");
            if (trigger) positionContextMenu(trigger, menu);
        }
    });

    registerAfterRender("encounter-runner-polish", 160, () => {
        // All initiative blocks are visible simultaneously, so the internal
        // active block should always have a clear visual highlight.
        root.classList.add("bi-show-active-block");

        // The old optional active-block toggle is now redundant and can create
        // a misleading unhighlighted state while progression still has an
        // active block internally.
        root.querySelector<HTMLButtonElement>("[data-action='toggle-active-block-highlight']")?.remove();

        // The round counter already communicates ordinary round transitions.
        // Preserve exceptional notices such as the round-one cyclic merge.
        for (const notice of root.querySelectorAll<HTMLElement>(".bi-message.bi-success")) {
            if (/^Round\s+\d+\s+started\.$/i.test(notice.textContent?.trim() ?? "")) notice.remove();
        }

        for (const menu of root.querySelectorAll<HTMLElement>(".bi-card-context-menu:not([hidden])")) {
            const trigger = menu.parentElement?.querySelector<HTMLButtonElement>(":scope > .bi-card-context-trigger");
            if (trigger) positionContextMenu(trigger, menu);
        }
    });
}

function positionContextMenu(trigger: HTMLButtonElement, menu: HTMLElement): void {
    menu.dataset.openDirection = "left";
    const margin = 12;
    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();

    const leftWhenOpeningLeft = triggerRect.right - menuRect.width;
    const rightWhenOpeningRight = triggerRect.left + menuRect.width;

    if (leftWhenOpeningLeft < margin && rightWhenOpeningRight <= window.innerWidth - margin) {
        menu.dataset.openDirection = "right";
    }
}

function installStyles(documentRef: Document): void {
    if (documentRef.head.querySelector("style[data-role='encounter-runner-polish-ui-style']")) return;
    const style = documentRef.createElement("style");
    style.dataset.role = "encounter-runner-polish-ui-style";
    style.textContent = `
.block-initiative-app .bi-card-context-menu[data-open-direction='left']{left:auto!important;right:0!important}
.block-initiative-app .bi-card-context-menu[data-open-direction='right']{left:0!important;right:auto!important}
.block-initiative-app.bi-show-active-block .bi-runner-block.bi-active{border-width:2px}
`;
    documentRef.head.append(style);
}
