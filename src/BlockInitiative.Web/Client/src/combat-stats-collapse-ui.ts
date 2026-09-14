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
    });
}
