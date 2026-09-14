import assert from "node:assert/strict";
import test from "node:test";

import { projectMonsterCombatStats } from "../.test-dist/monster-combat-stats.js";

test("projects 5e-style combat card stats", () => {
    const stats = projectMonsterCombatStats({
        ac: [{ ac: 19 }],
        hp: { average: 256, formula: "19d12 + 133" },
        speed: { walk: 40, fly: 80 },
        initiative: { bonus: "+5" },
        str: 27,
        dex: 10,
        con: 25,
        int: 16,
        wis: 13,
        cha: 21,
        save: { dex: "+6", wis: "+8" },
        vulnerable: ["cold"],
        resist: [{ resist: ["fire", "lightning"], note: "while bloodied" }],
        immune: ["poison"],
        conditionImmune: ["charmed", "frightened"]
    }, "D&D 5.5e / 2024");

    assert.equal(stats.armorClass, "19");
    assert.equal(stats.maxHp, 256);
    assert.equal(stats.speed, "40 ft., Fly 80 ft.");
    assert.equal(stats.initiativeModifier, 5);
    assert.deepEqual(stats.abilities.STR, { score: 27, modifier: 8, save: 8 });
    assert.deepEqual(stats.abilities.DEX, { score: 10, modifier: 0, save: 6 });
    assert.equal(stats.vulnerabilities, "cold");
    assert.equal(stats.resistances, "fire, lightning while bloodied");
    assert.equal(stats.immunities, "poison");
    assert.equal(stats.conditionImmunities, "charmed, frightened");
});

test("reads normalized defense aliases from nested combat data", () => {
    const stats = projectMonsterCombatStats({
        defenses: {
            damage_vulnerabilities: ["radiant"],
            damage_resistances: ["fire", "cold"],
            damage_immunities: ["poison"],
            condition_immunities: ["charmed", "frightened"]
        }
    }, "D&D 5.5e / 2024");

    assert.equal(stats.vulnerabilities, "radiant");
    assert.equal(stats.resistances, "fire, cold");
    assert.equal(stats.immunities, "poison");
    assert.equal(stats.conditionImmunities, "charmed, frightened");
});

test("keeps 3.x damage reduction separate and does not invent ability saves", () => {
    const stats = projectMonsterCombatStats({
        body: [
            "Armor Class: 25, touch 9, flat-footed 25",
            "Hit Dice: 10d10+30 (85 hp)",
            "Initiative: +0",
            "Speed: 40 ft.",
            "Str 28 Dex 11 Con 16 Int 10 Wis 11 Cha 10",
            "Damage Reduction: 10/adamantine",
            "Resistances: fire 10",
            "Immunities: poison",
            "Vulnerabilities: cold"
        ].join("\n")
    }, "D&D 3.5e");

    assert.equal(stats.armorClass, "25");
    assert.equal(stats.maxHp, 85);
    assert.equal(stats.speed, "40 ft.");
    assert.equal(stats.initiativeModifier, 0);
    assert.deepEqual(stats.abilities.STR, { score: 28, modifier: 9, save: null });
    assert.equal(stats.damageReduction, "10/adamantine");
    assert.equal(stats.resistances, "fire 10");
    assert.equal(stats.immunities, "poison");
    assert.equal(stats.vulnerabilities, "cold");
});

test("extracts 3.5e goblin HP, initiative, and speed without swallowing descriptive text", () => {
    const stats = projectMonsterCombatStats({
        body: [
            "Armor Class: 15, touch 12, flat-footed 13",
            "Hit Dice: 1d8+1 (5 hp)",
            "Initiative: +1",
            "Speed is 30 feet. —Darkvision out to 60 feet. — +4 racial bonus on Move Silently and Ride checks. —Automatic Languages: Common, Goblin. Bonus Languages: Draconic, Elven, Giant, Gnoll, Orc. —Favored Class: Rogue.",
            "The goblin warrior presented here had the following ability scores before racial adjustments: Str 13 Dex 11 Con 12 Int 10 Wis 9 Cha 8"
        ].join("\n")
    }, "D&D 3.5e");

    assert.equal(stats.armorClass, "15");
    assert.equal(stats.maxHp, 5);
    assert.equal(stats.initiativeModifier, 1);
    assert.equal(stats.speed, "30 feet");
    assert.deepEqual(stats.abilities.STR, { score: 13, modifier: 1, save: null });
    assert.deepEqual(stats.abilities.DEX, { score: 11, modifier: 0, save: null });
});
