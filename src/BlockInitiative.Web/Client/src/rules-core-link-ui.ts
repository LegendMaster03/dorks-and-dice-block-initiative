type RuleBrowserLink = {
    toolSlug: string;
    toolRelativePath: string;
    routeIdentity: string;
};

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
    browserLink: RuleBrowserLink;
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
let scheduled = false;

export function initializeRulesCoreLinkUi(): void {
    window.addEventListener("block-initiative:rules-core-template-link", event => {
        const detail = (event as TemplateLinkEvent).detail;
        const href = toHostedToolHref(detail?.browserLink);
        if (!detail?.templateId || !href) return;
        templateLinks.set(detail.templateId, href);
        scheduleDecorate();
    });

    window.addEventListener("block-initiative:preview", event => {
        lastPreview = (event as PreviewEvent).detail?.response ?? null;
        scheduleDecorate();
    });

    window.addEventListener("block-initiative:state", event => {
        lastState = (event as StateEvent).detail?.response ?? null;
        scheduleDecorate();
    });

    const observer = new MutationObserver(() => scheduleDecorate());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    scheduleDecorate();
}

function scheduleDecorate(): void {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
        scheduled = false;
        decorateCombatantNames();
    });
}

function decorateCombatantNames(): void {
    const linksByCombatant = collectCombatantLinks();
    if (!linksByCombatant.size) return;

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
    if (!href) return;

    const existing = container.querySelector<HTMLAnchorElement>(":scope > a[data-rules-core-link]");
    if (existing) {
        existing.href = href;
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

function toHostedToolHref(link: RuleBrowserLink | null | undefined): string | null {
    const slug = link?.toolSlug?.trim();
    const relativePath = link?.toolRelativePath?.trim();
    if (!slug || !relativePath || !relativePath.startsWith("/")) return null;
    return `/tools/${encodeURIComponent(slug)}${relativePath}`;
}
