import assert from "node:assert/strict";
import test from "node:test";

import { searchRulesCoreConditions } from "../.test-dist/integrations/rules-core/conditions.js";
import { searchRulesCoreMonsters, loadMonsterTemplate, loadNativeMonsterCombatStats } from "../.test-dist/integrations/rules-core/monsters.js";

const gateway = "/tool-host/registrations/rules-core/api/upstream";
const fingerprint = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const nativeMatch = {
    id: "native:first-party-001:monster.goblin-warrior",
    rulesetId: "first-party-001",
    ruleId: "monster.goblin-warrior",
    displayName: "Goblin Warrior",
    category: "monster",
    fingerprint
};

function mockApi(routes) {
    const requested = [];
    globalThis.fetch = async (url, options) => {
        assert.equal(options.credentials, "same-origin");
        assert.deepEqual(options.headers, { Accept: "application/json" });
        assert.ok(url.startsWith(gateway));
        const path = url.slice(gateway.length);
        requested.push(path);
        const response = routes[path];
        return new Response(JSON.stringify(response?.body ?? { error: "not_found" }), {
            status: response?.status ?? 200,
            headers: { "Content-Type": "application/json" }
        });
    };
    return requested;
}

const discover = {
    "/api/consumer/v1/rulesets": { body: {
        rulesets: [{ id: "first-party-001", capabilities: { read: true, write: false } }]
    } }
};

test("searches native monster category and returns stable native identifiers", async () => {
    const requested = mockApi({
        ...discover,
        "/api/consumer/v1/rulesets/first-party-001/rules?category=monster&q=goblin&limit=8&offset=0": {
            body: { rulesetId: "first-party-001", fingerprint, total: 1, rules: [
                { id: "monster.goblin-warrior", name: "Goblin Warrior", kind: "monster" },
                { id: "condition.poisoned", name: "Poisoned", kind: "condition" }
            ] }
        }
    });
    assert.deepEqual(await searchRulesCoreMonsters(" goblin "), [nativeMatch]);
    assert.deepEqual(requested, [
        "/api/consumer/v1/rulesets",
        "/api/consumer/v1/rulesets/first-party-001/rules?category=monster&q=goblin&limit=8&offset=0"
    ]);
});

test("searches ordinary and leveled native conditions without inventing legacy metadata", async () => {
    mockApi({
        ...discover,
        "/api/consumer/v1/rulesets/first-party-001/rules?category=condition&q=ex&limit=10&offset=0": {
            body: { rulesetId: "first-party-001", fingerprint, total: 0, rules: [] }
        },
        "/api/consumer/v1/rulesets/first-party-001/rules?category=leveled-condition&q=ex&limit=10&offset=0": {
            body: { rulesetId: "first-party-001", fingerprint, total: 1, rules: [
                { id: "condition.exhaustion", name: "Exhaustion", kind: "leveled-condition" }
            ] }
        }
    });
    assert.deepEqual(await searchRulesCoreConditions("ex"), [{
        id: "native:first-party-001:condition.exhaustion",
        rulesetId: "first-party-001", ruleId: "condition.exhaustion",
        displayName: "Exhaustion", category: "leveled-condition", fingerprint
    }]);
});

test("extracts monster combat statistics from the nested native definition", async () => {
    const events = [];
    globalThis.window = { dispatchEvent: event => events.push(event) };
    mockApi({
        "/api/consumer/v1/rulesets/first-party-001/rules/monster.goblin-warrior": {
            body: { rulesetId: "first-party-001", fingerprint, rule: {
                id: "monster.goblin-warrior", name: "Goblin Warrior", kind: "monster",
                definition: {
                    id: "monster.goblin-warrior", name: "Goblin Warrior", kind: "monster",
                    definition: { ac: [15], hp: { average: 10, formula: "3d6" },
                        dex: 15, cr: "1/4", speed: { walk: 30 } }
                }
            } }
        }
    });
    const template = await loadMonsterTemplate(nativeMatch);
    assert.equal(template.name, "Goblin Warrior");
    assert.equal(template.maxHp, 10);
    assert.equal(template.armorClass, "15");
    assert.equal(template.initiativeModifier, 2);
    assert.equal(template.challengeRating, "1/4");
    assert.equal(template.document.hp.average, 10);
    assert.equal(template.browserLink, null);
    assert.equal(events.length, 1);
    assert.equal(events[0].detail.templateId, nativeMatch.id);
});

test("reports a truly unavailable native catalog without accessing private Wiki routes", async () => {
    const requested = mockApi({ "/api/consumer/v1/rulesets": { body: { rulesets: [] } } });
    await assert.rejects(() => searchRulesCoreMonsters("goblin"), /not loaded the selected ruleset/);
    assert.deepEqual(requested, ["/api/consumer/v1/rulesets"]);
});

test("rejects a mismatched native monster detail instead of filling an empty template", async () => {
    mockApi({
        "/api/consumer/v1/rulesets/first-party-001/rules/monster.goblin-warrior": {
            body: { rulesetId: "first-party-001", fingerprint, rule: {
                id: "monster.ogre", name: "Ogre", kind: "monster", definition: {}
            } }
        }
    });
    await assert.rejects(() => loadMonsterTemplate(nativeMatch), /mismatched native monster definition/);
});

test("enforces native API query-length limits before a network request", async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("Unexpected request"); };
    await assert.rejects(() => searchRulesCoreConditions("z".repeat(201)), /200 characters/);
    assert.equal(calls, 0);
    assert.deepEqual(await searchRulesCoreConditions("z"), []);
});

test("native monster detail rehydration uses the same validated stat-block loader", async () => {
    const requested = mockApi({
        "/api/consumer/v1/rulesets/first-party-001/rules/monster.goblin-warrior": {
            body: { rulesetId: "first-party-001", fingerprint, rule: {
                id: "monster.goblin-warrior", name: "Goblin Warrior", kind: "monster",
                definition: { id: "monster.goblin-warrior", kind: "monster",
                    definition: { ac: [15], hp: { average: 10 }, dex: 15, cr: "1/4" } }
            } }
        }
    });
    assert.equal((await loadNativeMonsterCombatStats(nativeMatch.id)).maxHp, 10);
    assert.deepEqual(requested, ["/api/consumer/v1/rulesets/first-party-001/rules/monster.goblin-warrior"]);
});

test("legacy and malformed template identities do not hit removed APIs", async () => {
    let count = 0;
    globalThis.fetch = async () => { count += 1; throw Error("unexpected network request"); };
    assert.equal(await loadNativeMonsterCombatStats("rule:legacy-concept"), null);
    assert.equal(await loadNativeMonsterCombatStats("source:legacy-entity"), null);
    assert.equal(await loadNativeMonsterCombatStats("native:first-party-001:monster.%2Fbad"), null);
    assert.equal(count, 0);
});

test("accepts a current native detail after the catalog fingerprint changes", async () => {
    mockApi({
        "/api/consumer/v1/rulesets/first-party-001/rules/monster.goblin-warrior": {
            body: { rulesetId: "first-party-001", fingerprint: "b".repeat(64), rule: {
                id: "monster.goblin-warrior", kind: "monster", name: "Goblin Warrior",
                definition: { id: "monster.goblin-warrior", kind: "monster", definition: { hp: 10 } }
            } }
        }
    });
    const template = await loadMonsterTemplate(nativeMatch);
    assert.equal(template.name, "Goblin Warrior");
});

test("accepts concurrently changing catalog versions in condition searches", async () => {
    mockApi({
        ...discover,
        "/api/consumer/v1/rulesets/first-party-001/rules?category=condition&q=ex&limit=10&offset=0": {
            body: { rulesetId: "first-party-001", fingerprint, total: 0, rules: [] }
        },
        "/api/consumer/v1/rulesets/first-party-001/rules?category=leveled-condition&q=ex&limit=10&offset=0": {
            body: { rulesetId: "first-party-001", fingerprint: "b".repeat(64), total: 0, rules: [] }
        }
    });
    assert.deepEqual(await searchRulesCoreConditions("ex"), []);
});

test("returns null for a removed native template but preserves the saved encounter", async () => {
    mockApi({
        "/api/consumer/v1/rulesets/first-party-001/rules/monster.goblin-warrior": {
            status: 404, body: { error: "rule_not_found" }
        }
    });
    assert.equal(await loadNativeMonsterCombatStats(nativeMatch.id), null);
});

test("denies unauthenticated catalog responses rather than silently falling back to public data", async () => {
    const requested = mockApi({
        "/api/consumer/v1/rulesets": { status: 401, body: { error: "invalid_ticket" } }
    });
    await assert.rejects(() => searchRulesCoreMonsters("goblin"), /requires access/);
    assert.deepEqual(requested, ["/api/consumer/v1/rulesets"]);
});
