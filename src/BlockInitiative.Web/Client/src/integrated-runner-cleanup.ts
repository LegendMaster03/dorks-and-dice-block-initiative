import { registerAfterRender } from "./render-lifecycle";

let initialized = false;

export function initializeIntegratedRunnerCleanupUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    // Combat-state refreshes rebuild their dashboard. The card runner moves the
    // newly rendered controls onto combatant cards; keep only that newest copy.
    registerAfterRender("integrated-runner-cleanup", 130, () => cleanup(root));
}

function cleanup(root: HTMLElement): void {
    for (const member of root.querySelectorAll<HTMLElement>(".bi-runner-member[data-combatant-id]")) {
        const combatantId = member.dataset.combatantId;
        if (!combatantId) continue;

        removeAllButLast(member.querySelectorAll<HTMLElement>(`.bi-health-row[data-combatant-id='${cssEscape(combatantId)}']`));
        removeAllButLast(member.querySelectorAll<HTMLElement>(`.bi-kaiju-panel[data-combatant-id='${cssEscape(combatantId)}']`));
        removeAllButLast(member.querySelectorAll<HTMLElement>(`.bi-integrated-conditions [data-condition-editor-for='${cssEscape(combatantId)}']`));
    }
}

function removeAllButLast(elements: NodeListOf<HTMLElement>): void {
    if (elements.length < 2) return;
    for (let index = 0; index < elements.length - 1; index += 1) {
        elements[index].remove();
    }
}

function cssEscape(value: string): string {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
    return value.replace(/[\\'"\]\[]/g, match => `\\${match}`);
}
