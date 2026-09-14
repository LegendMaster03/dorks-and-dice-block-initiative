export const abilityKeys = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;
export type AbilityKey = typeof abilityKeys[number];

export interface CombatAbilityStat {
    score: number | null;
    modifier: number | null;
    save: number | null;
}

export interface MonsterCombatStats {
    armorClass: string | null;
    maxHp: number | null;
    speed: string | null;
    initiativeModifier: number | null;
    abilities: Record<AbilityKey, CombatAbilityStat>;
    vulnerabilities: string | null;
    resistances: string | null;
    immunities: string | null;
    conditionImmunities: string | null;
    damageReduction: string | null;
}

export function projectMonsterCombatStats(
    document: Record<string, unknown>,
    editionDisplayName = ""
): MonsterCombatStats {
    const legacy = legacyFieldMap(document.body);
    const saves = readAbilitySaves(document);
    const fifthEdition = isFifthEdition(editionDisplayName);
    const abilities = {} as Record<AbilityKey, CombatAbilityStat>;

    for (const key of abilityKeys) {
        const property = key.toLowerCase();
        const score = readNumber(document[property]) ?? readNumber(legacy.get(humanAbility(key)));
        const modifier = score === null ? null : Math.floor((score - 10) / 2);
        abilities[key] = {
            score,
            modifier,
            save: saves.get(property) ?? (fifthEdition ? modifier : null)
        };
    }

    const hitDice = firstValue(formatPrimitive(document.hp), legacy.get("Hit Dice"));
    return {
        armorClass: readArmorClass(document.ac) ?? leadingNumber(legacy.get("Armor Class") ?? legacy.get("AC")),
        maxHp: readHitPoints(document.hp) ?? readNumber(legacy.get("Hit Points")) ?? hitPointsFromHitDice(hitDice),
        speed: readSpeed(document.speed) ?? readLegacySpeed(legacy.get("Speed")),
        initiativeModifier: readInitiativeModifier(document, abilities.DEX.modifier, legacy),
        abilities,
        vulnerabilities: firstFormatted([
            document.vulnerable,
            document.vulnerabilities,
            document.damageVulnerabilities,
            legacy.get("Damage Vulnerabilities"),
            legacy.get("Vulnerabilities")
        ]),
        resistances: firstFormatted([
            document.resist,
            document.resistance,
            document.resistances,
            document.damageResistances,
            legacy.get("Damage Resistances"),
            legacy.get("Resistances")
        ]),
        immunities: firstFormatted([
            document.immune,
            document.immunities,
            document.damageImmunities,
            legacy.get("Damage Immunities"),
            legacy.get("Immunities")
        ]),
        conditionImmunities: firstFormatted([
            document.conditionImmune,
            document.conditionImmunities,
            legacy.get("Condition Immunities")
        ]),
        damageReduction: firstFormatted([
            document.damageReduction,
            document.dr,
            legacy.get("Damage Reduction"),
            legacy.get("DR")
        ])
    };
}

function readAbilitySaves(document: Record<string, unknown>): Map<string, number> {
    const result = new Map<string, number>();
    for (const source of [document.save, document.savingThrows]) {
        if (!isRecord(source)) continue;
        for (const key of abilityKeys) {
            const property = key.toLowerCase();
            const value = readNumber(source[property]);
            if (value !== null) result.set(property, value);
        }
    }

    for (const key of abilityKeys) {
        const property = key.toLowerCase();
        for (const candidate of [`${property}Save`, `${property}SavingThrow`]) {
            const value = readNumber(document[candidate]);
            if (value !== null) result.set(property, value);
        }
    }
    return result;
}

function readHitPoints(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") return readNumber(value);
    if (!isRecord(value)) return null;
    return readNumber(value.average) ?? readNumber(value.value) ?? readNumber(value.max);
}

function readArmorClass(value: unknown): string | null {
    if (typeof value === "number" || typeof value === "string") {
        return leadingNumber(value) ?? String(value);
    }
    if (!Array.isArray(value) || value.length === 0) return null;

    const first = value[0];
    if (typeof first === "number" || typeof first === "string") {
        return leadingNumber(first) ?? String(first);
    }
    if (isRecord(first) && (typeof first.ac === "number" || typeof first.ac === "string")) {
        return leadingNumber(first.ac) ?? String(first.ac);
    }
    return null;
}

function readInitiativeModifier(
    document: Record<string, unknown>,
    dexterityModifier: number | null,
    legacy: Map<string, string>
): number | null {
    for (const candidate of [document.initiative, document.init]) {
        const direct = readInitiativeValue(candidate);
        if (direct !== null) return direct;
    }
    for (const label of ["Initiative", "Init"]) {
        const value = readNumber(legacy.get(label));
        if (value !== null) return value;
    }
    return dexterityModifier;
}

function readInitiativeValue(value: unknown): number | null {
    const direct = readNumber(value);
    if (direct !== null) return direct;
    if (!isRecord(value)) return null;
    for (const key of ["bonus", "mod", "modifier", "initiativeBonus"]) {
        const candidate = readNumber(value[key]);
        if (candidate !== null) return candidate;
    }
    return null;
}

function readSpeed(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return `${value} ft.`;
    if (typeof value === "string") return value.trim() || null;
    if (Array.isArray(value)) {
        const parts = value.map(readSpeed).filter((part): part is string => Boolean(part));
        return parts.length ? parts.join(", ") : null;
    }
    if (!isRecord(value)) return null;

    const parts: string[] = [];
    for (const [key, candidate] of Object.entries(value)) {
        if (candidate === false || candidate === null || candidate === undefined || key === "canHover") continue;
        if (typeof candidate === "number") {
            parts.push(key === "walk" ? `${candidate} ft.` : `${humanize(key)} ${candidate} ft.`);
            continue;
        }
        const formatted = formatDefense(candidate);
        if (formatted) parts.push(key === "walk" ? formatted : `${humanize(key)} ${formatted}`);
    }
    return parts.length ? parts.join(", ") : null;
}

function readLegacySpeed(value: string | undefined): string | null {
    if (!value) return null;
    let text = value.trim().replace(/^is\s+/i, "");
    const hardBoundary = text.search(/[\n\r—–]/);
    if (hardBoundary >= 0) text = text.slice(0, hardBoundary).trim();

    const movement = text.match(/^(?:(?:[a-z][a-z -]*\s+)?\d+(?:\.\d+)?\s*(?:ft\.?|feet|foot)(?:\s*\([^)]*\))?\s*(?:(?:,|;)\s*|and\s+)?)+/i)?.[0]?.trim();
    if (movement) return movement.replace(/[;,]\s*$/, "").trim();

    const firstLine = text.split(/\n/, 1)[0]?.trim();
    return firstLine || null;
}

function firstFormatted(values: unknown[]): string | null {
    for (const value of values) {
        const formatted = formatDefense(value);
        if (formatted) return formatted;
    }
    return null;
}

function formatDefense(value: unknown): string | null {
    if (value === null || value === undefined || value === false) return null;
    if (typeof value === "string") return value.trim() || null;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) {
        const parts = value.map(formatDefense).filter((part): part is string => Boolean(part));
        return parts.length ? parts.join(", ") : null;
    }
    if (!isRecord(value)) return null;

    const special = formatDefense(value.special);
    if (special) return special;

    const nested = ["resist", "immune", "vulnerable", "conditionImmune", "damage", "types"]
        .map(key => formatDefense(value[key]))
        .filter((part): part is string => Boolean(part));
    const note = formatDefense(value.note);
    const preNote = formatDefense(value.preNote);
    const postNote = formatDefense(value.postNote);
    if (nested.length || note || preNote || postNote) {
        return [preNote, nested.join(", ") || null, note, postNote].filter(Boolean).join(" ");
    }

    const parts = Object.entries(value)
        .filter(([, candidate]) => candidate !== false && candidate !== null && candidate !== undefined)
        .map(([key, candidate]) => candidate === true
            ? humanize(key)
            : `${humanize(key)} ${formatDefense(candidate) ?? ""}`.trim());
    return parts.length ? parts.join(", ") : null;
}

function legacyFieldMap(value: unknown): Map<string, string> {
    if (typeof value !== "string" || !value.trim()) return new Map();
    const text = stripMarkup(value);
    const labels = [
        "Damage Vulnerabilities", "Vulnerabilities", "Damage Resistances", "Resistances",
        "Damage Immunities", "Condition Immunities", "Immunities", "Damage Reduction", "DR",
        "Spell Resistance", "Weaknesses", "Armor Class", "Hit Points", "Hit Dice", "Initiative",
        "Base Attack/Grapple", "Base Attack", "Grapple", "Full Attack", "Attack", "Space/Reach",
        "Special Attacks", "Special Qualities", "Saves", "Abilities", "Skills", "Feats", "Environment",
        "Organization", "Challenge Rating", "Treasure", "Alignment", "Advancement", "Level Adjustment",
        "Senses", "Languages", "Aura", "Combat", "Speed", "AC", "Init", "Str", "Dex", "Con", "Int", "Wis", "Cha"
    ];
    const positions: Array<{ index: number; label: string; end: number }> = [];
    const lower = text.toLowerCase();

    for (const label of labels) {
        const needle = label.toLowerCase();
        let start = 0;
        while (start < lower.length) {
            const index = lower.indexOf(needle, start);
            if (index < 0) break;
            const before = index === 0 ? " " : lower[index - 1];
            const afterIndex = index + needle.length;
            const after = afterIndex >= lower.length ? " " : lower[afterIndex];
            if (!isWordChar(before) && !isWordChar(after)) positions.push({ index, label, end: afterIndex });
            start = afterIndex;
        }
    }

    positions.sort((left, right) => left.index - right.index || right.label.length - left.label.length);
    const deduped = positions.filter((entry, index, all) => index === 0 || entry.index !== all[index - 1].index);
    const result = new Map<string, string>();
    for (let index = 0; index < deduped.length; index += 1) {
        const current = deduped[index];
        const next = deduped[index + 1];
        const segment = text.slice(current.end, next?.index ?? text.length).replace(/^\s*[:=]\s*/, "").trim();
        if (segment) result.set(current.label, segment);
    }
    return result;
}

function stripMarkup(value: string): string {
    return value
        .replace(/<\/(?:p|div|tr|td|th|li|h[1-6])>/gi, "\n")
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n[ \t]+/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function hitPointsFromHitDice(value: unknown): number | null {
    const match = String(value ?? "").match(/\((\d+)\s*hp\)/i);
    return match ? Number(match[1]) : null;
}

function leadingNumber(value: unknown): string | null {
    return String(value ?? "").trim().match(/^-?\d+(?:\.\d+)?/)?.[0] ?? null;
}

function readNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string") return null;
    const match = value.trim().match(/[+-]?\d+(?:\.\d+)?/);
    const parsed = match ? Number(match[0]) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
}

function formatPrimitive(value: unknown): string | null {
    if (typeof value === "number" || typeof value === "string") return String(value);
    return isRecord(value) && typeof value.formula === "string" ? value.formula : null;
}

function isFifthEdition(value: string): boolean {
    return /(?:^|[^0-9.])(?:5(?:\.5)?e|5th|fifth|2014|2024)(?:$|[^0-9.])/i.test(value);
}

function humanAbility(key: AbilityKey): string {
    return key[0] + key.slice(1).toLowerCase();
}

function humanize(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[-_]+/g, " ")
        .replace(/^./, character => character.toUpperCase());
}

function isWordChar(character: string): boolean {
    return /[a-z0-9]/i.test(character ?? "");
}

function firstValue(...values: Array<string | null | undefined>): string | null {
    return values.find(value => value !== null && value !== undefined && value !== "") ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
