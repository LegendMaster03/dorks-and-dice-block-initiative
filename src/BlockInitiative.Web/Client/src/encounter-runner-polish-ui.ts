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

        // The round counter already communicates normal round transitions.
        // Keep exceptional messages such as the round-one cyclic merge.
        for (const notice of root.querySelectorAll<HTMLElement>(".bi-message.bi-success")) {
            if (/^Round\s+\d+\s+started\.$/i.test(notice.textContent?.trim() ?? "")) notice.remove();
        }

        for (const card of root.querySelectorAll<HTMLElement>(".bi-runner-member[data-combatant-id]")) {
            ensurePrimaryStats(card);
        }

        for (const menu of root.querySelectorAll<HTMLElement>(".bi-card-context-menu:not([hidden])")) {
            const trigger = menu.parentElement?.querySelector<HTMLButtonElement>(":scope > .bi-card-context-trigger");
            if (trigger) positionContextMenu(trigger, menu);
        }
    });
}

function ensurePrimaryStats(card: HTMLElement): void {
    const acFact = Array.from(card.querySelectorAll<HTMLElement>(".bi-quick-fact"))
        .find(fact => /^AC\s/i.test(fact.textContent?.trim() ?? ""));
    const ac = acFact?.textContent?.trim().replace(/^AC\s*/i, "") || null;
    if (acFact) acFact.hidden = true;

    const hp = readHealth(card);
    let cluster = card.querySelector<HTMLElement>(":scope > .bi-card-primary-stats");
    if (!ac && !hp) {
        cluster?.remove();
        return;
    }

    if (!cluster) {
        cluster = document.createElement("div");
        cluster.className = "bi-card-primary-stats";
        const initiative = card.querySelector<HTMLElement>(":scope > .bi-card-initiative");
        const acted = card.querySelector<HTMLElement>(":scope > .bi-acted-toggle");
        const context = card.querySelector<HTMLElement>(":scope > .bi-card-context-wrap");
        const anchor = initiative ?? acted ?? context;
        anchor ? card.insertBefore(cluster, anchor) : card.append(cluster);
    }

    const signature = `${ac ?? ""}\u0000${hp ?? ""}`;
    if (cluster.dataset.primaryStatsSignature === signature) return;
    cluster.dataset.primaryStatsSignature = signature;
    cluster.replaceChildren();
    if (ac) cluster.append(metric("AC", ac));
    if (hp) cluster.append(metric("HP", hp));
}

function readHealth(card: HTMLElement): string | null {
    const statuses = Array.from(card.querySelectorAll<HTMLElement>(".bi-integrated-state .bi-statuses"));
    for (const status of statuses) {
        const text = status.textContent ?? "";
        const pair = text.match(/HP\s*(-?\d+)\s*\/\s*(-?\d+)/i);
        if (pair) return `${pair[1]}/${pair[2]}`;
        const single = text.match(/HP\s*(-?\d+)/i);
        if (single) return single[1];
    }
    return null;
}

function metric(label: string, value: string): HTMLElement {
    const item = document.createElement("span");
    item.className = "bi-card-primary-stat";
    const strong = document.createElement("strong");
    strong.textContent = value;
    const caption = document.createElement("span");
    caption.textContent = label;
    item.append(strong, caption);
    return item;
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
.block-initiative-app .bi-card-primary-stats{display:flex;gap:.75rem;align-items:flex-start;flex:0 0 auto;font-variant-numeric:tabular-nums}
.block-initiative-app .bi-card-primary-stat{display:grid;justify-items:center;line-height:1}
.block-initiative-app .bi-card-primary-stat>strong{font-size:1.05rem;font-weight:800}
.block-initiative-app .bi-card-primary-stat>span{font-size:.62rem;text-transform:uppercase;letter-spacing:.04em;opacity:.62;margin-top:.18rem}
.block-initiative-app.bi-stats-hidden .bi-card-primary-stats{display:none!important}
@media(max-width:620px){.block-initiative-app .bi-card-primary-stats{order:2;margin-left:auto}}
`;
    documentRef.head.append(style);
}
