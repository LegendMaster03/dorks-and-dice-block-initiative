import { registerAfterRender } from "./render-lifecycle";

let initialized = false;

export function initializeCombatStatsCollapseUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    registerAfterRender("combat-stats-collapse-default", 121, () => {
        for (const details of root.querySelectorAll<HTMLDetailsElement>("details[data-quick-stats-setup]")) {
            if (details.dataset.defaultCollapseApplied === "true") continue;
            details.open = false;
            details.dataset.defaultCollapseApplied = "true";
        }

        placeSetupConditions(root);
    });
}

function placeSetupConditions(root: HTMLElement): void {
    for (const card of root.querySelectorAll<HTMLElement>(".bi-entry[data-id]")) {
        const marker = card.querySelector<HTMLElement>(":scope > [data-condition-setup-placeholder]");
        const strips = Array.from(card.querySelectorAll<HTMLElement>(".bi-condition-setup"))
            .filter(strip => strip.dataset.conditionSetupPlaceholder !== "true");

        if (!strips.length) {
            marker?.remove();
            continue;
        }

        const strip = strips.find(candidate => candidate.querySelector("[data-condition-editor-for]")) ?? strips[0];
        for (const duplicate of strips) {
            if (duplicate !== strip) duplicate.remove();
        }

        const statsBody = card.querySelector<HTMLElement>(
            ":scope > details[data-quick-stats-setup] > .bi-quick-stats-setup-body"
        );
        if (statsBody) {
            if (strip.parentElement !== statsBody) statsBody.append(strip);
            ensureSetupPlaceholder(card);
            continue;
        }

        // Player cards intentionally do not expose monster combat-stat fields.
        // Keep their uncommon starting-condition controls collapsed with the
        // existing advanced options rather than leaving them always visible.
        const advanced = Array.from(card.querySelectorAll<HTMLDetailsElement>(":scope > details"))
            .find(details => details.querySelector(":scope > summary")?.textContent?.trim() === "Advanced options");
        if (advanced) {
            if (strip.parentElement !== advanced) advanced.append(strip);
            ensureSetupPlaceholder(card);
        }
    }
}

function ensureSetupPlaceholder(card: HTMLElement): void {
    if (card.querySelector(":scope > [data-condition-setup-placeholder]")) return;

    // condition-tracking-ui currently checks for a direct setup strip before
    // creating one. Keep a hidden direct marker after moving the real editor
    // into a collapsed details panel so later render passes do not duplicate it.
    const marker = document.createElement("span");
    marker.className = "bi-condition-setup";
    marker.dataset.conditionSetupPlaceholder = "true";
    marker.hidden = true;
    marker.style.display = "none";
    card.append(marker);
}
