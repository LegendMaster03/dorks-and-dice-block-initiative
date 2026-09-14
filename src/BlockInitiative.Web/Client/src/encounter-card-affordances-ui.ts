import { registerAfterRender, requestEnhancement } from "./render-lifecycle";

type CombatantPreview = {
    id: string;
    initiativeTotal: number;
    effectiveInitiative: number;
    initiativeModifier: number | null;
};

type PreviewDetail = {
    response: {
        orderedCombatants: CombatantPreview[];
    };
};

let initialized = false;
let lastPreview: PreviewDetail | null = null;

export function initializeEncounterCardAffordancesUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    installStyles(root.ownerDocument);
    installDismissHandlers(root.ownerDocument);

    window.addEventListener("block-initiative:preview", event => {
        lastPreview = (event as CustomEvent<PreviewDetail>).detail ?? null;
        requestEnhancement();
    });

    registerAfterRender("encounter-card-affordances", 140, () => enhance(root));
}

function enhance(root: HTMLElement): void {
    const combatants = lastPreview?.response.orderedCombatants ?? [];
    const byId = new Map(combatants.map(combatant => [combatant.id, combatant]));

    for (const card of root.querySelectorAll<HTMLElement>(".bi-runner-member[data-combatant-id]")) {
        const combatantId = card.dataset.combatantId;
        if (!combatantId) continue;

        const combatant = byId.get(combatantId);
        if (combatant) ensureInitiativeDisplay(card, combatant);
        ensureContextMenu(card, combatantId);
        suppressDuplicateInitiativeFact(card);
        refreshConditionPresentation(card);
    }
}

function ensureInitiativeDisplay(card: HTMLElement, combatant: CombatantPreview): void {
    let display = card.querySelector<HTMLElement>(":scope > .bi-card-initiative");
    if (!display) {
        display = document.createElement("div");
        display.className = "bi-card-initiative";
        const acted = card.querySelector<HTMLElement>(":scope > .bi-acted-toggle");
        acted ? card.insertBefore(display, acted) : card.append(display);
    }

    display.replaceChildren();
    const total = document.createElement("strong");
    total.className = "bi-card-initiative-total";
    total.textContent = formatNumber(combatant.initiativeTotal);

    const modifier = document.createElement("span");
    modifier.className = "bi-card-initiative-modifier";
    modifier.textContent = combatant.initiativeModifier === null
        ? "no modifier"
        : `${signed(combatant.initiativeModifier)} mod`;

    display.append(total, modifier);
    display.title = combatant.effectiveInitiative !== combatant.initiativeTotal
        ? `Rolled initiative ${formatNumber(combatant.initiativeTotal)}; tactical-group position ${formatNumber(combatant.effectiveInitiative)}.`
        : `Rolled initiative ${formatNumber(combatant.initiativeTotal)}.`;
}

function ensureContextMenu(card: HTMLElement, combatantId: string): void {
    let wrapper = card.querySelector<HTMLElement>(":scope > .bi-card-context-wrap");
    if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.className = "bi-card-context-wrap";

        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "bi-card-context-trigger";
        trigger.dataset.action = "combatant-context-menu";
        trigger.textContent = "⋯";
        trigger.title = "Manage combatant";
        trigger.setAttribute("aria-label", "Manage combatant");
        trigger.setAttribute("aria-haspopup", "dialog");
        trigger.setAttribute("aria-expanded", "false");

        const menu = document.createElement("div");
        menu.className = "bi-card-context-menu";
        menu.dataset.combatantContextFor = combatantId;
        menu.setAttribute("role", "dialog");
        menu.setAttribute("aria-label", "Combatant controls");
        menu.hidden = true;

        const heading = document.createElement("strong");
        heading.className = "bi-card-context-heading";
        heading.textContent = "Conditions";
        menu.append(heading);

        trigger.onclick = event => {
            event.stopPropagation();
            const shouldOpen = menu.hidden;
            closeAllCardMenus(card.ownerDocument);
            menu.hidden = !shouldOpen;
            trigger.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
        };

        wrapper.append(trigger, menu);
        card.append(wrapper);
    }

    const menu = wrapper.querySelector<HTMLElement>(":scope > .bi-card-context-menu");
    if (!menu) return;

    const conditionSection = card.querySelector<HTMLElement>(":scope > .bi-integrated-conditions");
    if (conditionSection && conditionSection.parentElement !== menu) {
        conditionSection.classList.add("bi-card-context-conditions");
        menu.append(conditionSection);
    }
}

function refreshConditionPresentation(card: HTMLElement): void {
    const menu = card.querySelector<HTMLElement>(":scope > .bi-card-context-wrap > .bi-card-context-menu");
    if (!menu) return;

    const conditionButtons = Array.from(menu.querySelectorAll<HTMLButtonElement>(".bi-condition-chip"));
    for (const button of conditionButtons) {
        button.dataset.conditionTone = conditionTone(button.textContent ?? "");
    }

    let summary = card.querySelector<HTMLElement>(":scope > .bi-card-condition-summary");
    if (!conditionButtons.length) {
        summary?.remove();
        return;
    }

    if (!summary) {
        summary = document.createElement("div");
        summary.className = "bi-card-condition-summary";
        const quickStats = card.querySelector<HTMLElement>(":scope > .bi-quick-stats");
        quickStats ? card.insertBefore(summary, quickStats) : card.append(summary);
    }

    const signature = conditionButtons.map(button => button.textContent ?? "").join("\u0000");
    if (summary.dataset.conditionSummarySignature === signature) return;
    summary.dataset.conditionSummarySignature = signature;
    summary.replaceChildren(...conditionButtons.map(button => {
        const chip = document.createElement("span");
        chip.className = "bi-card-condition-chip";
        chip.dataset.conditionTone = conditionTone(button.textContent ?? "");
        chip.textContent = button.textContent ?? "Condition";
        return chip;
    }));
}

function suppressDuplicateInitiativeFact(card: HTMLElement): void {
    for (const fact of card.querySelectorAll<HTMLElement>(".bi-quick-fact")) {
        if (/^Init\s/i.test(fact.textContent?.trim() ?? "")) fact.hidden = true;
    }
}

function conditionTone(label: string): "danger" | "warning" | "info" | "positive" | "neutral" {
    const value = label.toLowerCase();
    if (/(unconscious|paraly|petrif|stunn|poison|dying|dead)/.test(value)) return "danger";
    if (/(blind|charm|deafen|fright|grapple|incapacitat|prone|restrain|exhaust)/.test(value)) return "warning";
    if (/(invis|hidden|concentrat|flying|fly)/.test(value)) return "info";
    if (/(bless|haste|inspir|protect|advantage)/.test(value)) return "positive";
    return "neutral";
}

function installDismissHandlers(documentRef: Document): void {
    documentRef.addEventListener("pointerdown", event => {
        const target = event.target;
        const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
        if (element?.closest(".bi-card-context-wrap")) return;
        closeAllCardMenus(documentRef);
    });
    documentRef.addEventListener("keydown", event => {
        if (event.key === "Escape") closeAllCardMenus(documentRef);
    });
}

function closeAllCardMenus(documentRef: Document): void {
    for (const wrapper of documentRef.querySelectorAll<HTMLElement>(".bi-card-context-wrap")) {
        const trigger = wrapper.querySelector<HTMLButtonElement>(":scope > .bi-card-context-trigger");
        const menu = wrapper.querySelector<HTMLElement>(":scope > .bi-card-context-menu");
        if (menu) menu.hidden = true;
        trigger?.setAttribute("aria-expanded", "false");
    }
}

function installStyles(documentRef: Document): void {
    if (documentRef.head.querySelector("style[data-role='encounter-card-affordances-ui-style']")) return;
    const style = documentRef.createElement("style");
    style.dataset.role = "encounter-card-affordances-ui-style";
    style.textContent = `
.block-initiative-app .bi-card-initiative{display:grid;justify-items:end;align-content:start;min-width:3.2rem;margin-left:auto;font-variant-numeric:tabular-nums}
.block-initiative-app .bi-card-initiative-total{font-size:1.45rem;line-height:1;font-weight:800}
.block-initiative-app .bi-card-initiative-modifier{font-size:.68rem;line-height:1.1;opacity:.64;margin-top:.18rem;white-space:nowrap}
.block-initiative-app .bi-acted-toggle{margin-left:.3rem}
.block-initiative-app .bi-card-context-wrap{position:relative;flex:0 0 auto;align-self:flex-start}
.block-initiative-app .bi-card-context-trigger{border:0;background:transparent;color:inherit;font-size:1.35rem;line-height:1;padding:.05rem .25rem;border-radius:.3rem;opacity:.68}
.block-initiative-app .bi-card-context-trigger:hover,.block-initiative-app .bi-card-context-trigger:focus-visible{opacity:1;background:var(--bi-soft)}
.block-initiative-app .bi-card-context-menu{position:absolute;z-index:70;top:calc(100% + .3rem);right:0;width:min(25rem,calc(100vw - 2rem));padding:.7rem;border:1px solid var(--bi-border);border-radius:.55rem;background:var(--bs-body-bg,#fff);box-shadow:0 .55rem 1.4rem rgba(0,0,0,.28)}
.block-initiative-app .bi-card-context-menu[hidden]{display:none!important}
.block-initiative-app .bi-card-context-heading{display:block;margin-bottom:.45rem}
.block-initiative-app .bi-card-context-conditions{display:block!important;width:auto!important;flex:none!important;border:0!important;padding:0!important;margin:0!important}
.block-initiative-app .bi-card-context-conditions>strong{display:none}
.block-initiative-app .bi-card-context-conditions .bi-condition-editor{display:flex;min-width:0}
.block-initiative-app .bi-card-condition-summary{flex:1 0 100%;width:100%;display:flex;flex-wrap:wrap;gap:.3rem;align-items:center}
.block-initiative-app .bi-card-condition-chip,.block-initiative-app .bi-card-context-menu .bi-condition-chip{border:1px solid transparent;border-radius:999px;padding:.14rem .5rem;font-size:.76rem;font-weight:650;line-height:1.25}
.block-initiative-app .bi-card-context-menu .bi-condition-chip{cursor:pointer}
.block-initiative-app [data-condition-tone='danger']{background:rgba(220,53,69,.16);border-color:rgba(220,53,69,.58);color:#ff8794}
.block-initiative-app [data-condition-tone='warning']{background:rgba(255,193,7,.13);border-color:rgba(255,193,7,.55);color:#ffd761}
.block-initiative-app [data-condition-tone='info']{background:rgba(13,202,240,.13);border-color:rgba(13,202,240,.5);color:#74def3}
.block-initiative-app [data-condition-tone='positive']{background:rgba(25,135,84,.16);border-color:rgba(25,135,84,.58);color:#72d69f}
.block-initiative-app [data-condition-tone='neutral']{background:var(--bi-soft);border-color:var(--bi-border);color:inherit}
.block-initiative-app.bi-stats-hidden .bi-card-context-wrap{display:none}
@media(max-width:620px){
  .block-initiative-app .bi-card-initiative{margin-left:0}
  .block-initiative-app .bi-card-context-menu{right:-.25rem}
}
`;
    documentRef.head.append(style);
}

function formatNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function signed(value: number): string {
    return `${value >= 0 ? "+" : ""}${formatNumber(value)}`;
}
