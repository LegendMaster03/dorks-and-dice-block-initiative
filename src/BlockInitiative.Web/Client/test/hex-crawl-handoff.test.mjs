import assert from "node:assert/strict";
import test from "node:test";
import { consumeHexCrawlHandoffUrl, parseHexCrawlHandoff } from "../.test-dist/integrations/hex-crawl-handoff.js";

function payload(overrides = {}) {
    return {
        version: 2,
        sourceTool: "hex-crawl",
        identity: {
            handoffId: "0e953165-42ca-48b5-9a74-d834ddfbcd73",
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

function search(value = payload()) {
    return "?" + new URLSearchParams({ hexEncounter: JSON.stringify(value) }).toString();
}

test("parses a bounded version 2 Hex Crawl encounter handoff", () => {
    const handoff = parseHexCrawlHandoff(search());

    assert.equal(handoff.version, 2);
    assert.equal(handoff.sourceTool, "hex-crawl");
    assert.equal(handoff.identity.handoffId, "0e953165-42ca-48b5-9a74-d834ddfbcd73");
    assert.equal(handoff.identity.encounterOccurrenceId, "runtime:30");
    assert.equal(handoff.timeContext.watchNumber, 3);
    assert.deepEqual(handoff.worldContext.hex, { q: 2, r: -1 });
    assert.equal(handoff.combatants[0].quantity, 2);
});

test("preserves structured journey context without parsing encounter prose", () => {
    const journey = payload({
        identity: {
            handoffId: "0e953165-42ca-48b5-9a74-d834ddfbcd73",
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
            processId: null,
            processKey: null,
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

    const handoff = parseHexCrawlHandoff(search(journey));
    assert.equal(handoff.encounter.summary, "crossing complication");
    assert.equal(handoff.circumstances[0].circumstanceKey, "surprised");
    assert.equal(handoff.journeyProvenance.eventKey, "ambush");
    assert.equal(handoff.worldContext.hex, null);
});

test("rejects retired or malformed handoffs and strips the consumed URL parameter", () => {
    assert.throws(() => parseHexCrawlHandoff(search({ version: 1, sourceTool: "hex-crawl" })), /unsupported format/);
    assert.throws(() => parseHexCrawlHandoff(search(payload({
        identity: {
            handoffId: "not-a-guid",
            encounterOccurrenceId: "runtime:30",
            expeditionId: "ef8ec6ef-41f9-47de-b9d1-3ed6e23f0867",
            expeditionName: "Humblewood expedition"
        }
    }))), /invalid handoff id/);

    const clean = consumeHexCrawlHandoffUrl(new URL("https://example.test/tools/block-initiative?hexEncounter=x&other=1#top"));
    assert.equal(clean, "/tools/block-initiative?other=1#top");
});

test("drops an unsafe return path while retaining the handoff", () => {
    const handoff = parseHexCrawlHandoff(search(payload({
        returnContext: { returnPath: "//evil.example/hex-crawl" }
    })));

    assert.equal(handoff.returnContext.returnPath, null);
});
