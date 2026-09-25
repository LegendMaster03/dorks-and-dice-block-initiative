export type NumericLimits = Readonly<{
    min: number;
    max: number;
    integer?: boolean;
}>;

export const INITIATIVE_LIMITS: NumericLimits = {
    min: -1_000_000,
    max: 1_000_000
};

export const TRACKER_LIMITS: NumericLimits = {
    min: -1_000_000_000,
    max: 1_000_000_000,
    integer: true
};

export const NON_NEGATIVE_TRACKER_LIMITS: NumericLimits = {
    min: 0,
    max: 1_000_000_000,
    integer: true
};

export const POSITIVE_TRACKER_LIMITS: NumericLimits = {
    min: 1,
    max: 1_000_000_000,
    integer: true
};

export function applyNumberLimits(
    input: HTMLInputElement,
    limits: NumericLimits
): void {
    input.min = String(limits.min);
    input.max = String(limits.max);
    input.inputMode = limits.integer ? "numeric" : "decimal";
    if (limits.integer) input.step = "1";

    if (input.dataset.plainNumberGuard !== "true") {
        input.dataset.plainNumberGuard = "true";

        input.addEventListener("beforeinput", event => {
            if (!event.data
                || event.inputType.startsWith("delete")
                || permittedNumericInsertion(event.data, limits)) {
                return;
            }
            event.preventDefault();
        });

        input.addEventListener("keydown", event => {
            if (event.ctrlKey
                || event.metaKey
                || event.key.length !== 1
                || permittedNumericInsertion(event.key, limits)) {
                return;
            }
            event.preventDefault();
        });

        input.addEventListener("paste", event => {
            const text =
                event.clipboardData?.getData("text")
                    ?.trim()
                ?? "";
            if (text && !isPlainNumericText(text, limits)) {
                event.preventDefault();
            }
        });
    }

    input.addEventListener("input", () => {
        input.setCustomValidity(numberInputError(input.value, limits));
    });
}

export function isPlainNumericText(
    raw: string,
    limits: NumericLimits
): boolean {
    const text = raw.trim();
    if (!text) return true;

    const sign = limits.min < 0 ? "-?" : "";
    const body = limits.integer
        ? "\\d+"
        : "(?:\\d+(?:\\.\\d*)?|\\.\\d+)";

    return new RegExp(`^${sign}${body}$`).test(text);
}

function permittedNumericInsertion(
    text: string,
    limits: NumericLimits
): boolean {
    for (const character of text) {
        if (/\\d/.test(character)) continue;
        if (character === "." && !limits.integer) continue;
        if (character === "-" && limits.min < 0) continue;
        return false;
    }
    return true;
}

export function parseBoundedNumber(
    raw: string,
    limits: NumericLimits
): number | null {
    if (!raw.trim()) return null;

    const value = Number(raw);
    if (!Number.isFinite(value)
        || value < limits.min
        || value > limits.max
        || (limits.integer && !Number.isInteger(value))) {
        return null;
    }

    return value;
}

export function isBoundedNumber(
    raw: string,
    limits: NumericLimits
): boolean {
    return parseBoundedNumber(raw, limits) !== null;
}

export function numberInputError(
    raw: string,
    limits: NumericLimits
): string {
    if (!raw.trim()) return "";

    return parseBoundedNumber(raw, limits) === null
        ? `Enter a ${limits.integer ? "whole number" : "value"} between ${formatBound(limits.min)} and ${formatBound(limits.max)}.`
        : "";
}

export function describeNumberRange(
    limits: NumericLimits
): string {
    return `${formatBound(limits.min)} to ${formatBound(limits.max)}`;
}

function formatBound(value: number): string {
    return value.toLocaleString("en-US");
}
