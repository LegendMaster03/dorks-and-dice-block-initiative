import assert from "node:assert/strict";
import test from "node:test";

import { charactersMissingFromEncounter } from "../.test-dist/campaign-roster.js";

test("linked campaign character IDs prevent duplicate imports after a local rename", () => {
    const existing = [
        { campaignCharacterId: "character-1", name: "Locally Renamed Hero" }
    ];
    const campaign = [
        { characterId: "character-1", name: "Original Hero" },
        { characterId: "character-2", name: "Second Hero" }
    ];

    assert.deepEqual(charactersMissingFromEncounter(existing, campaign), [
        { characterId: "character-2", name: "Second Hero" }
    ]);
});

test("manual combatants with the same normalized name prevent duplicate imports", () => {
    const existing = [
        { campaignCharacterId: null, name: "  CAMPAIGN HERO " }
    ];
    const campaign = [
        { characterId: "character-1", name: "Campaign Hero" },
        { characterId: "character-2", name: "Different Hero" }
    ];

    assert.deepEqual(charactersMissingFromEncounter(existing, campaign), [
        { characterId: "character-2", name: "Different Hero" }
    ]);
});

test("duplicate campaign data is collapsed by character ID or normalized name", () => {
    const campaign = [
        { characterId: "character-1", name: "Hero One" },
        { characterId: "character-1", name: "Hero One Copy" },
        { characterId: "character-2", name: "hero one" },
        { characterId: "character-3", name: "Hero Three" }
    ];

    assert.deepEqual(charactersMissingFromEncounter([], campaign), [
        { characterId: "character-1", name: "Hero One" },
        { characterId: "character-3", name: "Hero Three" }
    ]);
});

test("blank campaign identities are ignored and imported values are trimmed", () => {
    const campaign = [
        { characterId: "", name: "No ID" },
        { characterId: "character-1", name: "   " },
        { characterId: "  character-2  ", name: "  Trimmed Hero  " }
    ];

    assert.deepEqual(charactersMissingFromEncounter([], campaign), [
        { characterId: "character-2", name: "Trimmed Hero" }
    ]);
});
