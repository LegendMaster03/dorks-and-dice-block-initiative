export function record(
    value: unknown
): Record<string, unknown> | null {
    return typeof value === "object"
        && value !== null
        && !Array.isArray(value)
            ? value as Record<string, unknown>
            : null;
}

export function stringOrEmpty(
    value: unknown
): string {
    return typeof value === "string"
        ? value
        : "";
}

export function nullableString(
    value: unknown
): string | null {
    return typeof value === "string"
        ? value
        : null;
}

export function isNullableString(
    value: unknown
): value is string | null {
    return value === null
        || typeof value === "string";
}

export function positiveInteger(
    value: unknown
): value is number {
    return typeof value === "number"
        && Number.isInteger(value)
        && value >= 1;
}

export function nonNegativeInteger(
    value: unknown
): number {
    return typeof value === "number"
        && Number.isInteger(value)
        && value >= 0
            ? value
            : 0;
}

export function nullablePositiveInteger(
    value: unknown
): number | null {
    return positiveInteger(value)
        ? value
        : null;
}

export function stringArray(
    value: unknown
): string[] | null {
    if (!Array.isArray(value)
        || value.some(
            item => typeof item !== "string")) {
        return null;
    }

    return [...value] as string[];
}

export function normalizeList<T>(
    value: unknown[],
    normalize: (item: unknown) => T | null
): T[] | null {
    const result: T[] = [];
    for (const item of value) {
        const normalized = normalize(item);
        if (!normalized) return null;
        result.push(normalized);
    }
    return result;
}

export function normalizeListOrEmpty<T>(
    value: unknown,
    normalize: (item: unknown) => T | null
): T[] {
    if (!Array.isArray(value)) return [];

    return value.flatMap(item => {
        const normalized = normalize(item);
        return normalized ? [normalized] : [];
    });
}
