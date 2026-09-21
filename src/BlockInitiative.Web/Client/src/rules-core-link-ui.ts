import { toHostedToolHref } from "./integrations/rules-core/client";
import type { RuleBrowserLink } from "./integrations/rules-core/client";
import { registerAfterRender, requestEnhancement } from "./render-lifecycle";

type PreviewResponse = {
    blocks: Array<{
        id: string;
        memberOrder: string[];
    }>;
};

type TurnStateResponse = {
    activeBlockId: string | null;
    blocks: Array<{
        id: string;
        memberOrder: string[];
    }>;
};

type TemplateLinkEvent = CustomEvent<{
    templateId: string;
    browserLink?: RuleBrowserLink | null;
}>;

type PreviewEvent = CustomEvent<{
    response: PreviewResponse;
}>;

type StateEvent = CustomEvent<{
    response: TurnStateResponse;
}>;

const templateLinks = new Map<string, string>();
let lastPreview: PreviewResponse | null = null;
let lastState: TurnStateResponse | null = null;
let initialized = false;

export function initializeRulesCoreLinkUi(): void {
    if (initialized) return;
    initialized = true;

    window.addEventListener("block-initiative:rules-core-template-link", event => {
        const detail = (event as TemplateLinkEvent).detail;
        const templateId = detail?.templateId;
        if (!templateId) return;

        const href = toHostedToolHref(detail.browserLink);
        if (href) {
            templateLinks.set(templateId, href);
        } else {
            // Older/current Rules Core responses may not provide browserLink.
            // Treat that as "no navigation enhancement" rather than an error,
            // and clear any stale link remembered for this template.
            templateLinks.delete(templateId);
        }
        requestEnhancement();
    });

    window.addEventListener("block-initiative:preview", event => {
        lastPreview = (event as PreviewEvent).detail?.response ?? null;
        requestEnhancement();
    });

    window.addEventListener("block-initiative:state", event => {
        lastState = (event as StateEvent).detail?.response ?? null;
        requestEnhancement();
    });

    registerAfterRender("rules-core-links", 110, decorateCombatantNames);
}

function decorateCombatantNames(): void {
    const linksByCombatant = collectCombatantLinks();
    decoratePreviewNames(linksByCombatant);
    decorateRunnerNames(linksByCombatant);
}

function collectCombatantLinks(): Map<string, string> {
    const result = new Map<string, string>();
    for (const card of document.querySelectorAll<HTMLElement>(".bi-entry[data-id][data-template-id]")) {
        const combatantId = card.dataset.id;
        const templateId = card.dataset.templateId;
        if (!combatantId || !templateId) continue;
        const href = templateLinks.get(templateId);
        if (href) result.set(combatantId, href);
    }
    return result;
}

function decoratePreviewNames(linksByCombatant: Map<string, string>): void {
    if (!lastPreview) return;
    const blocks = Array.from(document.querySelectorAll<HTMLElement>(".bi-block"));
    lastPreview.blocks.forEach((block, blockIndex) => {
        const blockElement = blocks[blockIndex];
        if (!blockElement) return;
        const rows = Array.from(blockElement.querySelectorAll<HTMLElement>(".bi-member"));
        block.memberOrder.forEach((combatantId, memberIndex) => {
            const row = rows[memberIndex];
            const name = row?.firstElementChild;
            if (!(name instanceof HTMLElement)) return;
            decorateName(name, linksByCombatant.get(combatantId));
        });
    });
}

function decorateRunnerNames(linksByCombatant: Map<string, string>): void {
    if (!lastState?.activeBlockId) return;
    const active = lastState.blocks.find(block => block.id === lastState!.activeBlockId);
    if (!active) return;

    const rows = Array.from(document.querySelectorAll<HTMLElement>(".bi-runner-member"));
    active.memberOrder.forEach((combatantId, memberIndex) => {
        const row = rows[memberIndex];
        const name = row?.firstElementChild;
        if (!(name instanceof HTMLElement)) return;
        decorateName(name, linksByCombatant.get(combatantId));
    });
}

function decorateName(container: HTMLElement, href: string | undefined): void {
    const existing = container.querySelector<HTMLAnchorElement>(":scope > a[data-rules-core-link]");
    if (!href) {
        if (existing) container.replaceChildren(document.createTextNode(existing.textContent ?? ""));
        return;
    }

    if (existing) {
        if (existing.getAttribute("href") !== href) existing.setAttribute("href", href);
        return;
    }

    const text = container.textContent?.trim();
    if (!text) return;

    const link = document.createElement("a");
    link.dataset.rulesCoreLink = "true";
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = "Open this combatant in Rules Core";
    link.textContent = text;
    container.replaceChildren(link);
}

