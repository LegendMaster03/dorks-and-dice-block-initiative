export type HexCrawlHandoffCombatant = {
    name: string;
    side: "players" | "enemies";
    quantity: number;
    initiativeModifier: number | null;
    rulesCoreConceptKey: string | null;
};

export type HexCrawlHandoffTarget = {
    scope: string;
    targetId: string | null;
};

export type HexCrawlHandoffProvenance = {
    sourceKind: string;
    sourceKey: string;
    sourceReference: string | null;
    providerName: string | null;
    note: string | null;
};

export type HexCrawlHandoffCircumstance = {
    consequenceId: string;
    consequenceKey: string;
    circumstanceKey: string;
    value: string | null;
    target: HexCrawlHandoffTarget;
    provenance: HexCrawlHandoffProvenance;
};

export type HexCrawlHandoffEffect = {
    id: string;
    effectKey: string;
    target: HexCrawlHandoffTarget;
    level: number | null;
    magnitude: number | null;
    unit: string | null;
    state: string | null;
    sourceConsequenceIds: string[];
};

export type HexCrawlHandoffResource = {
    id: string;
    resourceKey: string;
    target: HexCrawlHandoffTarget;
    inventoryModel: string;
    isDepleted: boolean;
    quantity: number | null;
    unit: string | null;
    symbolicState: string | null;
    supplyDieSides: number | null;
};

export type HexCrawlHandoffJourneyProvenance = {
    eventOccurrenceId: string;
    processId: string | null;
    processKey: string | null;
    destinationReference: string | null;
    routeReference: string | null;
    locationReference: string | null;
    stageKey: string | null;
    eventKey: string;
    eventType: string | null;
    triggerReference: string;
    provenance: HexCrawlHandoffProvenance;
};

export type HexCrawlHandoffLinkedScene = {
    id: string;
    kind: string;
    referenceKey: string;
};

export type HexCrawlEncounterHandoff = {
    version: 2;
    sourceTool: "hex-crawl";
    identity: {
        handoffId: string;
        encounterOccurrenceId: string;
        expeditionId: string;
        expeditionName: string;
    };
    returnContext: {
        returnPath: string | null;
    };
    timeContext: {
        day: number;
        watchNumber: number | null;
        expeditionElapsedHours: number;
    };
    worldContext: {
        overworldId: string | null;
        hex: { q: number; r: number } | null;
        location: { id: string; name: string; category: string } | null;
    };
    encounter: {
        outcome: string;
        summary: string;
        dmNote: string | null;
    };
    combatants: HexCrawlHandoffCombatant[];
    circumstances: HexCrawlHandoffCircumstance[];
    effects: HexCrawlHandoffEffect[];
    resources: HexCrawlHandoffResource[];
    journeyProvenance: HexCrawlHandoffJourneyProvenance | null;
    linkedScenes: HexCrawlHandoffLinkedScene[];
};

export interface HexCrawlHandoffStorage {
    getItem(key: string): string | null;
    removeItem(key: string): void;
}

export const hexCrawlHandoffStoragePrefix = "dorks-and-dice:hex-encounter-handoff:";

const maxPayloadLength = 48_000;
const maxCombatants = 100;
const maxContextItems = 50;
const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseHexCrawlHandoff(
    search: string,
    storage: HexCrawlHandoffStorage = window.sessionStorage): HexCrawlEncounterHandoff | null {
    const requestedIdRaw = new URLSearchParams(search).get("hexEncounterId");
    if (requestedIdRaw === null) return null;
    const requestedId = guid(requestedIdRaw, "handoff id");
    const key = `${hexCrawlHandoffStoragePrefix}${requestedId}`;
    const raw = storage.getItem(key);
    if (raw === null) {
        throw new Error("The Hex Crawl encounter handoff is no longer available in this browser tab.");
    }

    // The handoff is single-consumption transport state. Remove it before parsing so malformed
    // or unsupported payloads can not be replayed indefinitely by refreshing the destination.
    storage.removeItem(key);
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
        || value.version !== 2
        || value.sourceTool !== "hex-crawl") {
        throw new Error("The Hex Crawl encounter handoff uses an unsupported format.");
    }

    const identity = record(value.identity, "identity");
    const returnContext = record(value.returnContext, "return context");
    const timeContext = record(value.timeContext, "time context");
    const worldContext = record(value.worldContext, "world context");
    const encounter = record(value.encounter, "encounter");
    const parsedId = guid(identity.handoffId, "handoff id");
    if (parsedId.toLowerCase() !== requestedId.toLowerCase()) {
        throw new Error("The Hex Crawl encounter handoff identity does not match the requested handoff.");
    }

    return {
        version: 2,
        sourceTool: "hex-crawl",
        identity: {
            handoffId: parsedId,
            encounterOccurrenceId: text(identity.encounterOccurrenceId, "encounter occurrence id"),
            expeditionId: guid(identity.expeditionId, "expedition id"),
            expeditionName: text(identity.expeditionName, "expedition name")
        },
        returnContext: {
            returnPath: safeReturnPath(returnContext.returnPath)
        },
        timeContext: {
            day: positiveInteger(timeContext.day, "day"),
            watchNumber: nullablePositiveInteger(timeContext.watchNumber, "watch number"),
            expeditionElapsedHours: nonNegativeFinite(timeContext.expeditionElapsedHours, "expedition elapsed hours")
        },
        worldContext: {
            overworldId: nullableGuid(worldContext.overworldId, "overworld id"),
            hex: parseHex(worldContext.hex),
            location: parseLocation(worldContext.location)
        },
        encounter: {
            outcome: text(encounter.outcome, "encounter outcome"),
            summary: text(encounter.summary, "encounter summary", 2000),
            dmNote: nullableText(encounter.dmNote, 2000)
        },
        combatants: boundedArray(value.combatants, maxCombatants, "combatants").map(parseCombatant),
        circumstances: boundedArray(value.circumstances, maxContextItems, "encounter circumstances").map(parseCircumstance),
        effects: boundedArray(value.effects, maxContextItems, "encounter effects").map(parseEffect),
        resources: boundedArray(value.resources, maxContextItems, "encounter resources").map(parseResource),
        journeyProvenance: parseJourneyProvenance(value.journeyProvenance),
        linkedScenes: boundedArray(value.linkedScenes, maxContextItems, "linked encounter scenes").map(parseLinkedScene)
    };
}

export function consumeHexCrawlHandoffUrl(url: URL): string {
    const next = new URL(url.toString());
    next.searchParams.delete("hexEncounterId");
    return `${next.pathname}${next.search}${next.hash}`;
}

function parseCombatant(value: unknown): HexCrawlHandoffCombatant {
    const item = record(value, "combatant");
    const side = item.side === "players" || item.side === "enemies"
        ? item.side
        : null;
    if (!side) throw new Error("A Hex Crawl handoff combatant has an unsupported side.");
    const quantity = item.quantity === undefined
        ? 1
        : positiveInteger(item.quantity, "combatant quantity");
    if (quantity > 50) throw new Error("A Hex Crawl handoff combatant quantity is too large.");
    return {
        name: text(item.name, "combatant name"),
        side,
        quantity,
        initiativeModifier: nullableFinite(item.initiativeModifier),
        rulesCoreConceptKey: nullableText(item.rulesCoreConceptKey)
    };
}

function parseCircumstance(value: unknown): HexCrawlHandoffCircumstance {
    const item = record(value, "encounter circumstance");
    return {
        consequenceId: guid(item.consequenceId, "consequence id"),
        consequenceKey: text(item.consequenceKey, "consequence key"),
        circumstanceKey: text(item.circumstanceKey, "circumstance key"),
        value: nullableText(item.value, 1000),
        target: parseTarget(item.target),
        provenance: parseProvenance(item.provenance)
    };
}

function parseEffect(value: unknown): HexCrawlHandoffEffect {
    const item = record(value, "encounter effect");
    return {
        id: guid(item.id, "effect id"),
        effectKey: text(item.effectKey, "effect key"),
        target: parseTarget(item.target),
        level: nullableInteger(item.level, "effect level"),
        magnitude: nullableFinite(item.magnitude),
        unit: nullableText(item.unit),
        state: nullableText(item.state),
        sourceConsequenceIds: boundedArray(item.sourceConsequenceIds, maxContextItems, "effect source consequence ids")
            .map(source => guid(source, "source consequence id"))
    };
}

function parseResource(value: unknown): HexCrawlHandoffResource {
    const item = record(value, "encounter resource");
    if (typeof item.isDepleted !== "boolean") {
        throw new Error("The Hex Crawl encounter handoff contains an invalid resource depletion state.");
    }
    return {
        id: guid(item.id, "resource id"),
        resourceKey: text(item.resourceKey, "resource key"),
        target: parseTarget(item.target),
        inventoryModel: text(item.inventoryModel, "resource inventory model"),
        isDepleted: item.isDepleted,
        quantity: nullableFinite(item.quantity),
        unit: nullableText(item.unit),
        symbolicState: nullableText(item.symbolicState),
        supplyDieSides: nullablePositiveInteger(item.supplyDieSides, "resource supply die sides")
    };
}

function parseJourneyProvenance(value: unknown): HexCrawlHandoffJourneyProvenance | null {
    if (value === null || value === undefined) return null;
    const item = record(value, "journey provenance");
    return {
        eventOccurrenceId: guid(item.eventOccurrenceId, "journey event occurrence id"),
        processId: nullableGuid(item.processId, "journey process id"),
        processKey: nullableText(item.processKey),
        destinationReference: nullableText(item.destinationReference, 1000),
        routeReference: nullableText(item.routeReference, 1000),
        locationReference: nullableText(item.locationReference, 1000),
        stageKey: nullableText(item.stageKey),
        eventKey: text(item.eventKey, "journey event key"),
        eventType: nullableText(item.eventType),
        triggerReference: text(item.triggerReference, "journey trigger reference", 1000),
        provenance: parseProvenance(item.provenance)
    };
}

function parseLinkedScene(value: unknown): HexCrawlHandoffLinkedScene {
    const item = record(value, "linked encounter scene");
    return {
        id: guid(item.id, "linked scene id"),
        kind: text(item.kind, "linked scene kind"),
        referenceKey: text(item.referenceKey, "linked scene reference key", 1000)
    };
}

function parseTarget(value: unknown): HexCrawlHandoffTarget {
    const item = record(value, "target");
    return {
        scope: text(item.scope, "target scope"),
        targetId: nullableGuid(item.targetId, "target id")
    };
}

function parseProvenance(value: unknown): HexCrawlHandoffProvenance {
    const item = record(value, "provenance");
    return {
        sourceKind: text(item.sourceKind, "provenance source kind"),
        sourceKey: text(item.sourceKey, "provenance source key", 1000),
        sourceReference: nullableText(item.sourceReference, 1000),
        providerName: nullableText(item.providerName),
        note: nullableText(item.note, 2000)
    };
}

function parseHex(value: unknown): { q: number; r: number } | null {
    if (value === null || value === undefined) return null;
    const item = record(value, "hex coordinate");
    if (!Number.isInteger(item.q) || !Number.isInteger(item.r)) {
        throw new Error("The Hex Crawl encounter handoff has an invalid hex coordinate.");
    }
    return { q: item.q as number, r: item.r as number };
}

function parseLocation(value: unknown): { id: string; name: string; category: string } | null {
    if (value === null || value === undefined) return null;
    const item = record(value, "location");
    return {
        id: guid(item.id, "location id"),
        name: text(item.name, "location name"),
        category: text(item.category, "location category")
    };
}

function safeReturnPath(value: unknown): string | null {
    const path = nullableText(value, 2048);
    if (path === null) return null;
    if (path.includes("\\") || path.includes("\r") || path.includes("\n")
        || !path.startsWith("/") || path.startsWith("//")) {
        return null;
    }
    const pathOnly = path.split(/[?#]/, 1)[0];
    return pathOnly === "/tools/hex-crawl" || pathOnly.startsWith("/tools/hex-crawl/")
        ? path
        : null;
}

function boundedArray(value: unknown, max: number, label: string): unknown[] {
    if (!Array.isArray(value)) throw new Error(`The Hex Crawl encounter handoff is missing ${label}.`);
    if (value.length > max) throw new Error(`The Hex Crawl encounter handoff contains too many ${label}.`);
    return value;
}

function record(value: unknown, label: string): Record<string, unknown> {
    if (!isRecord(value)) throw new Error(`The Hex Crawl encounter handoff has an invalid ${label}.`);
    return value;
}

function guid(value: unknown, label: string): string {
    const result = text(value, label, 36);
    if (!guidPattern.test(result)) throw new Error(`The Hex Crawl encounter handoff has an invalid ${label}.`);
    return result;
}

function nullableGuid(value: unknown, label: string): string | null {
    if (value === null || value === undefined || value === "") return null;
    return guid(value, label);
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

function nullablePositiveInteger(value: unknown, label: string): number | null {
    if (value === null || value === undefined) return null;
    return positiveInteger(value, label);
}

function nullableInteger(value: unknown, label: string): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== "number" || !Number.isInteger(value)) {
        throw new Error(`The Hex Crawl encounter handoff has an invalid ${label}.`);
    }
    return value;
}

function nonNegativeFinite(value: unknown, label: string): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
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
