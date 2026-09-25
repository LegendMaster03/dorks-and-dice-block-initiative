import assert from "node:assert/strict";
import test from "node:test";
import { consumeHexCrawlHandoffUrl, parseHexCrawlHandoff } from "../.test-dist/integrations/hex-crawl-handoff.js";

function search(overrides = {}) {
    const payload = {
        version: 1,
        sourceTool: "hex-crawl",
        expeditionId: "exp-1",
        expeditionName: "Humblewood expedition",
        contextName: "Humblewood",
        overworldId: "world-1",
        returnPath: "/tools/hex-crawl/expeditions/exp-1",
        watchNumber: 3,
        day: 1,
        outcome: "WanderingEncounter",
        summary: "WanderingEncounter: owlbear patrol",
        note: "owlbear patrol",
        occursAtHours: 2,
        hex: { q: 2, r: -1 },
        locationId: null,
        locationName: null,
        combatants: [{ name: "Owlbear", side: "enemies", quantity: 2, initiativeModifier: 1, rulesCoreConceptKey: "monster:owlbear" }],
        ...overrides
    };
    return "?" + new URLSearchParams({ hexEncounter: JSON.stringify(payload) }).toString();
}

test("parses a bounded versioned Hex Crawl encounter handoff", () => {
    const handoff = parseHexCrawlHandoff(search());
    assert.equal(handoff.sourceTool, "hex-crawl");
    assert.equal(handoff.watchNumber, 3);
    assert.deepEqual(handoff.hex, { q: 2, r: -1 });
    assert.equal(handoff.combatants[0].quantity, 2);
});

test("rejects unsupported handoffs and strips the consumed URL parameter", () => {
    assert.throws(() => parseHexCrawlHandoff(search({ version: 2 })), /unsupported format/);
    const clean = consumeHexCrawlHandoffUrl(new URL("https://example.test/tools/block-initiative?hexEncounter=x&other=1#top"));
    assert.equal(clean, "/tools/block-initiative?other=1#top");
});
