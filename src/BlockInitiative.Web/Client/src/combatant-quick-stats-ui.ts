import { abilityKeys, projectMonsterCombatStats } from "./monster-combat-stats";
import type { MonsterCombatStats } from "./monster-combat-stats";
import { registerAfterRender, requestEnhancement } from "./render-lifecycle";

type CombatantPreview = {
    id: string;
    name: string;
    allianceId: string;
    initiativeModifier: number | null;
    blockType: "standard" | "kaiju" | "mixed";
};

type PreviewDetail = {
    response: {
        orderedCombatants: CombatantPreview[];
    };
};

type StateDetail = {
    request?: {
        advanceCount?: number;
        resumeRound?: number | null;
    };
    response: {
        round: number;
        activeBlockId: string | null;
        blocks: Array<{
            id: string;
            memberOrder: string[];
        }>;
    };
};

type RulesCoreDetail = {
    document?: unknown;
    editionDisplayName?: string;
};

type HealthSnapshot = {
    current: number | null;
    max: number | null;
};

const gateway = "/tool-host/rules-core/api/upstream";
const templateStats = new Map<string, MonsterCombatStats | null>();
const pendingTemplates = new Set<string>();
const actedRoundByCombatant = new Map<string, number>();
let lastPreview: PreviewDetail | null = null;
let lastState: StateDetail | null = null;
let statsHidden = false;
let initialized = false;

export function initializeCombatantQuickStatsUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    installStyles(root.ownerDocument);

    window.addEventListener("block-initiative:preview", event => {
        lastPreview = (event as CustomEvent<PreviewDetail>).detail ?? null;
        requestEnhancement();
    });

    window.addEventListener("block-initiative:state", event => {
        const detail = (event as CustomEvent<StateDetail>).detail ?? null;
        lastState = detail;
        if (detail?.request?.advanceCount === 0 && (detail.request.resumeRound === null || detail.request.resumeRound === undefined)) {
            actedRoundByCombatant.clear();
        }
        requestEnhancement();
    });

    registerAfterRender("combatant-quick-stats", 120, () => enhance(root));
}

function enhance(root: HTMLElement): void {
    queueMissingTemplateStats(root);
    root.classList.toggle("bi-stats-hidden", statsHidden);

    const state = lastState?.response;
    const preview = lastPreview?.response;
    if (!state || !preview?.orderedCombatants.length || !state.activeBlockId) return;

    const active = state.blocks.find(block => block.id === state.activeBlockId);
    if (!active) return;

    const runner = root.querySelector<HTMLElement>(".bi-active")?.closest<HTMLElement>("section.card.card-body.bi-grid");
    if (!runner) return;
    ensureStatsToggle(runner, root);

    const byId = new Map(preview.orderedCombatants.map(combatant => [combatant.id, combatant]));
    const templateByCombatant = collectTemplateIds(root);
    const healthByCombatant = collectHealth(root, preview.orderedCombatants);
    const rows = Array.from(runner.querySelectorAll<HTMLElement>(".bi-runner-member"));

    active.memberOrder.forEach((combatantId, index) => {
        const row = rows[index];
        if (!row) return;
        row.dataset.combatantId = combatantId;
        const combatant = byId.get(combatantId);
        ensureActedControl(row, combatantId, state.round);
        const templateId = templateByCombatant.get(combatantId);
        const stats = templateId ? templateStats.get(templateId) : null;
        paintQuickStats(row, combatant, stats ?? null, healthByCombatant.get(combatantId) ?? null);
    });
}

function ensureStatsToggle(runner: HTMLElement, root: HTMLElement): void {
    const top = runner.querySelector<HTMLElement>(":scope > .bi-row");
    if (!top) return;
    let button = top.querySelector<HTMLButtonElement>("[data-action='toggle-combat-stats']");
    if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-sm btn-outline-secondary";
        button.dataset.action = "toggle-combat-stats";
        button.onclick = () => {
            statsHidden = !statsHidden;
            root.classList.toggle("bi-stats-hidden", statsHidden);
            updateStatsToggle(button!);
        };
        top.append(button);
    }
    updateStatsToggle(button);
}

function updateStatsToggle(button: HTMLButtonElement): void {
    button.textContent = statsHidden ? "Show stats" : "Hide stats";
    button.setAttribute("aria-pressed", statsHidden ? "true" : "false");
    button.title = statsHidden
        ? "Show combat statistics and DM combat-state controls"
        : "Hide combat statistics and DM combat-state controls for a player-facing display";
}

function ensureActedControl(row: HTMLElement, combatantId: string, round: number): void {
    let label = row.querySelector<HTMLLabelElement>(":scope > .bi-acted-toggle");
    if (!label) {
        label = document.createElement("label");
        label.className = "bi-acted-toggle";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.dataset.role = "acted-toggle";
        const text = document.createElement("span");
        text.textContent = "Acted";
        label.append(input, text);
        row.append(label);
    }

    const input = label.querySelector<HTMLInputElement>("input[data-role='acted-toggle']")!;
    input.checked = actedRoundByCombatant.get(combatantId) === round;
    input.setAttribute("aria-label", `Mark combatant as acted in round ${round}`);
    input.onchange = () => {
        if (input.checked) actedRoundByCombatant.set(combatantId, round);
        else actedRoundByCombatant.delete(combatantId);
        paintActedState(row, input.checked);
    };
    paintActedState(row, input.checked);
}

function paintActedState(row: HTMLElement, acted: boolean): void {
    row.classList.toggle("bi-acted", acted);
}

function paintQuickStats(
    row: HTMLElement,
    combatant: CombatantPreview | undefined,
    stats: MonsterCombatStats | null,
    health: HealthSnapshot | null
): void {
    const existing = row.querySelector<HTMLElement>(":scope > .bi-quick-stats");
    if (!stats) {
        existing?.remove();
        return;
    }

    const hp = health?.current !== null && health?.current !== undefined
        ? health.max !== null ? `${health.current} / ${health.max}` : String(health.current)
        : stats.maxHp !== null ? String(stats.maxHp) : null;
    const initiative = combatant?.initiativeModifier ?? stats.initiativeModifier;
    const signature = JSON.stringify({ stats, hp, initiative });
    if (existing?.dataset.quickStatsSignature === signature) return;

    const panel = existing ?? document.createElement("section");
    panel.className = "bi-quick-stats";
    panel.dataset.quickStatsSignature = signature;
    panel.replaceChildren();

    const facts = document.createElement("div");
    facts.className = "bi-quick-facts";
    appendFact(facts, "AC", stats.armorClass);
    appendFact(facts, "HP", hp);
    appendFact(facts, "Speed", stats.speed);
    appendFact(facts, "Init", initiative === null || initiative === undefined ? null : signed(initiative));
    if (facts.childElementCount) panel.append(facts);

    if (abilityKeys.some(key => stats.abilities[key].score !== null)) {
        const abilities = document.createElement("div");
        abilities.className = "bi-quick-abilities";
        for (const key of abilityKeys) {
            const ability = stats.abilities[key];
            const cell = document.createElement("div");
            cell.className = "bi-quick-ability";
            cell.innerHTML = "<span class='bi-quick-ability-label'></span><span class='bi-quick-ability-label'></span><span class='bi-quick-ability-label'>MOD</span><span class='bi-quick-ability-label'>SAVE</span>";
            const name = document.createElement("strong");
            name.textContent = key;
            const score = document.createElement("span");
            score.textContent = ability.score === null ? "—" : String(ability.score);
            const modifier = document.createElement("span");
            modifier.textContent = ability.modifier === null ? "—" : signed(ability.modifier);
            const save = document.createElement("span");
            save.textContent = ability.save === null ? "—" : signed(ability.save);
            cell.append(name, score, modifier, save);
            abilities.append(cell);
        }
        panel.append(abilities);
    }

    const defenses = document.createElement("div");
    defenses.className = "bi-quick-defenses";
    appendDefense(defenses, "Vulnerable", stats.vulnerabilities);
    appendDefense(defenses, "Resistant", stats.resistances);
    appendDefense(defenses, "Immune", stats.immunities);
    appendDefense(defenses, "Condition Immune", stats.conditionImmunities);
    appendDefense(defenses, "Damage Reduction", stats.damageReduction);
    if (defenses.childElementCount) panel.append(defenses);

    if (!existing) row.append(panel);
}

function appendFact(container: HTMLElement, label: string, value: string | null): void {
    if (!value) return;
    const item = document.createElement("span");
    item.className = "bi-quick-fact";
    const strong = document.createElement("strong");
    strong.textContent = label;
    item.append(strong, document.createTextNode(` ${value}`));
    container.append(item);
}

function appendDefense(container: HTMLElement, label: string, value: string | null): void {
    if (!value) return;
    const line = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = `${label}:`;
    line.append(strong, document.createTextNode(` ${value}`));
    container.append(line);
}

function collectTemplateIds(root: HTMLElement): Map<string, string> {
    const result = new Map<string, string>();
    for (const card of root.querySelectorAll<HTMLElement>(".bi-entry[data-id][data-template-id]")) {
        const combatantId = card.dataset.id;
        const templateId = card.dataset.templateId;
        if (combatantId && templateId) result.set(combatantId, templateId);
    }
    return result;
}

function queueMissingTemplateStats(root: HTMLElement): void {
    for (const templateId of collectTemplateIds(root).values()) {
        if (templateStats.has(templateId) || pendingTemplates.has(templateId)) continue;
        pendingTemplates.add(templateId);
        void loadTemplateStats(templateId).then(stats => {
            templateStats.set(templateId, stats);
        }).finally(() => {
            pendingTemplates.delete(templateId);
            requestEnhancement();
        });
    }
}

async function loadTemplateStats(templateId: string): Promise<MonsterCombatStats | null> {
    const separator = templateId.indexOf(":");
    if (separator <= 0) return null;
    const kind = templateId.slice(0, separator);
    const id = templateId.slice(separator + 1);
    if (!id) return null;

    const path = kind === "rule"
        ? `/api/rules/${encodeURIComponent(id)}`
        : kind === "source"
            ? `/api/sources/entities/${encodeURIComponent(id)}`
            : null;
    if (!path) return null;

    try {
        const response = await fetch(`${gateway}${path}`, {
            credentials: "same-origin",
            headers: { Accept: "application/json" }
        });
        if (!response.ok) return null;
        const detail = await response.json() as RulesCoreDetail;
        if (!isRecord(detail.document)) return null;
        return projectMonsterCombatStats(detail.document, detail.editionDisplayName ?? "");
    } catch {
        return null;
    }
}

function collectHealth(root: HTMLElement, combatants: CombatantPreview[]): Map<string, HealthSnapshot> {
    const result = new Map<string, HealthSnapshot>();
    const standards = combatants.filter(combatant => combatant.allianceId !== "players" && combatant.blockType === "standard");
    const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-combat-dashboard] .bi-health-row"));
    standards.forEach((combatant, index) => {
        const row = rows[index];
        if (!row) return;
        const status = row.querySelector<HTMLElement>(".bi-statuses")?.textContent ?? "";
        const pair = status.match(/HP\s*(-?\d+)\s*\/\s*(-?\d+)/i);
        if (pair) {
            result.set(combatant.id, { current: Number(pair[1]), max: Number(pair[2]) });
            return;
        }
        const single = status.match(/HP\s*(-?\d+)/i);
        if (single) result.set(combatant.id, { current: Number(single[1]), max: null });
    });
    return result;
}

function installStyles(documentRef: Document): void {
    if (documentRef.head.querySelector("style[data-role='combatant-quick-stats-style']")) return;
    const style = documentRef.createElement("style");
    style.dataset.role = "combatant-quick-stats-style";
    style.textContent = `
.block-initiative-app .bi-runner-member{align-items:flex-start}
.block-initiative-app .bi-runner-member.bi-acted{opacity:.62;background:var(--bi-soft)}
.block-initiative-app .bi-acted-toggle{display:flex;gap:.35rem;align-items:center;margin-left:auto;white-space:nowrap;font-size:.84rem;font-weight:600}
.block-initiative-app .bi-acted-toggle input{width:auto!important;min-width:0;padding:0}
.block-initiative-app .bi-quick-stats{flex:1 0 100%;width:100%;display:grid;gap:.42rem;padding-top:.48rem;border-top:1px solid var(--bi-border)}
.block-initiative-app .bi-quick-facts{display:flex;flex-wrap:wrap;gap:.25rem .8rem;font-size:.88rem}
.block-initiative-app .bi-quick-abilities{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.3rem .45rem}
.block-initiative-app .bi-quick-ability{display:grid;grid-template-columns:2.1rem 2.2rem 2.4rem 2.5rem;gap:.2rem;align-items:baseline;padding:.25rem .35rem;border:1px solid var(--bi-border);border-radius:.35rem;font-variant-numeric:tabular-nums}
.block-initiative-app .bi-quick-ability-label{font-size:.58rem;line-height:1;text-transform:uppercase;opacity:.58;text-align:right}
.block-initiative-app .bi-quick-ability>strong{font-size:.76rem}
.block-initiative-app .bi-quick-ability>span:not(.bi-quick-ability-label){font-size:.82rem;text-align:right}
.block-initiative-app .bi-quick-defenses{display:grid;gap:.16rem;font-size:.82rem}
.block-initiative-app.bi-stats-hidden .bi-quick-stats,
.block-initiative-app.bi-stats-hidden [data-combat-dashboard]{display:none!important}
@media(max-width:760px){.block-initiative-app .bi-quick-abilities{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:500px){.block-initiative-app .bi-quick-abilities{grid-template-columns:1fr}.block-initiative-app .bi-quick-ability{grid-template-columns:2.4rem 2.4rem 2.6rem 2.8rem}}
`;
    documentRef.head.append(style);
}

function signed(value: number): string {
    return `${value >= 0 ? "+" : ""}${value}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
