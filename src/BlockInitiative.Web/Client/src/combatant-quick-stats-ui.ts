import {
    clearActedRounds,
    isCombatantActed,
    pruneActedRounds,
    setCombatantActed
} from "./combatant-turn-markers";
import { defenseRows, mergeMonsterCombatStats } from "./encounter-card-model";
import { collectEncounterCards, mountEncounterCardSlot, renderEncounterCard } from "./encounter-card-renderer";
import { abilityKeys, projectMonsterCombatStats } from "./roster/monster-combat-stats";
import type { AbilityKey, MonsterCombatStats } from "./roster/monster-combat-stats";
import {
    applyNumberLimits,
    parseBoundedNumber,
    TRACKER_LIMITS
} from "./numeric-input-limits";
import { registerAfterRender, requestEnhancement } from "./render-lifecycle";

type CombatantPreview = {
    id: string;
    name: string;
    allianceId: string;
    initiativeModifier: number | null;
    tacticalGroupId?: string | null;
    blockType: "standard" | "kaiju" | "mixed";
};

type PreviewDetail = {
    response: {
        orderedCombatants: CombatantPreview[];
    };
};

type StateBlock = {
    id: string;
    allianceId: string;
    blockType: "standard" | "kaiju" | "mixed";
    memberOrder: string[];
};

type StateDetail = {
    request?: {
        advanceCount?: number;
        resumeRound?: number | null;
    };
    response: {
        round: number;
        activeBlockId: string | null;
        blocks: StateBlock[];
    };
};

type RulesCoreDetail = {
    document?: unknown;
    editionDisplayName?: string;
};

type RulesCoreTemplateStatsDetail = {
    templateId?: string;
    combatStats?: MonsterCombatStats | null;
};

type HealthSnapshot = {
    current: number | null;
    max: number | null;
};

const gateway = "/tool-host/rules-core/api/upstream";
const templateStats = new Map<string, MonsterCombatStats | null>();
const pendingTemplates = new Set<string>();
let lastPreview: PreviewDetail | null = null;
let lastState: StateDetail | null = null;
let statsHidden = false;
let showActiveBlock = false;
let initialized = false;

export function initializeCombatantQuickStatsUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    installStyles(root.ownerDocument);

    window.addEventListener("block-initiative:preview", event => {
        lastPreview = (event as CustomEvent<PreviewDetail>).detail ?? null;
        pruneActedRounds(new Set(
            lastPreview?.response.orderedCombatants
                .map(combatant => combatant.id)
            ?? []));
        requestEnhancement();
    });

    window.addEventListener("block-initiative:rules-core-template-link", event => {
        const detail = (event as CustomEvent<RulesCoreTemplateStatsDetail>).detail;
        const templateId = detail?.templateId?.trim();
        if (!templateId || !detail.combatStats) return;
        templateStats.set(templateId, detail.combatStats);
        requestEnhancement();
    });

    window.addEventListener("block-initiative:state", event => {
        const detail = (event as CustomEvent<StateDetail>).detail ?? null;
        lastState = detail;
        if (detail?.request?.advanceCount === 0 && (detail.request.resumeRound === null || detail.request.resumeRound === undefined)) {
            clearActedRounds();
        }
        requestEnhancement();
    });

    // The base application still owns encounter state and progression. This
    // early hook only changes the presentation from an active-block-only view
    // into one scrollable block list so each combatant appears exactly once.
    registerAfterRender("all-block-runner-layout", 20, () => ensureAllBlocksRunner(root));
    registerAfterRender("combatant-quick-stats", 120, () => enhance(root));
}

function ensureAllBlocksRunner(root: HTMLElement): void {
    const state = lastState?.response;
    const preview = lastPreview?.response;
    if (!state || !preview?.orderedCombatants.length || !state.blocks.length) return;

    const runner = root.querySelector<HTMLElement>("[data-role='results'] > section.card.card-body.bi-grid")
        ?? root.querySelector<HTMLElement>(".bi-active")?.closest<HTMLElement>("section.card.card-body.bi-grid");
    if (!runner) return;

    ensureRunnerControls(runner, root);

    const signature = JSON.stringify({
        blocks: state.blocks.map(block => [block.id, block.allianceId, block.blockType, block.memberOrder]),
        combatants: preview.orderedCombatants.map(combatant => [
            combatant.id,
            combatant.name,
            combatant.tacticalGroupId ?? "",
            combatant.tacticalGroupId ? groupName(root, combatant.tacticalGroupId) : "",
            combatant.blockType
        ])
    });
    let stack = runner.querySelector<HTMLElement>(":scope > [data-runner-blocks]");
    if (stack?.dataset.runnerSignature === signature) {
        applyActivePresentation(root);
        return;
    }

    const originalActive = runner.querySelector<HTMLElement>(":scope > .bi-active:not([data-runner-block])");
    originalActive?.remove();

    if (!stack) {
        stack = document.createElement("div");
        stack.className = "bi-runner-blocks";
        stack.dataset.runnerBlocks = "true";
        const sequence = runner.querySelector<HTMLElement>(":scope > .bi-sequence");
        const actions = runner.querySelector<HTMLElement>(":scope > .bi-actions");
        if (sequence) runner.insertBefore(stack, sequence);
        else if (actions) runner.insertBefore(stack, actions);
        else runner.append(stack);
    }

    stack.dataset.runnerSignature = signature;
    const reusableCards = collectEncounterCards(stack);
    stack.replaceChildren();
    const byId = new Map(preview.orderedCombatants.map(combatant => [combatant.id, combatant]));

    state.blocks.forEach((block, blockIndex) => {
        const section = document.createElement("section");
        section.className = `bi-runner-block bi-grid${block.id === state.activeBlockId ? " bi-active" : ""}`;
        section.dataset.runnerBlock = "true";
        section.dataset.blockId = block.id;
        section.dataset.blockIndex = String(blockIndex);

        const head = document.createElement("div");
        head.className = "bi-runner-block-head bi-row";
        const headingWrap = document.createElement("div");
        const eyebrow = document.createElement("div");
        eyebrow.className = "bi-runner-block-number";
        eyebrow.textContent = `Block ${blockIndex + 1}`;
        const heading = document.createElement("h4");
        heading.className = "h5 mb-0";
        heading.textContent = `${friendly(block.allianceId)} block`;
        headingWrap.append(eyebrow, heading);
        head.append(headingWrap, blockBadges(block.allianceId, block.blockType));
        section.append(head);

        const members = document.createElement("div");
        members.className = "bi-list bi-runner-members";
        for (const combatantId of block.memberOrder) {
            const combatant = byId.get(combatantId);
            const member = renderEncounterCard(reusableCards.get(combatantId), {
                id: combatantId,
                name: combatant?.name ?? combatantId,
                meta: [
                    combatant?.tacticalGroupId ? groupName(root, combatant.tacticalGroupId) : "",
                    combatant?.blockType === "kaiju" ? "Kaiju" : ""
                ]
            });
            members.append(member);
        }
        section.append(members);

        if (block.allianceId === "players" && block.memberOrder.length > 1) {
            const note = document.createElement("div");
            note.className = "bi-muted bi-runner-block-note";
            note.textContent = "Players may act in any order within this block.";
            section.append(note);
        }

        stack.append(section);
    });

    rebuildBlockNavigation(runner, state.blocks, state.activeBlockId);
    applyActivePresentation(root);
}

function ensureRunnerControls(runner: HTMLElement, root: HTMLElement): void {
    const top = runner.querySelector<HTMLElement>(":scope > .bi-row");
    if (!top) return;

    let cluster = top.querySelector<HTMLElement>("[data-role='runner-view-controls']");
    if (!cluster) {
        cluster = document.createElement("div");
        cluster.className = "bi-actions bi-runner-view-controls";
        cluster.dataset.role = "runner-view-controls";

        const activeButton = document.createElement("button");
        activeButton.type = "button";
        activeButton.className = "btn btn-sm btn-outline-secondary";
        activeButton.dataset.action = "toggle-active-block-highlight";
        activeButton.onclick = () => {
            showActiveBlock = !showActiveBlock;
            updateActiveToggle(activeButton);
            applyActivePresentation(root);
        };

        const statsButton = document.createElement("button");
        statsButton.type = "button";
        statsButton.className = "btn btn-sm btn-outline-secondary";
        statsButton.dataset.action = "toggle-combat-stats";
        statsButton.onclick = () => {
            statsHidden = !statsHidden;
            root.classList.toggle("bi-stats-hidden", statsHidden);
            updateStatsToggle(statsButton);
        };

        cluster.append(activeButton, statsButton);
        const edit = top.querySelector<HTMLButtonElement>(":scope > button");
        if (edit) cluster.append(edit);
        top.append(cluster);
    }

    const activeButton = cluster.querySelector<HTMLButtonElement>("[data-action='toggle-active-block-highlight']");
    const statsButton = cluster.querySelector<HTMLButtonElement>("[data-action='toggle-combat-stats']");
    if (activeButton) updateActiveToggle(activeButton);
    if (statsButton) updateStatsToggle(statsButton);
}

function rebuildBlockNavigation(runner: HTMLElement, blocks: StateBlock[], activeBlockId: string | null): void {
    const navigation = runner.querySelector<HTMLElement>(":scope > .bi-sequence");
    if (!navigation) return;
    navigation.replaceChildren();

    blocks.forEach((block, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `bi-seq bi-block-jump${showActiveBlock && block.id === activeBlockId ? " active" : ""}`;
        button.dataset.blockId = block.id;
        const suffix = block.blockType === "kaiju" ? " · Kaiju" : block.blockType === "mixed" ? " · mixed" : "";
        button.textContent = `${index + 1}. ${friendly(block.allianceId)}${suffix}`;
        button.onclick = () => {
            const target = runner.querySelector<HTMLElement>(`[data-runner-block][data-block-id='${cssEscape(block.id)}']`);
            target?.scrollIntoView({ behavior: "smooth", block: "start" });
        };
        navigation.append(button);
    });
}

function applyActivePresentation(root: HTMLElement): void {
    root.classList.toggle("bi-show-active-block", showActiveBlock);
    const activeId = lastState?.response.activeBlockId ?? null;
    for (const block of root.querySelectorAll<HTMLElement>("[data-runner-block]")) {
        block.classList.toggle("bi-active", block.dataset.blockId === activeId);
    }
    for (const chip of root.querySelectorAll<HTMLElement>(".bi-block-jump[data-block-id]")) {
        chip.classList.toggle("active", showActiveBlock && chip.dataset.blockId === activeId);
    }
}

function updateActiveToggle(button: HTMLButtonElement): void {
    button.textContent = showActiveBlock ? "Hide active block" : "Show active block";
    button.setAttribute("aria-pressed", showActiveBlock ? "true" : "false");
    button.title = showActiveBlock
        ? "Remove active-block highlighting while keeping encounter progression available"
        : "Highlight the internally active block for DMs who want guided block progression";
}

function enhance(root: HTMLElement): void {
    queueMissingTemplateStats(root);
    enhanceSetup(root);
    root.classList.toggle("bi-stats-hidden", statsHidden);

    const state = lastState?.response;
    const preview = lastPreview?.response;
    if (!state || !preview?.orderedCombatants.length) return;

    const runner = root.querySelector<HTMLElement>("[data-role='results'] > section.card.card-body.bi-grid")
        ?? root.querySelector<HTMLElement>("[data-runner-block]")?.closest<HTMLElement>("section.card.card-body.bi-grid");
    if (!runner) return;
    ensureRunnerControls(runner, root);

    const byId = new Map(preview.orderedCombatants.map(combatant => [combatant.id, combatant]));
    const templateByCombatant = collectTemplateIds(root);
    const healthByCombatant = collectHealth(root, preview.orderedCombatants);

    for (const row of runner.querySelectorAll<HTMLElement>(".bi-runner-member[data-combatant-id]")) {
        const combatantId = row.dataset.combatantId;
        if (!combatantId) continue;
        const combatant = byId.get(combatantId);
        ensureActedControl(row, combatantId, state.round);

        const card = findCombatantCard(root, combatantId);
        const templateId = templateByCombatant.get(combatantId);
        const imported = templateId ? templateStats.get(templateId) ?? null : null;
        const manual = card ? readManualStats(card) : null;
        const stats = mergeMonsterCombatStats(imported, manual);
        paintQuickStats(row, combatant, stats, healthByCombatant.get(combatantId) ?? null);
    }
}

function enhanceSetup(root: HTMLElement): void {
    for (const card of root.querySelectorAll<HTMLElement>(".bi-entry[data-id]")) {
        if ((card.dataset.alliance ?? "") === "players") continue;
        const panel = ensureManualStatsSetup(card);
        const templateId = card.dataset.templateId;
        const imported = templateId ? templateStats.get(templateId) ?? null : null;
        if (!templateId || !imported) continue;
        applyImportedPlaceholders(panel, imported);
        syncTemplateHealth(card, templateId, imported.maxHp);
    }
}

function ensureManualStatsSetup(card: HTMLElement): HTMLElement {
    const existing = card.querySelector<HTMLElement>(":scope > [data-quick-stats-setup]");
    if (existing) return existing;

    const details = document.createElement("details");
    details.className = "bi-quick-stats-setup";
    details.dataset.quickStatsSetup = "true";
    details.open = !card.dataset.templateId;

    const summary = document.createElement("summary");
    summary.textContent = "Combat stats";

    const body = document.createElement("div");
    body.className = "bi-quick-stats-setup-body";
    const note = document.createElement("div");
    note.className = "bi-note";
    note.textContent = "Optional for manual monsters. Rules Core values remain the default when linked; entered values override them. HP is configured in Enemy health. Initiative modifier is used by the initiative roller.";

    const basics = document.createElement("div");
    basics.className = "bi-quick-stats-entry-grid";
    basics.append(
        textEntryField("AC", "armor-class", "e.g. 15"),
        textEntryField("Touch AC", "touch-armor-class", "e.g. 12"),
        textEntryField("Flat-Footed AC", "flat-footed-armor-class", "e.g. 13"),
        textEntryField("Speed", "speed", "e.g. 30 ft.")
    );

    const modifier = card.querySelector<HTMLInputElement>("[data-field='modifier']");
    const modifierWrap = modifier?.closest<HTMLElement>(".bi-field");
    if (modifierWrap) basics.append(modifierWrap);

    const abilities = document.createElement("div");
    abilities.className = "bi-quick-stat-entry-abilities";
    for (const key of abilityKeys) abilities.append(abilityEntryField(key));

    const defenses = document.createElement("div");
    defenses.className = "bi-quick-stats-defense-entry";
    defenses.append(
        textEntryField("Vulnerabilities", "vulnerabilities", "e.g. cold"),
        textEntryField("Resistances", "resistances", "e.g. fire 10"),
        textEntryField("Immunities", "immunities", "e.g. poison"),
        textEntryField("Condition immunities", "condition-immunities", "e.g. charmed"),
        textEntryField("Damage reduction", "damage-reduction", "e.g. 10/adamantine")
    );

    body.append(note, basics, abilities, defenses);
    details.append(summary, body);

    const anchor = card.querySelector<HTMLElement>(":scope > .bi-condition-setup")
        ?? card.querySelector<HTMLElement>(":scope > [data-combat-setup]");
    anchor ? card.insertBefore(details, anchor) : card.append(details);
    return details;
}

function abilityEntryField(key: AbilityKey): HTMLElement {
    const cell = document.createElement("div");
    cell.className = "bi-quick-stat-entry-ability";

    const heading = document.createElement("strong");
    heading.textContent = key;

    const score = document.createElement("div");
    score.className = "bi-field";
    const scoreLabel = document.createElement("label");
    scoreLabel.textContent = "Score";
    const scoreInput = document.createElement("input");
    scoreInput.type = "number";
    applyNumberLimits(scoreInput, TRACKER_LIMITS);
    scoreInput.dataset.quickStat = `${key.toLowerCase()}-score`;
    score.append(scoreLabel, scoreInput);

    const save = document.createElement("div");
    save.className = "bi-field";
    const saveLabel = document.createElement("label");
    saveLabel.textContent = "Save";
    const saveInput = document.createElement("input");
    saveInput.type = "number";
    applyNumberLimits(saveInput, TRACKER_LIMITS);
    saveInput.placeholder = "Optional";
    saveInput.dataset.quickStat = `${key.toLowerCase()}-save`;
    save.append(saveLabel, saveInput);

    cell.append(heading, score, save);
    return cell;
}

function textEntryField(labelText: string, key: string, placeholder: string): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "bi-field";
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.dataset.quickStat = key;
    input.placeholder = placeholder;
    wrap.append(label, input);
    return wrap;
}

function applyImportedPlaceholders(panel: HTMLElement, stats: MonsterCombatStats): void {
    setPlaceholder(panel, "armor-class", stats.armorClass);
    setPlaceholder(panel, "touch-armor-class", stats.touchArmorClass);
    setPlaceholder(
        panel,
        "flat-footed-armor-class",
        stats.flatFootedArmorClass);
    setPlaceholder(panel, "speed", stats.speed);
    setPlaceholder(panel, "vulnerabilities", stats.vulnerabilities);
    setPlaceholder(panel, "resistances", stats.resistances);
    setPlaceholder(panel, "immunities", stats.immunities);
    setPlaceholder(panel, "condition-immunities", stats.conditionImmunities);
    setPlaceholder(panel, "damage-reduction", stats.damageReduction);

    for (const key of abilityKeys) {
        const ability = stats.abilities[key];
        setPlaceholder(panel, `${key.toLowerCase()}-score`, ability.score === null ? null : String(ability.score));
        setPlaceholder(panel, `${key.toLowerCase()}-save`, ability.save === null ? null : signed(ability.save));
    }
}

function setPlaceholder(panel: HTMLElement, key: string, value: string | null): void {
    if (!value) return;
    const input = panel.querySelector<HTMLInputElement>(`[data-quick-stat='${key}']`);
    if (input && !input.value.trim()) input.placeholder = value;
}

function syncTemplateHealth(card: HTMLElement, templateId: string, maxHp: number | null): void {
    if (maxHp === null) return;
    const health = card.querySelector<HTMLElement>(":scope > [data-combat-setup='standard']");
    if (!health) return;

    const maxInput = findLabeledInput(health, "Max HP");
    const currentInput = findLabeledInput(health, "Current HP");
    if (!maxInput || !currentInput) return;

    const next = String(maxHp);
    const previous = card.dataset.quickStatsSeededHp;
    const previousTemplate = card.dataset.quickStatsHealthTemplate;
    if (previousTemplate === templateId && maxInput.value.trim()) return;

    const canReplaceMax = !maxInput.value.trim() || Boolean(previous && maxInput.value.trim() === previous);
    const canReplaceCurrent = !currentInput.value.trim() || Boolean(previous && currentInput.value.trim() === previous);
    if (canReplaceMax) setHealthInput(maxInput, next);
    if (canReplaceCurrent) setHealthInput(currentInput, next);

    card.dataset.quickStatsSeededHp = next;
    card.dataset.quickStatsHealthTemplate = templateId;
}

function findLabeledInput(container: HTMLElement, labelText: string): HTMLInputElement | null {
    for (const field of container.querySelectorAll<HTMLElement>(".bi-field")) {
        if (field.querySelector("label")?.textContent?.trim() !== labelText) continue;
        return field.querySelector<HTMLInputElement>("input");
    }
    return null;
}

function setHealthInput(input: HTMLInputElement, value: string): void {
    if (input.value === value) return;
    input.value = value;
    input.dispatchEvent(new Event("change", { bubbles: true }));
}

function readManualStats(card: HTMLElement): MonsterCombatStats | null {
    if ((card.dataset.alliance ?? "") === "players") {
        const armorClass =
            readSetupArmorClass(card, "setup-armor-class");
        const touchArmorClass =
            readSetupArmorClass(card, "setup-touch-armor-class");
        const flatFootedArmorClass =
            readSetupArmorClass(card, "setup-flat-footed-armor-class");
        if (!armorClass
            && !touchArmorClass
            && !flatFootedArmorClass) {
            return null;
        }

        const abilities = {} as MonsterCombatStats["abilities"];
        for (const key of abilityKeys) {
            abilities[key] = {
                score: null,
                modifier: null,
                save: null
            };
        }

        return {
            armorClass,
            touchArmorClass,
            flatFootedArmorClass,
            maxHp: null,
            speed: null,
            initiativeModifier: null,
            abilities,
            vulnerabilities: null,
            resistances: null,
            immunities: null,
            conditionImmunities: null,
            damageReduction: null
        };
    }

    const panel = card.querySelector<HTMLElement>(":scope > [data-quick-stats-setup]");
    if (!panel) return null;

    const abilities = {} as MonsterCombatStats["abilities"];
    let hasAbilityValue = false;
    for (const key of abilityKeys) {
        const property = key.toLowerCase();
        const score = readInputNumber(panel, `${property}-score`);
        const modifier = score === null ? null : Math.floor((score - 10) / 2);
        const save = readInputNumber(panel, `${property}-save`);
        abilities[key] = { score, modifier, save };
        if (score !== null || save !== null) hasAbilityValue = true;
    }

    const stats: MonsterCombatStats = {
        armorClass: readInputText(panel, "armor-class"),
        touchArmorClass:
            readInputText(panel, "touch-armor-class"),
        flatFootedArmorClass:
            readInputText(panel, "flat-footed-armor-class"),
        maxHp: null,
        speed: readInputText(panel, "speed"),
        initiativeModifier: null,
        abilities,
        vulnerabilities: readInputText(panel, "vulnerabilities"),
        resistances: readInputText(panel, "resistances"),
        immunities: readInputText(panel, "immunities"),
        conditionImmunities: readInputText(panel, "condition-immunities"),
        damageReduction: readInputText(panel, "damage-reduction")
    };

    const hasScalar = [
        stats.armorClass,
        stats.touchArmorClass,
        stats.flatFootedArmorClass,
        stats.speed,
        stats.vulnerabilities,
        stats.resistances,
        stats.immunities,
        stats.conditionImmunities,
        stats.damageReduction
    ].some(Boolean);
    return hasScalar || hasAbilityValue ? stats : null;
}

function readSetupArmorClass(
    card: HTMLElement,
    role: string
): string | null {
    const value =
        card.querySelector<HTMLInputElement>(
            `:scope > .bi-entry-main [data-role='${role}']`
        )?.value.trim()
        ?? "";
    return value || null;
}

function readInputText(panel: HTMLElement, key: string): string | null {
    const value = panel.querySelector<HTMLInputElement>(`[data-quick-stat='${key}']`)?.value.trim() ?? "";
    return value || null;
}

function readInputNumber(panel: HTMLElement, key: string): number | null {
    const raw = panel.querySelector<HTMLInputElement>(`[data-quick-stat='${key}']`)?.value.trim() ?? "";
    if (!raw) return null;
    return parseBoundedNumber(raw, TRACKER_LIMITS);
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
    }
    mountEncounterCardSlot(row, "acted", label);

    const input = label.querySelector<HTMLInputElement>("input[data-role='acted-toggle']")!;
    input.checked = isCombatantActed(combatantId, round);
    input.setAttribute("aria-label", `Mark combatant as acted in round ${round}`);
    input.onchange = () => {
        setCombatantActed(
            combatantId,
            round,
            input.checked);
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
    const initiative = combatant?.initiativeModifier ?? stats?.initiativeModifier ?? null;
    if (!stats && initiative === null) {
        existing?.remove();
        return;
    }

    const signature = JSON.stringify({ stats, initiative, health });
    if (existing?.dataset.quickStatsSignature === signature) return;

    const panel = existing ?? document.createElement("section");
    panel.className = "bi-quick-stats";
    panel.dataset.quickStatsSignature = signature;
    panel.replaceChildren();

    const facts = document.createElement("div");
    facts.className = "bi-quick-facts";
    appendFact(facts, "AC", stats?.armorClass ?? null);
    appendFact(
        facts,
        "Touch AC",
        stats?.touchArmorClass ?? null);
    appendFact(
        facts,
        "Flat-Footed AC",
        stats?.flatFootedArmorClass ?? null);
    appendFact(facts, "Speed", stats?.speed ?? null);
    appendFact(facts, "Init", initiative === null ? null : signed(initiative));
    if (facts.childElementCount) panel.append(facts);

    if (stats && abilityKeys.some(key => stats.abilities[key].score !== null || stats.abilities[key].save !== null)) {
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

    if (stats) {
        const defenses = document.createElement("div");
        defenses.className = "bi-quick-defenses";
        for (const defense of defenseRows(stats)) appendDefense(defenses, defense.label, defense.value);
        if (defenses.childElementCount) panel.append(defenses);
    }

    mountEncounterCardSlot(row, "quick-stats", panel);
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
            // A successful template-load event is authoritative. Do not let a
            // slower fallback request overwrite combat stats that already came
            // from the Rules Core detail used to create the combatant.
            if (!templateStats.has(templateId)) templateStats.set(templateId, stats);
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
    for (const combatant of combatants) {
        const row = root.querySelector<HTMLElement>(`.bi-health-row[data-combatant-id='${cssEscape(combatant.id)}']`);
        if (!row) continue;
        const status = row.querySelector<HTMLElement>(".bi-statuses")?.textContent ?? "";
        const pair = status.match(/HP\s*(-?\d+)\s*\/\s*(-?\d+)/i);
        if (pair) {
            result.set(combatant.id, { current: Number(pair[1]), max: Number(pair[2]) });
            continue;
        }
        const single = status.match(/HP\s*(-?\d+)/i);
        if (single) result.set(combatant.id, { current: Number(single[1]), max: null });
    }
    return result;
}

function findCombatantCard(root: HTMLElement, combatantId: string): HTMLElement | null {
    for (const card of root.querySelectorAll<HTMLElement>(".bi-entry[data-id]")) {
        if (card.dataset.id === combatantId) return card;
    }
    return null;
}

function groupName(root: HTMLElement, groupId: string): string {
    for (const group of root.querySelectorAll<HTMLElement>(".bi-tactical-group")) {
        if (group.dataset.groupId !== groupId) continue;
        return group.querySelector<HTMLInputElement>("[data-role='group-name']")?.value.trim() || "Group";
    }
    return "Group";
}

function friendly(value: string): string {
    if (value === "players") return "Players";
    if (value === "enemies") return "Enemies";
    return value.split(/[-_ ]+/).filter(Boolean).map(part => part[0]?.toUpperCase() + part.slice(1)).join(" ") || "Other side";
}

function blockBadges(allianceId: string, blockType: StateBlock["blockType"]): HTMLElement {
    const container = document.createElement("div");
    container.className = "bi-badges";
    container.append(simpleBadge(friendly(allianceId)));
    if (blockType === "kaiju") container.append(simpleBadge("Kaiju", true));
    else if (blockType === "mixed") container.append(simpleBadge("Standard + Kaiju", true));
    return container;
}

function simpleBadge(text: string, strong = false): HTMLElement {
    const element = document.createElement("span");
    element.className = `bi-badge${strong ? " bi-kaiju" : ""}`;
    element.textContent = text;
    return element;
}

function cssEscape(value: string): string {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
    return value.replace(/[\\'"\]\[]/g, match => `\\${match}`);
}

function installStyles(documentRef: Document): void {
    if (documentRef.head.querySelector("style[data-role='combatant-quick-stats-style']")) return;
    const style = documentRef.createElement("style");
    style.dataset.role = "combatant-quick-stats-style";
    style.textContent = `
.block-initiative-app .bi-runner-view-controls{margin-left:auto}
.block-initiative-app .bi-runner-blocks{display:grid;gap:1rem}
.block-initiative-app .bi-runner-block{border:1px solid var(--bi-border);border-radius:.65rem;overflow:visible;padding:.7rem;scroll-margin-top:1rem}
.block-initiative-app .bi-runner-block.bi-active{border-width:1px}
.block-initiative-app.bi-show-active-block .bi-runner-block.bi-active{border-width:2px}
.block-initiative-app .bi-runner-block-head{padding-bottom:.5rem;border-bottom:1px solid var(--bi-border)}
.block-initiative-app .bi-runner-block-number{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;opacity:.65}
.block-initiative-app .bi-runner-block-note{padding:.1rem .15rem 0}
.block-initiative-app .bi-block-jump{background:transparent;color:inherit;cursor:pointer}
.block-initiative-app .bi-runner-member{align-items:flex-start;display:flex;flex-wrap:wrap;gap:.5rem;padding:.7rem;border:1px solid var(--bi-border);border-radius:.55rem}
.block-initiative-app .bi-runner-member-identity{display:flex;gap:.45rem;align-items:baseline;min-width:0;flex:1 1 auto}
.block-initiative-app .bi-runner-member.bi-acted{opacity:.62;background:var(--bi-soft)}
.block-initiative-app .bi-acted-toggle{display:flex;gap:.35rem;align-items:center;margin-left:auto;white-space:nowrap;font-size:.84rem;font-weight:600}
.block-initiative-app .bi-acted-toggle input{width:auto!important;min-width:0;padding:0}
.block-initiative-app .bi-quick-stats,.block-initiative-app .bi-integrated-state,.block-initiative-app .bi-integrated-conditions{flex:1 0 100%;width:100%}
.block-initiative-app .bi-quick-stats{display:grid;gap:.42rem;padding-top:.48rem;border-top:1px solid var(--bi-border)}
.block-initiative-app .bi-quick-facts{display:flex;flex-wrap:wrap;gap:.25rem .8rem;font-size:.88rem}
.block-initiative-app .bi-quick-abilities{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.3rem .45rem}
.block-initiative-app .bi-quick-ability{display:grid;grid-template-columns:2.1rem 2.2rem 2.4rem 2.5rem;gap:.2rem;align-items:baseline;padding:.25rem .35rem;border:1px solid var(--bi-border);border-radius:.35rem;font-variant-numeric:tabular-nums}
.block-initiative-app .bi-quick-ability-label{font-size:.58rem;line-height:1;text-transform:uppercase;opacity:.58;text-align:right}
.block-initiative-app .bi-quick-ability>strong{font-size:.76rem}
.block-initiative-app .bi-quick-ability>span:not(.bi-quick-ability-label){font-size:.82rem;text-align:right}
.block-initiative-app .bi-quick-defenses{display:grid;gap:.16rem;font-size:.82rem}
.block-initiative-app .bi-integrated-state{display:grid;gap:.45rem}
.block-initiative-app .bi-integrated-health,.block-initiative-app .bi-integrated-kaiju{margin:0;border-radius:.45rem}
.block-initiative-app .bi-integrated-health>.bi-row>strong{display:none}
.block-initiative-app .bi-integrated-health.active,.block-initiative-app .bi-integrated-kaiju.active{border-width:1px}
.block-initiative-app.bi-show-active-block .bi-integrated-health.active,.block-initiative-app.bi-show-active-block .bi-integrated-kaiju.active{border-width:2px}
.block-initiative-app .bi-integrated-conditions{display:grid;grid-template-columns:auto 1fr;gap:.55rem;align-items:center;padding-top:.45rem;border-top:1px solid var(--bi-border)}
.block-initiative-app .bi-integrated-conditions .bi-condition-editor{min-width:0}
.block-initiative-app .bi-quick-stats-setup{border-top:1px solid var(--bi-border);padding-top:.55rem}
.block-initiative-app .bi-quick-stats-setup>summary{font-weight:700}
.block-initiative-app .bi-quick-stats-setup-body{display:grid;gap:.6rem;margin-top:.55rem}
.block-initiative-app .bi-quick-stats-entry-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.55rem}
.block-initiative-app .bi-quick-stat-entry-abilities{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.45rem}
.block-initiative-app .bi-quick-stat-entry-ability{display:grid;grid-template-columns:auto 1fr 1fr;gap:.4rem;align-items:end;border:1px solid var(--bi-border);border-radius:.45rem;padding:.45rem}
.block-initiative-app .bi-quick-stat-entry-ability>strong{align-self:center}
.block-initiative-app .bi-quick-stats-defense-entry{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.55rem}
.block-initiative-app.bi-stats-hidden .bi-quick-stats,
.block-initiative-app.bi-stats-hidden .bi-integrated-state{display:none!important}
@media(max-width:760px){
.block-initiative-app .bi-quick-abilities,.block-initiative-app .bi-quick-stat-entry-abilities{grid-template-columns:repeat(2,minmax(0,1fr))}
.block-initiative-app .bi-quick-stats-entry-grid,.block-initiative-app .bi-quick-stats-defense-entry{grid-template-columns:1fr 1fr}
.block-initiative-app .bi-integrated-conditions{grid-template-columns:1fr}
}
@media(max-width:500px){
.block-initiative-app .bi-quick-abilities,.block-initiative-app .bi-quick-stat-entry-abilities,.block-initiative-app .bi-quick-stats-entry-grid,.block-initiative-app .bi-quick-stats-defense-entry{grid-template-columns:1fr}
.block-initiative-app .bi-quick-ability{grid-template-columns:2.4rem 2.4rem 2.6rem 2.8rem}
.block-initiative-app .bi-runner-member-identity{flex-direction:column;gap:.1rem}
}
`;
    documentRef.head.append(style);
}

function signed(value: number): string {
    return `${value >= 0 ? "+" : ""}${value}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
