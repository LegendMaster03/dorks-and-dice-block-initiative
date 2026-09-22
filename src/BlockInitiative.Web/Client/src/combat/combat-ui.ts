import {
    applyNumberLimits,
    NON_NEGATIVE_TRACKER_LIMITS,
    parseBoundedNumber,
    TRACKER_LIMITS
} from "../numeric-input-limits";
import type { NumericLimits } from "../numeric-input-limits";

export type OverrideValue = "auto" | "on" | "off";

export function installCombatStateStyles(root: HTMLElement): void {
    if (root.querySelector("style[data-combat-state-style]")) return;

    const style = document.createElement("style");
    style.dataset.combatStateStyle = "true";
    style.textContent = `
.block-initiative-app .bi-combat-config{border-top:1px solid var(--bi-border);margin-top:.7rem;padding-top:.7rem}
.block-initiative-app .bi-combat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.55rem}.block-initiative-app .bi-combat-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}
.block-initiative-app .bi-area-list{display:grid;gap:.55rem;margin-top:.55rem}
.block-initiative-app .bi-health-row,.block-initiative-app .bi-area-row,.block-initiative-app .bi-kaiju-panel{border:1px solid var(--bi-border);border-radius:.55rem;padding:.65rem}.block-initiative-app .bi-health-row.active,.block-initiative-app .bi-kaiju-panel.active{border-width:2px}
.block-initiative-app .bi-combat-controls{display:flex;flex-wrap:wrap;gap:.4rem;align-items:end;margin-top:.45rem}.block-initiative-app .bi-combat-controls .bi-field{min-width:6rem;flex:1 1 7rem}
.block-initiative-app .bi-statuses{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center}.block-initiative-app .bi-status{border:1px solid currentColor;border-radius:999px;padding:.12rem .48rem;font-size:.78rem}.block-initiative-app .bi-status.strong{font-weight:700}
.block-initiative-app .bi-note{font-size:.85rem;opacity:.76}.block-initiative-app .bi-inline-check{display:flex;gap:.35rem;align-items:center;white-space:nowrap}.block-initiative-app .bi-inline-check input{width:auto}
.block-initiative-app .bi-chaos{height:.65rem;border-radius:999px;background:var(--bi-soft);overflow:hidden;margin:.35rem 0}.block-initiative-app .bi-chaos span{display:block;height:100%;background:currentColor;opacity:.55}
@media(max-width:800px){.block-initiative-app .bi-combat-grid,.block-initiative-app .bi-combat-grid.three{grid-template-columns:1fr}}
`;
    root.prepend(style);
}

export function numberField(
    labelText: string,
    value: number | null,
    setter: (value: number | null) => void,
    fieldKey?: string,
    limits: NumericLimits = TRACKER_LIMITS
): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "bi-field";
    if (fieldKey) wrap.dataset.combatField = fieldKey;

    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.type = "number";
    applyNumberLimits(input, limits);
    if (fieldKey) input.dataset.combatField = fieldKey;
    input.value = value === null ? "" : String(value);
    const sync = (reportInvalid: boolean) => {
        const parsed = readNumber(input, limits);
        if (input.value.trim() && parsed === null) {
            if (reportInvalid) {
                input.reportValidity();
            }
            return;
        }
        setter(parsed);
    };
    input.addEventListener(
        "input",
        () => sync(false));
    input.addEventListener(
        "change",
        () => sync(true));

    wrap.append(label, input);
    return wrap;
}

export function textField(
    labelText: string,
    value: string,
    setter: (value: string) => void
): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "bi-field";
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.value = value;
    input.addEventListener(
        "input",
        () => setter(input.value.trim()));
    wrap.append(label, input);
    return wrap;
}

export function overrideField(
    labelText: string,
    value: OverrideValue,
    setter: (value: OverrideValue) => void
): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "bi-field";
    const label = document.createElement("label");
    label.textContent = labelText;
    const select = document.createElement("select");
    select.add(new Option("Automatic", "auto"));
    select.add(new Option("Force active / yes", "on"));
    select.add(new Option("Force inactive / no", "off"));
    select.value = value;
    select.addEventListener("change", () => setter(select.value as OverrideValue));
    wrap.append(label, select);
    return wrap;
}

export function checkField(
    labelText: string,
    checked: boolean,
    setter: (value: boolean) => void
): HTMLElement {
    const label = document.createElement("label");
    label.className = "bi-inline-check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", () => setter(input.checked));
    label.append(input, document.createTextNode(` ${labelText}`));
    return label;
}

export function amountField(): { wrapper: HTMLElement; value: () => number } {
    const wrap = document.createElement("div");
    wrap.className = "bi-field";
    const label = document.createElement("label");
    label.textContent = "Amount";
    const input = document.createElement("input");
    input.type = "number";
    input.step = "1";
    applyNumberLimits(input, NON_NEGATIVE_TRACKER_LIMITS);
    input.placeholder = "0";
    wrap.append(label, input);
    return {
        wrapper: wrap,
        value: () => Math.max(
            0,
            readNumber(input, NON_NEGATIVE_TRACKER_LIMITS) ?? 0)
    };
}

export function actionButton(
    text: string,
    style: string,
    action: () => void
): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `btn btn-sm ${style}`;
    button.textContent = text;
    button.onclick = action;
    return button;
}

export function statusBadge(text: string, strong = false): HTMLElement {
    const span = document.createElement("span");
    span.className = `bi-status${strong ? " strong" : ""}`;
    span.textContent = text;
    return span;
}

export function overrideBool(value: OverrideValue): boolean | null {
    return value === "auto" ? null : value === "on";
}

export function readNumber(
    input: HTMLInputElement,
    limits: NumericLimits = TRACKER_LIMITS
): number | null {
    return parseBoundedNumber(input.value, limits);
}

export function findRunnerCard(
    root: HTMLElement,
    combatantId: string
): HTMLElement | null {
    return root.querySelector<HTMLElement>(
        `.bi-runner-member[data-combatant-id='${cssEscape(combatantId)}']`
    );
}

export function cssEscape(value: string): string {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
        return CSS.escape(value);
    }
    return value.replace(/[\\'"\]\[]/g, match => `\\${match}`);
}
