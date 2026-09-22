import type { MonsterCombatStats } from "./roster/monster-combat-stats";

export interface QuickStatsDefenseRow {
    label: string;
    value: string;
}

export function mergeMonsterCombatStats(
    base: MonsterCombatStats | null,
    override: MonsterCombatStats | null
): MonsterCombatStats | null {
    if (!base) return override;
    if (!override) return base;

    const abilities = {} as MonsterCombatStats["abilities"];
    for (const key of Object.keys(base.abilities) as Array<keyof MonsterCombatStats["abilities"]>) {
        const baseAbility = base.abilities[key];
        const overrideAbility = override.abilities[key];
        abilities[key] = {
            score: overrideAbility.score ?? baseAbility.score,
            modifier: overrideAbility.score !== null ? overrideAbility.modifier : baseAbility.modifier,
            save: overrideAbility.save ?? baseAbility.save
        };
    }

    return {
        armorClass: override.armorClass ?? base.armorClass,
        touchArmorClass: override.touchArmorClass ?? base.touchArmorClass,
        flatFootedArmorClass:
            override.flatFootedArmorClass ?? base.flatFootedArmorClass,
        maxHp: override.maxHp ?? base.maxHp,
        speed: override.speed ?? base.speed,
        initiativeModifier: override.initiativeModifier ?? base.initiativeModifier,
        abilities,
        vulnerabilities: override.vulnerabilities ?? base.vulnerabilities,
        resistances: override.resistances ?? base.resistances,
        immunities: override.immunities ?? base.immunities,
        conditionImmunities: override.conditionImmunities ?? base.conditionImmunities,
        damageReduction: override.damageReduction ?? base.damageReduction
    };
}

export function defenseRows(stats: MonsterCombatStats | null): QuickStatsDefenseRow[] {
    if (!stats) return [];

    const rows: Array<[string, string | null]> = [
        ["Vulnerable", stats.vulnerabilities],
        ["Resistant", stats.resistances],
        ["Immune", stats.immunities],
        ["Condition Immune", stats.conditionImmunities],
        ["Damage Reduction", stats.damageReduction]
    ];

    return rows
        .filter((row): row is [string, string] => Boolean(row[1]))
        .map(([label, value]) => ({ label, value }));
}

export function chooseHealthEditor<T>(rowEditor: T | null, ownedEditor: T | null): T | null {
    return rowEditor ?? ownedEditor;
}
