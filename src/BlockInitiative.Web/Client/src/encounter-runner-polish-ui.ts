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
            ensureSecondaryStatline(card);
            normalizeHeaderOrder(card);
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

    const hp = readHealth(card);
    let statline = card.querySelector<HTMLElement>(":scope > .bi-card-secondary-statline");
    if (!speed && !ac && !hp) {
        statline?.remove();
        return;
    }

    if (!statline) {
        statline = document.createElement("div");
        statline.className = "bi-card-secondary-statline";
    }

    const signature = `${speed ?? ""}\u0000${ac ?? ""}\u0000${hp ?? ""}`;
    if (statline.dataset.secondaryStatsSignature !== signature) {
        statline.dataset.secondaryStatsSignature = signature;
        statline.replaceChildren();

        const left = document.createElement("div");
        left.className = "bi-card-secondary-left";
        if (speed) {
            const label = document.createElement("strong");
            label.textContent = "Speed";
            left.append(label, document.createTextNode(` ${speed}`));
        }

        const right = document.createElement("div");
        right.className = "bi-card-secondary-right";
        if (ac) right.append(metric("AC", ac));
        if (hp) right.append(metric("HP", hp));

        if (left.childElementCount || left.textContent) statline.append(left);
        if (right.childElementCount) statline.append(right);
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

function readHealth(card: HTMLElement): string | null {
    const statuses = Array.from(card.querySelectorAll<HTMLElement>(".bi-integrated-state .bi-statuses"));
    for (const status of statuses) {
        const text = status.textContent ?? "";
        const pair = text.match(/HP\s*(-?\d+)\s*\/\s*(-?\d+)/i);
        if (pair) return `${pair[1]}/${pair[2]}`;
        const single = text.match(/HP\s*(-?\d+)/i);
        if (single) return single[1];
    }

    // The live health row can be rebuilt after the card polish pass. Fall back
    // to the authoritative setup inputs so a configured/imported HP value is
    // still present in the card header on the first encounter render.
    const combatantId = card.dataset.combatantId;
    const root = card.closest<HTMLElement>(".block-initiative-app");
    if (!combatantId || !root) return null;

    const setupCard = Array.from(root.querySelectorAll<HTMLElement>(".bi-entry[data-id]"))
        .find(entry => entry.dataset.id === combatantId);
    const healthSetup = setupCard?.querySelector<HTMLElement>("[data-combat-setup='standard']");
    if (!healthSetup) return null;

    const current = readLabeledNumber(healthSetup, "Current HP");
    const max = readLabeledNumber(healthSetup, "Max HP");
    if (current === null && max === null) return null;
    if (max === null) return String(current);
    return `${current ?? max}/${max}`;
}

function readLabeledNumber(container: HTMLElement, labelText: string): number | null {
    for (const field of container.querySelectorAll<HTMLElement>(".bi-field")) {
        if (field.querySelector("label")?.textContent?.trim() !== labelText) continue;
        const raw = field.querySelector<HTMLInputElement>("input")?.value.trim() ?? "";
        if (!raw) return null;
        const value = Number(raw);
        return Number.isFinite(value) ? value : null;
    }
    return null;
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
.block-initiative-app .bi-card-secondary-stat>span{font-size:.62rem;text-transform:uppercase;letter-spacing:.04em;opacity:.62;margin-top:.18rem}
.block-initiative-app .bi-card-secondary-statline + .bi-quick-stats{border-top:0;padding-top:0}
.block-initiative-app.bi-stats-hidden .bi-card-secondary-statline{display:none!important}
@media(max-width:620px){
  .block-initiative-app .bi-card-secondary-statline{align-items:center}
  .block-initiative-app .bi-card-secondary-right{gap:.55rem}
}
`;
    documentRef.head.append(style);
}
