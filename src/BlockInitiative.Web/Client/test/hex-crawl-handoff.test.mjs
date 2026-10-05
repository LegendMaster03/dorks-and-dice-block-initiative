import assert from "node:assert/strict";
import test from "node:test";
import {
    consumeHexCrawlHandoffUrl,
    hexCrawlHandoffStoragePrefix,
    parseHexCrawlHandoff
} from "../.test-dist/integrations/hex-crawl-handoff.js";

const handoffId = "0e953165-42ca-48b5-9a74-d834ddfbcd73";

function payload(overrides = {}) {
    return {
        version: 2,
        sourceTool: "hex-crawl",
        identity: {
            handoffId,
            encounterOccurrenceId: "runtime:30",
            expeditionId: "ef8ec6ef-41f9-47de-b9d1-3ed6e23f0867",
            expeditionName: "Humblewood expedition"
        },
        returnContext: {
            returnPath: "/tools/hex-crawl/expeditions/ef8ec6ef-41f9-47de-b9d1-3ed6e23f0867"
        },
        timeContext: {
            day: 1,
            watchNumber: 3,
            expeditionElapsedHours: 10
        },
        worldContext: {
            overworldId: "1da3a793-6b85-4472-b006-28969a60f5a2",
            hex: { q: 2, r: -1 },
            location: null
        },
        encounter: {
            outcome: "WanderingEncounter",
            summary: "WanderingEncounter: owlbear patrol",
            dmNote: "owlbear patrol"
        },
        combatants: [{
            name: "Owlbear",
            side: "enemies",
            quantity: 2,
            initiativeModifier: 1,
            rulesCoreConceptKey: "monster:owlbear"
        }],
        circumstances: [],
        effects: [],
        resources: [],
        journeyProvenance: null,
        linkedScenes: [],
        ...overrides
    };
}

function staged(value = payload(), requestedId = handoffId) {
    const entries = new Map([
        [`${hexCrawlHandoffStoragePrefix}${requestedId}`, JSON.stringify(value)]
    ]);
    return {
        search: "?" + new URLSearchParams({ hexEncounterId: requestedId }).toString(),
        storage: {
            getItem: key => entries.get(key) ?? null,
            removeItem: key => entries.delete(key)
        },
        entries
    };
}

test("parses and consumes a bounded version 2 Hex Crawl encounter handoff", () => {
    const transport = staged();
    const handoff = parseHexCrawlHandoff(transport.search, transport.storage);

    assert.equal(handoff.version, 2);
    assert.equal(handoff.sourceTool, "hex-crawl");
    assert.equal(handoff.identity.handoffId, handoffId);
    assert.equal(handoff.identity.encounterOccurrenceId, "runtime:30");
    assert.equal(handoff.timeContext.watchNumber, 3);
    assert.deepEqual(handoff.worldContext.hex, { q: 2, r: -1 });
    assert.equal(handoff.combatants[0].quantity, 2);
    assert.equal(transport.entries.size, 0);
});

test("preserves structured journey context without parsing encounter prose", () => {
    const journey = payload({
        identity: {
            handoffId,
            encounterOccurrenceId: "journey-event:ea2c99d9-64df-407c-8e0b-a5789013cfd7",
            expeditionId: "ef8ec6ef-41f9-47de-b9d1-3ed6e23f0867",
            expeditionName: "Humblewood expedition"
        },
        timeContext: { day: 2, watchNumber: null, expeditionElapsedHours: 31 },
        worldContext: { overworldId: null, hex: null, location: null },
        encounter: { outcome: "JourneyEvent", summary: "crossing complication", dmNote: null },
        circumstances: [{
            consequenceId: "a51fcf44-a0f1-459d-b988-bf076f587a1f",
            consequenceKey: "ambush",
            circumstanceKey: "surprised",
            value: "party",
            target: { scope: "Party", targetId: null },
            provenance: {
                sourceKind: "JourneyEvent",
                sourceKey: "crossing-event",
                sourceReference: null,
                providerName: null,
                note: null
            }
        }],
        journeyProvenance: {
            eventOccurrenceId: "ea2c99d9-64df-407c-8e0b-a5789013cfd7",
            processId: "51b06820-626d-4810-adfd-0a36f6b80df3",
            processKey: "road-to-refuge",
            destinationReference: "refuge-A",
            routeReference: "route-A",
            locationReference: "crossing-A",
            stageKey: "crossing",
            eventKey: "ambush",
            eventType: "encounter",
            triggerReference: "river-crossing",
            provenance: {
                sourceKind: "JourneyEvent",
                sourceKey: "crossing-event",
                sourceReference: null,
                providerName: null,
                note: null
            }
        }
    });
    const transport = staged(journey);

    const handoff = parseHexCrawlHandoff(transport.search, transport.storage);
    assert.equal(handoff.encounter.summary, "crossing complication");
    assert.equal(handoff.circumstances[0].circumstanceKey, "surprised");
    assert.equal(handoff.journeyProvenance.eventKey, "ambush");
    assert.equal(handoff.journeyProvenance.destinationReference, "refuge-A");
    assert.equal(handoff.journeyProvenance.routeReference, "route-A");
    assert.equal(handoff.journeyProvenance.locationReference, "crossing-A");
    assert.equal(handoff.worldContext.hex, null);
});

test("rejects retired, missing, mismatched, or malformed staged handoffs", () => {
    const retired = staged({ version: 1, sourceTool: "hex-crawl" });
    assert.throws(() => parseHexCrawlHandoff(retired.search, retired.storage), /unsupported format/);
    assert.equal(retired.entries.size, 0);

    const missing = staged();
    missing.entries.clear();
    assert.throws(() => parseHexCrawlHandoff(missing.search, missing.storage), /no longer available/);

    const malformed = staged(payload({
        identity: {
            handoffId: "not-a-guid",
            encounterOccurrenceId: "runtime:30",
            expeditionId: "ef8ec6ef-41f9-47de-b9d1-3ed6e23f0867",
            expeditionName: "Humblewood expedition"
        }
    }));
    assert.throws(() => parseHexCrawlHandoff(malformed.search, malformed.storage), /invalid handoff id/);

    const otherId = "772a8df2-f7fb-4665-87ed-f9bb18ae0dc9";
    const mismatched = staged(payload(), otherId);
    assert.throws(() => parseHexCrawlHandoff(mismatched.search, mismatched.storage), /identity does not match/);
});

test("strips only the consumed handoff id from the destination URL", () => {
    const clean = consumeHexCrawlHandoffUrl(new URL(
        `https://example.test/tools/block-initiative?hexEncounterId=${handoffId}&other=1#top`));
    assert.equal(clean, "/tools/block-initiative?other=1#top");
});

test("drops an unsafe return path while retaining the handoff", () => {
    const transport = staged(payload({
        returnContext: { returnPath: "//evil.example/hex-crawl" }
    }));
    const handoff = parseHexCrawlHandoff(transport.search, transport.storage);

    assert.equal(handoff.returnContext.returnPath, null);
});
