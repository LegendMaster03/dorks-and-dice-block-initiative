export type HexCrawlHandoffCombatant = {
    name: string;
    side: "players" | "enemies";
    quantity: number;
    initiativeModifier: number | null;
    rulesCoreConceptKey: string | null;
};

export type HexCrawlEncounterHandoff = {
    version: 1;
    sourceTool: "hex-crawl";
    expeditionId: string;
    expeditionName: string;
    contextName: string;
    overworldId: string | null;
    returnPath: string | null;
    watchNumber: number;
    day: number;
    outcome: string;
    summary: string;
    note: string | null;
    occursAtHours: number | null;
    hex: { q: number; r: number } | null;
    locationId: string | null;
    locationName: string | null;
    combatants: HexCrawlHandoffCombatant[];
};

const maxPayloadLength = 24_000;
const maxCombatants = 100;

export function parseHexCrawlHandoff(search: string): HexCrawlEncounterHandoff | null {
    const raw = new URLSearchParams(search).get("hexEncounter");
    if (raw === null) return null;
    if (raw.length === 0 || raw.length > maxPayloadLength) {
        throw new Error("The Hex Crawl encounter handoff is empty or too large.");
    }

    let value: unknown;
    try {
        value = JSON.parse(raw);
    } catch {
        throw new Error("The Hex Crawl encounter handoff is not valid JSON.");
    }
    if (!isRecord(value)
        || value.version !== 1
        || value.sourceTool !== "hex-crawl") {
        throw new Error("The Hex Crawl encounter handoff uses an unsupported format.");
    }

    const combatantsRaw = Array.isArray(value.combatants) ? value.combatants : [];
    if (combatantsRaw.length > maxCombatants) {
        throw new Error("The Hex Crawl encounter handoff contains too many combatants.");
    }

    return {
        version: 1,
        sourceTool: "hex-crawl",
        expeditionId: text(value.expeditionId, "expedition id"),
        expeditionName: text(value.expeditionName, "expedition name"),
        contextName: text(value.contextName, "context name"),
        overworldId: nullableText(value.overworldId),
        returnPath: safeReturnPath(value.returnPath),
        watchNumber: positiveInteger(value.watchNumber, "watch number"),
        day: positiveInteger(value.day, "day"),
        outcome: text(value.outcome, "outcome"),
        summary: text(value.summary, "summary", 1000),
        note: nullableText(value.note, 1000),
        occursAtHours: nullableFinite(value.occursAtHours),
        hex: parseHex(value.hex),
        locationId: nullableText(value.locationId),
        locationName: nullableText(value.locationName),
        combatants: combatantsRaw.map(parseCombatant)
    };
}

export function consumeHexCrawlHandoffUrl(url: URL): string {
    const next = new URL(url.toString());
    next.searchParams.delete("hexEncounter");
    return `${next.pathname}${next.search}${next.hash}`;
}

function parseCombatant(value: unknown): HexCrawlHandoffCombatant {
    if (!isRecord(value)) throw new Error("A Hex Crawl handoff combatant is invalid.");
    const side = value.side === "players" || value.side === "enemies"
        ? value.side
        : null;
    if (!side) throw new Error("A Hex Crawl handoff combatant has an unsupported side.");
    const quantity = value.quantity === undefined
        ? 1
        : positiveInteger(value.quantity, "combatant quantity");
    if (quantity > 50) throw new Error("A Hex Crawl handoff combatant quantity is too large.");
    return {
        name: text(value.name, "combatant name"),
        side,
        quantity,
        initiativeModifier: nullableFinite(value.initiativeModifier),
        rulesCoreConceptKey: nullableText(value.rulesCoreConceptKey)
    };
}

function parseHex(value: unknown): { q: number; r: number } | null {
    if (value === null || value === undefined) return null;
    if (!isRecord(value)
        || !Number.isInteger(value.q)
        || !Number.isInteger(value.r)) {
        throw new Error("The Hex Crawl encounter handoff has an invalid hex coordinate.");
    }
    return { q: value.q as number, r: value.r as number };
}

function safeReturnPath(value: unknown): string | null {
    const path = nullableText(value);
    return path?.startsWith("/tools/hex-crawl") ? path : null;
}

function text(value: unknown, label: string, max = 300): string {
    if (typeof value !== "string") throw new Error(`The Hex Crawl encounter handoff is missing ${label}.`);
    const normalized = value.trim();
    if (!normalized || normalized.length > max) throw new Error(`The Hex Crawl encounter handoff has an invalid ${label}.`);
    return normalized;
}

function nullableText(value: unknown, max = 300): string | null {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value !== "string") throw new Error("The Hex Crawl encounter handoff contains invalid text.");
    const normalized = value.trim();
    if (normalized.length > max) throw new Error("The Hex Crawl encounter handoff contains text that is too long.");
    return normalized || null;
}

function positiveInteger(value: unknown, label: string): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
        throw new Error(`The Hex Crawl encounter handoff has an invalid ${label}.`);
    }
    return value;
}

function nullableFinite(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error("The Hex Crawl encounter handoff contains an invalid number.");
    }
    return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
