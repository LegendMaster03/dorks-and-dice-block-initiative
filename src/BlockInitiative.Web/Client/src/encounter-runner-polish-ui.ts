import { chooseHealthEditor } from "./encounter-card-model";
import { registerAfterRender } from "./render-lifecycle";

let initialized = false;

export function initializeEncounterRunnerPolishUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    const documentRef = root.ownerDocument;
    installStyles(documentRef);

    // Runner blocks are disposable presentation DOM. Return the real health
    // controls to the stable combat-state dashboard before a block rebuild can
    // destroy the card that currently hosts them.
    registerAfterRender("preserve-runner-health-controls", 15, () => preserveHealthControls(root));

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
            ensureSecondaryStatline(card);
            normalizeHeaderOrder(card);
        }

        for (const menu of root.querySelectorAll<HTMLElement>(".bi-card-context-menu:not([hidden])")) {
            const trigger = menu.parentElement?.querySelector<HTMLButtonElement>(":scope > .bi-card-context-trigger");
            if (trigger) positionContextMenu(trigger, menu);
        }
    });
}

function preserveHealthControls(root: HTMLElement): void {
    const dashboard = root.querySelector<HTMLElement>("[data-combat-dashboard]");
    if (!dashboard) return;
    const healthList = dashboard.querySelector<HTMLElement>(".bi-health-list");

    for (const card of root.querySelectorAll<HTMLElement>(".bi-runner-member[data-combatant-id]")) {
        const healthRow = card.querySelector<HTMLElement>(".bi-integrated-health[data-combatant-id]");
        if (!healthRow) continue;

        const ownedHealthEditor = card.querySelector<HTMLElement>(
            ":scope > .bi-card-secondary-statline > .bi-card-secondary-right > .bi-card-secondary-health > .bi-hp-editor"
        );
        if (ownedHealthEditor && ownedHealthEditor.parentElement !== healthRow) {
            healthRow.append(ownedHealthEditor);
        }

        healthRow.hidden = false;
        (healthList ?? dashboard).append(healthRow);
    }
}

function highlightActiveNavigation(root: HTMLElement): void {
    const activeBlock = root.querySelector<HTMLElement>("[data-runner-block].bi-active[data-block-id]");
    const activeId = activeBlock?.dataset.blockId ?? null;
    for (const chip of root.querySelectorAll<HTMLElement>(".bi-block-jump[data-block-id]")) {
        chip.classList.toggle("active", Boolean(activeId && chip.dataset.blockId === activeId));
    }
}

function ensureSecondaryStatline(card: HTMLElement): void {
    const quickFacts = Array.from(card.querySelectorAll<HTMLElement>(".bi-quick-fact"));
    const acFact = quickFacts.find(fact => /^AC\s/i.test(fact.textContent?.trim() ?? ""));
    const speedFact = quickFacts.find(fact => /^Speed\s/i.test(fact.textContent?.trim() ?? ""));
    const ac = factValue(acFact, "AC");
    const speed = factValue(speedFact, "Speed");
    if (acFact) acFact.hidden = true;
    if (speedFact) speedFact.hidden = true;

    const factRow = card.querySelector<HTMLElement>(":scope > .bi-quick-stats .bi-quick-facts");
    if (factRow) {
        factRow.hidden = Array.from(factRow.children).every(child => child instanceof HTMLElement && child.hidden);
    }

    // Hook 50 creates the real HP editor inside the health row. Hook 160 moves
    // that editor into the card stat line, so later passes must treat the card
    // as its owner. A newly rendered health row takes precedence and replaces
    // any stale card-owned editor.
    const healthRow = card.querySelector<HTMLElement>(".bi-integrated-health[data-combatant-id]");
    const rowHealthEditor = healthRow?.querySelector<HTMLElement>(":scope > .bi-hp-editor") ?? null;
    let statline = card.querySelector<HTMLElement>(":scope > .bi-card-secondary-statline");
    const ownedHealthEditor = statline?.querySelector<HTMLElement>(
        ":scope > .bi-card-secondary-right > .bi-card-secondary-health > .bi-hp-editor"
    ) ?? null;
    const healthEditor = chooseHealthEditor(rowHealthEditor, ownedHealthEditor);
    if (!speed && !ac && !healthEditor) {
        statline?.remove();
        return;
    }

    if (!statline) {
        statline = document.createElement("div");
        statline.className = "bi-card-secondary-statline";
    }

    let left = statline.querySelector<HTMLElement>(":scope > .bi-card-secondary-left");
    if (!left) {
        left = document.createElement("div");
        left.className = "bi-card-secondary-left";
        statline.prepend(left);
    }
    left.replaceChildren();
    if (speed) {
        const label = document.createElement("strong");
        label.textContent = "Speed";
        left.append(label, document.createTextNode(` ${speed}`));
    }

    let right = statline.querySelector<HTMLElement>(":scope > .bi-card-secondary-right");
    if (!right) {
        right = document.createElement("div");
        right.className = "bi-card-secondary-right";
        statline.append(right);
    }

    let acMetric = right.querySelector<HTMLElement>(":scope > .bi-card-secondary-stat[data-stat='ac']");
    if (ac) {
        if (!acMetric) {
            acMetric = metric("AC", ac);
            acMetric.dataset.stat = "ac";
            right.prepend(acMetric);
        } else {
            acMetric.querySelector<HTMLElement>(":scope > strong")!.textContent = ac;
        }
    } else {
        acMetric?.remove();
    }

    let healthWrap = right.querySelector<HTMLElement>(":scope > .bi-card-secondary-health");
    if (healthEditor) {
        if (!healthWrap) {
            healthWrap = document.createElement("div");
            healthWrap.className = "bi-card-secondary-health";
            const caption = document.createElement("span");
            caption.className = "bi-card-secondary-health-label";
            caption.textContent = "HP";
            healthWrap.append(caption);
            right.append(healthWrap);
        }
        for (const staleEditor of Array.from(healthWrap.querySelectorAll<HTMLElement>(":scope > .bi-hp-editor"))) {
            if (staleEditor !== healthEditor) staleEditor.remove();
        }
        const caption = healthWrap.querySelector<HTMLElement>(":scope > .bi-card-secondary-health-label");
        if (healthEditor.parentElement !== healthWrap) {
            caption ? healthWrap.insertBefore(healthEditor, caption) : healthWrap.prepend(healthEditor);
        }
        if (healthRow) healthRow.hidden = true;
    } else {
        healthWrap?.remove();
    }

    if (!left.textContent?.trim() && !right.childElementCount) {
        statline.remove();
        return;
    }

    const firstBody = card.querySelector<HTMLElement>(
        ":scope > .bi-card-condition-summary, :scope > .bi-quick-stats, :scope > .bi-integrated-state, :scope > .bi-integrated-conditions"
    );
    firstBody ? card.insertBefore(statline, firstBody) : card.append(statline);
}

function normalizeHeaderOrder(card: HTMLElement): void {
    const initiative = card.querySelector<HTMLElement>(":scope > .bi-card-initiative");
    const acted = card.querySelector<HTMLElement>(":scope > .bi-acted-toggle");
    const context = card.querySelector<HTMLElement>(":scope > .bi-card-context-wrap");
    const statline = card.querySelector<HTMLElement>(":scope > .bi-card-secondary-statline");
    const firstBody = statline ?? card.querySelector<HTMLElement>(
        ":scope > .bi-card-condition-summary, :scope > .bi-quick-stats, :scope > .bi-integrated-state, :scope > .bi-integrated-conditions"
    );

    // Keep the right side of the header in a stable order:
    // initiative -> acted -> context menu. AC/HP move to the row beneath.
    for (const item of [initiative, acted, context]) {
        if (!item) continue;
        firstBody ? card.insertBefore(item, firstBody) : card.append(item);
    }
}

function factValue(fact: HTMLElement | undefined, label: string): string | null {
    const text = fact?.textContent?.trim() ?? "";
    if (!text) return null;
    return text.replace(new RegExp(`^${label}\\s*`, "i"), "").trim() || null;
}

function metric(label: string, value: string): HTMLElement {
    const item = document.createElement("span");
    item.className = "bi-card-secondary-stat";
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
.block-initiative-app .bi-card-secondary-statline{display:flex;justify-content:space-between;align-items:flex-end;gap:.75rem;flex:1 0 100%;width:100%;padding-top:.42rem;border-top:1px solid var(--bi-border);font-variant-numeric:tabular-nums}
.block-initiative-app .bi-card-secondary-left{min-width:0;font-size:.88rem}
.block-initiative-app .bi-card-secondary-right{display:flex;gap:.8rem;align-items:flex-end;margin-left:auto}
.block-initiative-app .bi-card-secondary-stat{display:grid;justify-items:center;line-height:1;min-width:2.6rem}
.block-initiative-app .bi-card-secondary-stat>strong{font-size:1.05rem;font-weight:800}
.block-initiative-app .bi-card-secondary-stat[data-stat='ac']>strong{font-size:1.45rem}
.block-initiative-app .bi-card-secondary-stat>span,.block-initiative-app .bi-card-secondary-health-label{font-size:.62rem;text-transform:uppercase;letter-spacing:.04em;opacity:.62;margin-top:.18rem}
.block-initiative-app .bi-card-secondary-health{display:grid;justify-items:center;line-height:1;min-width:5.6rem}
.block-initiative-app .bi-card-secondary-health>.bi-hp-editor{margin:0}
.block-initiative-app .bi-card-secondary-health .bi-hp-summary{margin:0}
.block-initiative-app .bi-card-secondary-statline + .bi-quick-stats{border-top:0;padding-top:0}
.block-initiative-app.bi-stats-hidden .bi-card-secondary-statline{display:none!important}
@media(max-width:620px){
  .block-initiative-app .bi-card-secondary-statline{align-items:center}
  .block-initiative-app .bi-card-secondary-right{gap:.55rem}
}
`;
    documentRef.head.append(style);
}
