import { chooseHealthEditor } from "./encounter-card-model.js";

/**
 * Owns direct-child composition for encounter runner cards.
 *
 * Feature modules may render content, but they mount it through this module's
 * named slots instead of inserting or reordering runner-card children
 * themselves. Cards are reused by combatant ID so stateful controls and event
 * handlers survive turn and block changes.
 */
export type EncounterCardSlot =
    | "identity"
    | "initiative"
    | "acted"
    | "context"
    | "metrics"
    | "condition-summary"
    | "quick-stats"
    | "state";

const slotOrder: readonly EncounterCardSlot[] = [
    "identity",
    "initiative",
    "acted",
    "context",
    "metrics",
    "condition-summary",
    "quick-stats",
    "state"
];

const slotOrderByName = new Map(slotOrder.map((slot, index) => [slot, index]));

export function mountEncounterCardSlot(
    card: HTMLElement,
    slot: EncounterCardSlot,
    element: HTMLElement
): void {
    for (const existing of directCardSlots(card)) {
        if (existing !== element && existing.dataset.cardSlot === slot) existing.remove();
    }

    element.dataset.cardSlot = slot;
    if (element.parentElement !== card) card.append(element);
    orderEncounterCardSlots(card);
}

export function orderEncounterCardSlots(card: HTMLElement): void {
    const ordered = directCardSlots(card)
        .sort((left, right) =>
            slotOrderIndex(left.dataset.cardSlot) - slotOrderIndex(right.dataset.cardSlot));

    for (const element of ordered) card.append(element);
}

function directCardSlots(card: HTMLElement): HTMLElement[] {
    return Array.from(card.children)
        .filter((child): child is HTMLElement =>
            child instanceof HTMLElement && Boolean(child.dataset.cardSlot));
}

function slotOrderIndex(value: string | undefined): number {
    if (!value) return Number.MAX_SAFE_INTEGER;
    return slotOrderByName.get(value as EncounterCardSlot) ?? Number.MAX_SAFE_INTEGER;
}


export type EncounterCardIdentity = {
    id: string;
    name: string;
    meta: readonly string[];
};

export function collectEncounterCards(scope: ParentNode): Map<string, HTMLElement> {
    const cards = new Map<string, HTMLElement>();
    for (const card of scope.querySelectorAll<HTMLElement>(".bi-runner-member[data-combatant-id]")) {
        const id = card.dataset.combatantId;
        if (id && !cards.has(id)) cards.set(id, card);
    }
    return cards;
}

export function renderEncounterCard(
    existing: HTMLElement | undefined,
    identity: EncounterCardIdentity
): HTMLElement {
    const card = existing ?? document.createElement("article");
    card.classList.add("bi-runner-member", "bi-row");
    card.dataset.combatantId = identity.id;

    let identitySlot = card.querySelector<HTMLElement>(":scope > [data-card-slot='identity']");
    if (!identitySlot) {
        identitySlot = document.createElement("div");
        identitySlot.className = "bi-runner-member-identity";
    }
    identitySlot.replaceChildren();

    const name = document.createElement("strong");
    name.textContent = identity.name;
    identitySlot.append(name);

    const labels = identity.meta.filter(Boolean);
    if (labels.length) {
        const meta = document.createElement("span");
        meta.className = "bi-muted";
        meta.textContent = labels.join(" · ");
        identitySlot.append(meta);
    }

    mountEncounterCardSlot(card, "identity", identitySlot);
    return card;
}


export function mountEncounterCardState(
    card: HTMLElement,
    key: string,
    element: HTMLElement
): void {
    let slot = card.querySelector<HTMLElement>(":scope > [data-card-slot='state']");
    if (!slot) {
        slot = document.createElement("section");
        slot.className = "bi-integrated-state";
        mountEncounterCardSlot(card, "state", slot);
    }

    for (const existing of Array.from(slot.children)) {
        if (!(existing instanceof HTMLElement)) continue;
        if (existing !== element && existing.dataset.cardState === key) existing.remove();
    }

    element.dataset.cardState = key;
    if (element.parentElement !== slot) slot.append(element);
}

export function removeEncounterCardState(card: HTMLElement, key: string): void {
    const slot = card.querySelector<HTMLElement>(":scope > [data-card-slot='state']");
    slot?.querySelector<HTMLElement>(`:scope > [data-card-state='${cssEscape(key)}']`)?.remove();
    if (slot && slot.childElementCount === 0) slot.remove();
}

function cssEscape(value: string): string {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
    return value.replace(/[\\'"\]\[]/g, match => `\\${match}`);
}


export type EncounterCardMetrics = {
    speed: string | null;
    armorClass: string | null;
    touchArmorClass: string | null;
    flatFootedArmorClass: string | null;
};

export function renderEncounterCardMetrics(
    card: HTMLElement,
    metrics: EncounterCardMetrics
): void {
    const healthRow = card.querySelector<HTMLElement>(
        ":scope > [data-card-slot='state'] > [data-card-state='health']"
    );
    const metricLine = card.querySelector<HTMLElement>(
        ":scope > [data-card-slot='metrics']"
    );
    const healthEditor = resolveHealthEditor(healthRow, metricLine);

    if (!metrics.speed
        && !metrics.armorClass
        && !metrics.touchArmorClass
        && !metrics.flatFootedArmorClass
        && !healthEditor) {
        metricLine?.remove();
        if (healthRow) healthRow.hidden = false;
        return;
    }

    const layout = ensureMetricLine(metricLine);
    renderSpeed(layout.speedArea, metrics.speed);
    renderArmorClass(
        layout.metricArea,
        "flat-footed-ac",
        "Flat-Footed",
        metrics.flatFootedArmorClass);
    renderArmorClass(
        layout.metricArea,
        "touch-ac",
        "Touch",
        metrics.touchArmorClass);
    renderArmorClass(
        layout.metricArea,
        "ac",
        "AC",
        metrics.armorClass);
    renderHealth(layout.metricArea, healthRow, healthEditor);

    if (!layout.speedArea.textContent?.trim() && !layout.metricArea.childElementCount) {
        layout.metricLine.remove();
        return;
    }

    mountEncounterCardSlot(card, "metrics", layout.metricLine);
}

function resolveHealthEditor(
    healthRow: HTMLElement | null,
    metricLine: HTMLElement | null
): HTMLElement | null {
    if (!healthRow) return null;

    const rowEditor = healthRow.querySelector<HTMLElement>(":scope > .bi-hp-editor");
    const mountedEditor = metricLine?.querySelector<HTMLElement>(
        ":scope > .bi-card-secondary-right > .bi-card-secondary-health > .bi-hp-editor"
    ) ?? null;
    return chooseHealthEditor(rowEditor, mountedEditor);
}

function ensureMetricLine(existing: HTMLElement | null): {
    metricLine: HTMLElement;
    speedArea: HTMLElement;
    metricArea: HTMLElement;
} {
    const metricLine = existing ?? document.createElement("div");
    metricLine.className = "bi-card-secondary-statline";

    let speedArea = metricLine.querySelector<HTMLElement>(":scope > .bi-card-secondary-left");
    if (!speedArea) {
        speedArea = document.createElement("div");
        speedArea.className = "bi-card-secondary-left";
        metricLine.prepend(speedArea);
    }

    let metricArea = metricLine.querySelector<HTMLElement>(":scope > .bi-card-secondary-right");
    if (!metricArea) {
        metricArea = document.createElement("div");
        metricArea.className = "bi-card-secondary-right";
        metricLine.append(metricArea);
    }

    return { metricLine, speedArea, metricArea };
}

function renderSpeed(container: HTMLElement, speed: string | null): void {
    container.replaceChildren();
    if (!speed) return;

    const label = document.createElement("strong");
    label.textContent = "Speed";
    container.append(label, document.createTextNode(` ${speed}`));
}

function renderArmorClass(
    container: HTMLElement,
    stat: string,
    label: string,
    armorClass: string | null
): void {
    let armorClassMetric = container.querySelector<HTMLElement>(
        `:scope > .bi-card-secondary-stat[data-stat='${stat}']`
    );

    if (!armorClass) {
        armorClassMetric?.remove();
        return;
    }

    if (!armorClassMetric) {
        armorClassMetric = metric(label, armorClass);
        armorClassMetric.dataset.stat = stat;
        container.prepend(armorClassMetric);
        return;
    }

    armorClassMetric.querySelector<HTMLElement>(
        ":scope > strong")!.textContent = armorClass;
}
function renderHealth(
    container: HTMLElement,
    healthRow: HTMLElement | null,
    healthEditor: HTMLElement | null
): void {
    let healthMetric = container.querySelector<HTMLElement>(
        ":scope > .bi-card-secondary-health"
    );

    if (!healthEditor) {
        healthMetric?.remove();
        if (healthRow) healthRow.hidden = false;
        return;
    }

    if (!healthMetric) {
        healthMetric = document.createElement("div");
        healthMetric.className = "bi-card-secondary-health";

        const label = document.createElement("span");
        label.className = "bi-card-secondary-health-label";
        label.textContent = "HP";
        healthMetric.append(label);
        container.append(healthMetric);
    }

    for (const staleEditor of Array.from(
        healthMetric.querySelectorAll<HTMLElement>(":scope > .bi-hp-editor")
    )) {
        if (staleEditor !== healthEditor) staleEditor.remove();
    }

    const label = healthMetric.querySelector<HTMLElement>(
        ":scope > .bi-card-secondary-health-label"
    );
    if (healthEditor.parentElement !== healthMetric) {
        label
            ? healthMetric.insertBefore(healthEditor, label)
            : healthMetric.prepend(healthEditor);
    }

    if (healthRow) healthRow.hidden = true;
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
