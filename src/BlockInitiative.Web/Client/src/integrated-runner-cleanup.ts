import { registerAfterRender } from "./render-lifecycle";

let initialized = false;

export function initializeIntegratedRunnerCleanupUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    installStyles(root.ownerDocument);

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

    updateRunnerHeading(root);
}

function updateRunnerHeading(root: HTMLElement): void {
    const runner = root.querySelector<HTMLElement>("[data-role='results'] > section.card.card-body.bi-grid");
    const heading = runner?.querySelector<HTMLElement>(":scope > .bi-row h3");
    if (!runner || !heading) return;

    if (!root.classList.contains("bi-show-active-block")) {
        heading.textContent = "Encounter";
        return;
    }

    const active = runner.querySelector<HTMLElement>("[data-runner-block].bi-active");
    const index = active?.dataset.blockIndex;
    heading.textContent = index === undefined ? "Encounter" : `Block ${Number(index) + 1} is active`;
}

function removeAllButLast(elements: NodeListOf<HTMLElement>): void {
    if (elements.length < 2) return;
    for (let index = 0; index < elements.length - 1; index += 1) {
        elements[index].remove();
    }
}

function installStyles(documentRef: Document): void {
    if (documentRef.head.querySelector("style[data-role='integrated-runner-polish']")) return;
    const style = documentRef.createElement("style");
    style.dataset.role = "integrated-runner-polish";
    style.textContent = `
.block-initiative-app .bi-integrated-kaiju>.bi-row h5{display:none}
`;
    documentRef.head.append(style);
}

function cssEscape(value: string): string {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
    return value.replace(/[\\'"\]\[]/g, match => `\\${match}`);
}
