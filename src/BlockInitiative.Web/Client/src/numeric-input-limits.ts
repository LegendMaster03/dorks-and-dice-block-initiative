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
    if (limits.integer) input.step = "1";
    input.addEventListener("input", () => {
        input.setCustomValidity(numberInputError(input.value, limits));
    });
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
