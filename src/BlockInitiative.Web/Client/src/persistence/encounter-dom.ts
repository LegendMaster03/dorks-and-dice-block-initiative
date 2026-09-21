export function directCards(container: HTMLElement): HTMLElement[] {
    return Array.from(
        container.querySelectorAll<HTMLElement>(
            ":scope > .bi-entry[data-id]"));
}

export function directSection(
    panel: HTMLElement,
    heading: string
): HTMLElement | null {
    return Array.from(
        panel.querySelectorAll<HTMLElement>(":scope > section"))
        .find(section =>
            section.querySelector(":scope > strong")
                ?.textContent?.trim() === heading)
        ?? null;
}

export function inputByLabel(
    scope: HTMLElement,
    labelText: string
): HTMLInputElement | null {
    for (const field of scope.querySelectorAll<HTMLElement>(".bi-field")) {
        if (field.querySelector("label")?.textContent?.trim() !== labelText) {
            continue;
        }

        const input = field.querySelector<HTMLInputElement>("input");
        if (input) return input;
    }

    return null;
}

export function combatInput(
    scope: HTMLElement,
    fieldKey: string,
    fallbackLabel: string
): HTMLInputElement | null {
    return scope.querySelector<HTMLInputElement>(
        `[data-combat-field='${fieldKey}'] input[data-combat-field='${fieldKey}']`)
        ?? inputByLabel(scope, fallbackLabel);
}

export function runnerCard(
    root: HTMLElement,
    combatantId: string
): HTMLElement | null {
    return root.querySelector<HTMLElement>(
        `.bi-runner-member[data-combatant-id='${cssEscape(combatantId)}']`
    );
}

export function checkboxByText(
    scope: HTMLElement,
    labelText: string
): HTMLInputElement | null {
    for (const label of scope.querySelectorAll<HTMLElement>(".bi-inline-check")) {
        if (!label.textContent?.includes(labelText)) continue;

        const input =
            label.querySelector<HTMLInputElement>(
                "input[type='checkbox']");
        if (input) return input;
    }

    return null;
}

export function controlKey(
    control: HTMLInputElement | HTMLSelectElement,
    scope: HTMLElement
): string {
    const area = control.closest<HTMLElement>(".bi-area-row");
    const areas =
        Array.from(scope.querySelectorAll<HTMLElement>(".bi-area-row"));
    const areaPrefix =
        area ? `area:${areas.indexOf(area)}:` : "";

    const field =
        control.closest<HTMLElement>(".bi-field, .bi-inline-check");
    const explicit =
        field?.querySelector(":scope > label")?.textContent?.trim();
    const fallback =
        field?.textContent?.trim()
        || control.dataset.field
        || control.dataset.role
        || control.name
        || "control";
    const kind =
        control instanceof HTMLSelectElement
            ? "select"
            : control.type || "input";

    return `${areaPrefix}${explicit || fallback}|${kind}`;
}

export function cssEscape(value: string): string {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
        return CSS.escape(value);
    }

    return value.replace(/[\\'"\]\[]/g, match => `\\${match}`);
}
