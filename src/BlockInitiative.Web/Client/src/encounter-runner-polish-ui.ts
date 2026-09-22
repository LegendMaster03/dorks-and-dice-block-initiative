import { renderEncounterCardMetrics } from "./encounter-card-renderer";
import { registerAfterRender } from "./render-lifecycle";

let initialized = false;

export function initializeEncounterRunnerPolishUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    const documentRef = root.ownerDocument;
    installStyles(documentRef);

    // The context-menu trigger stops bubbling in its own handler. Listen in
    // capture phase, then position after that handler has opened the menu.
    documentRef.addEventListener("click", event => {
        const target = event.target;
        const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
        const trigger = element?.closest<HTMLButtonElement>(".bi-card-context-trigger");
        if (!trigger || !root.contains(trigger)) return;

        queueMicrotask(() => {
            const wrapper = trigger.closest<HTMLElement>(".bi-card-context-wrap");
            const menu = wrapper?.querySelector<HTMLElement>(":scope > .bi-card-context-menu");
            if (menu && !menu.hidden) positionContextMenu(trigger, menu);
        });
    }, true);

    window.addEventListener("resize", () => {
        for (const menu of root.querySelectorAll<HTMLElement>(".bi-card-context-menu:not([hidden])")) {
            const trigger = menu.parentElement?.querySelector<HTMLButtonElement>(":scope > .bi-card-context-trigger");
            if (trigger) positionContextMenu(trigger, menu);
        }
    });

    registerAfterRender("encounter-runner-polish", 160, () => {
        // All blocks are visible at once, so the internal active block should
        // always be visually obvious rather than being an optional overlay.
        root.classList.add("bi-show-active-block");
        root.querySelector<HTMLButtonElement>("[data-action='toggle-active-block-highlight']")?.remove();
        highlightActiveNavigation(root);

        // The round counter already communicates normal round transitions.
        // Keep exceptional messages such as the round-one cyclic merge.
        for (const notice of root.querySelectorAll<HTMLElement>(".bi-message.bi-success")) {
            if (/^Round\s+\d+\s+started\.$/i.test(notice.textContent?.trim() ?? "")) notice.remove();
        }

        for (const card of root.querySelectorAll<HTMLElement>(".bi-runner-member[data-combatant-id]")) {
            updateCardMetrics(card);
        }

        for (const menu of root.querySelectorAll<HTMLElement>(".bi-card-context-menu:not([hidden])")) {
            const trigger = menu.parentElement?.querySelector<HTMLButtonElement>(":scope > .bi-card-context-trigger");
            if (trigger) positionContextMenu(trigger, menu);
        }
    });
}

function highlightActiveNavigation(root: HTMLElement): void {
    const activeBlock = root.querySelector<HTMLElement>("[data-runner-block].bi-active[data-block-id]");
    const activeId = activeBlock?.dataset.blockId ?? null;
    for (const chip of root.querySelectorAll<HTMLElement>(".bi-block-jump[data-block-id]")) {
        chip.classList.toggle("active", Boolean(activeId && chip.dataset.blockId === activeId));
    }
}

function updateCardMetrics(card: HTMLElement): void {
    const quickFacts = Array.from(card.querySelectorAll<HTMLElement>(".bi-quick-fact"));
    const acFact =
        quickFacts.find(
            fact => /^AC\s/i.test(
                fact.textContent?.trim() ?? ""));
    const touchAcFact =
        quickFacts.find(
            fact => /^Touch AC\s/i.test(
                fact.textContent?.trim() ?? ""));
    const flatFootedAcFact =
        quickFacts.find(
            fact => /^Flat-Footed AC\s/i.test(
                fact.textContent?.trim() ?? ""));
    const speedFact =
        quickFacts.find(
            fact => /^Speed\s/i.test(
                fact.textContent?.trim() ?? ""));
    const armorClass = factValue(acFact, "AC");
    const touchArmorClass =
        factValue(touchAcFact, "Touch AC");
    const flatFootedArmorClass =
        factValue(flatFootedAcFact, "Flat-Footed AC");
    const speed = factValue(speedFact, "Speed");
    if (acFact) acFact.hidden = true;
    if (touchAcFact) touchAcFact.hidden = true;
    if (flatFootedAcFact) flatFootedAcFact.hidden = true;
    if (speedFact) speedFact.hidden = true;

    const factRow = card.querySelector<HTMLElement>(":scope > .bi-quick-stats .bi-quick-facts");
    if (factRow) {
        factRow.hidden = Array.from(factRow.children)
            .every(child => child instanceof HTMLElement && child.hidden);
    }

    renderEncounterCardMetrics(card, {
        speed,
        armorClass,
        touchArmorClass,
        flatFootedArmorClass
    });
}

function factValue(fact: HTMLElement | undefined, label: string): string | null {
    const text = fact?.textContent?.trim() ?? "";
    if (!text) return null;
    return text.replace(new RegExp(`^${label}\\s*`, "i"), "").trim() || null;
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
.block-initiative-app.bi-show-active-block .bi-runner-block.bi-active{border-width:2px;border-color:var(--bs-primary,#0d6efd);box-shadow:0 0 0 2px color-mix(in srgb,var(--bs-primary,#0d6efd) 22%,transparent)}
`;
    documentRef.head.append(style);
}
