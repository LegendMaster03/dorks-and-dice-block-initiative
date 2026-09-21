import { previewInitiative } from "./api";
import { mountApplicationShell } from "./application/app-shell";
import { EncounterRunnerController } from "./application/encounter-runner";
import { renderInitiativePreview } from "./application/initiative-preview";
import {
    createBadge,
    formatNumber,
    formatSigned,
    friendlyAlliance
} from "./application/presentation";
import type {
    InitiativeCombatantInput,
    InitiativePreviewRequest,
    TacticalGroupInitiativeMode,
    TurnBlockType
} from "./api";
import { initiativePreviewUrl, initiativeStateUrl, loadToolHostContext } from "./host";
import type { ToolHostContext } from "./host";
import { loadMonsterTemplate, searchRulesCoreMonsters } from "./integrations/rules-core/monsters";
import type { MonsterSearchMatch, MonsterTemplate } from "./integrations/rules-core/monsters";

type CombatantBlockType = Exclude<TurnBlockType, "mixed">;
const root = document.getElementById("tool-root");
if (!(root instanceof HTMLElement)) {
    throw new Error("Block Initiative could not find the Dorks & Dice tool root.");
}

const shell = mountApplicationShell(root);

const setup = query<HTMLElement>("[data-role='setup']");
const players = query<HTMLElement>("[data-role='players']");
const enemyGroups = query<HTMLElement>("[data-role='enemy-groups']");
const kaijuList = query<HTMLElement>("[data-role='kaiju-list']");
const others = query<HTMLElement>("[data-role='others']");
const status = query<HTMLElement>("[data-role='setup-status']");
const hostStatus = query<HTMLElement>("[data-role='host-status']");
const message = query<HTMLElement>("[data-role='message']");
const results = query<HTMLElement>("[data-role='results']");
const previewButton = query<HTMLButtonElement>("[data-action='preview']");
const enemyMethod = query<HTMLSelectElement>("[data-role='enemy-method']");
const enemyMethodHelp = query<HTMLElement>("[data-role='enemy-method-help']");

let previewUrl: string | null = null;
let stateUrl: string | null = null;
let hosted = false;
let busy = false;
let searchSequence = 0;
const monsterTemplates = new Map<string, MonsterTemplate>();

const runner = new EncounterRunnerController({
    results,
    setup,
    previewButton,
    getStateUrl: () => stateUrl,
    groupName,
    showError,
    onEditingChanged: updateReady
});

query<HTMLButtonElement>("[data-action='add-player']").onclick = () => addCombatant("players");
query<HTMLButtonElement>("[data-action='add-kaiju']").onclick = () => addKaiju();
query<HTMLButtonElement>("[data-action='add-other']").onclick = () => addCombatant("other");
query<HTMLButtonElement>("[data-action='add-group']").onclick = () => addTacticalGroup(true);
previewButton.onclick = () => void buildPreview();
enemyMethod.onchange = () => { updateEnemyMethodUi(); changed(); };

addCombatant("players", "standard", false);
addTacticalGroup(false, true);
updateEnemyMethodUi();
updateReady();

const contextUrl = root.dataset.toolContextUrl;
if (!contextUrl) {
    previewUrl = initiativePreviewUrl(null);
    stateUrl = initiativeStateUrl(null);
    hostStatus.textContent = "Standalone development mode. Rules Core autocomplete is available only when hosted by Dorks & Dice.";
    updateReady();
} else {
    hosted = true;
    hostStatus.textContent = "Connecting to Dorks & Dice…";
    try {
        const context: ToolHostContext = await loadToolHostContext(contextUrl);
        previewUrl = initiativePreviewUrl(context);
        stateUrl = initiativeStateUrl(context);
        hostStatus.textContent = context.user
            ? `Signed in as ${context.user.displayName || context.user.id}. Rules Core monster search uses your source access.`
            : "Manual encounters do not require sign-in. Rules Core search shows content available to anonymous access.";
        updateReady();
    } catch (error) {
        showError(error);
    }
}

function query<T extends Element>(selector: string, scope: ParentNode = shell): T {
    const element = scope.querySelector(selector);
    if (!(element instanceof Element)) throw new Error(`Missing ${selector}`);
    return element as T;
}

function field<T extends HTMLElement>(card: HTMLElement, name: string): T {
    const element = card.querySelector(`[data-field='${name}']`);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing ${name}`);
    return element as T;
}

function currentGroupMode(): TacticalGroupInitiativeMode {
    return enemyMethod.value === "individual" || enemyMethod.value === "shared" ? enemyMethod.value : "average";
}

function addTacticalGroup(focus = true, addInitialMember = false): HTMLElement {
    const group = document.createElement("section");
    group.className = "bi-tactical-group";
    group.dataset.groupId = crypto.randomUUID();
    group.innerHTML = `
<div class="bi-group-head">
  <div><input class="bi-group-name" data-role="group-name" value="Enemy Group"><div class="bi-group-summary" data-role="group-summary"></div></div>
  <div class="bi-badges"><div class="bi-field bi-group-roll" data-role="shared-roll-wrap"><label>Group initiative</label><input type="number" step="any" data-role="shared-roll" placeholder="e.g. 14"></div><button class="btn btn-sm btn-outline-secondary" data-action="clone-primary" hidden></button><button class="btn btn-sm btn-outline-danger" data-action="remove-group">Remove group</button></div>
</div>
<div class="bi-group-body"><div class="bi-list" data-role="group-members"></div><button class="btn btn-sm btn-outline-secondary" data-action="add-member">+ Different enemy</button></div>`;
    const nameInput = query<HTMLInputElement>("[data-role='group-name']", group);
    nameInput.value = `Enemy Group ${enemyGroups.querySelectorAll(".bi-tactical-group").length + 1}`;
    nameInput.addEventListener("input", () => changed());
    query<HTMLInputElement>("[data-role='shared-roll']", group).addEventListener("input", () => { updateGroupSummary(group); changed(); });
    query<HTMLButtonElement>("[data-action='add-member']", group).onclick = () => addEnemyToGroup(group, null, true);
    query<HTMLButtonElement>("[data-action='remove-group']", group).onclick = () => {
        for (const card of group.querySelectorAll<HTMLElement>(".bi-entry[data-id]")) monsterTemplates.delete(card.dataset.id ?? "");
        group.remove(); refreshControllers(); changed();
    };
    query<HTMLButtonElement>("[data-action='clone-primary']", group).onclick = () => clonePrimaryMonster(group);
    enemyGroups.append(group);
    if (addInitialMember) addEnemyToGroup(group, null, false);
    updateGroupModeUi(group); updateGroupSummary(group); changed();
    if (focus) nameInput.focus();
    return group;
}

function addEnemyToGroup(group: HTMLElement, template: MonsterTemplate | null, focus = true): HTMLElement {
    const card = addCombatant("enemies", "standard", focus, query<HTMLElement>("[data-role='group-members']", group));
    card.dataset.groupId = group.dataset.groupId ?? "";
    if (template) applyMonsterTemplate(card, template, true);
    updateGroupModeUi(group); updateGroupSummary(group);
    return card;
}

function addKaiju(): void {
    const card = addCombatant("enemies", "kaiju", true, kaijuList);
    card.dataset.groupId = "";
}

function addCombatant(allianceId: string, blockType: CombatantBlockType = "standard", focus = true, target?: HTMLElement): HTMLElement {
    const custom = allianceId !== "players" && allianceId !== "enemies";
    const destination = target ?? (allianceId === "players" ? players : allianceId === "enemies" ? kaijuList : others);
    const card = document.createElement("article");
    card.className = "bi-entry";
    card.dataset.id = crypto.randomUUID(); card.dataset.alliance = allianceId; card.dataset.custom = String(custom); card.dataset.autoName = "false";
    card.innerHTML = `<div class="bi-entry-main ${custom ? "custom" : ""}"><div class="bi-field" data-role="name-field"><label>Name</label><input data-field="name" autocomplete="off" placeholder="${blockType === "kaiju" ? "Kaiju name" : allianceId === "players" ? "Player name" : "Start typing a monster name"}"><div class="bi-autocomplete" data-role="monster-results" hidden></div></div>${custom ? '<div class="bi-field"><label>Side</label><input data-field="custom-side" placeholder="e.g. neutral guards"></div>' : ""}<div class="bi-field" data-role="initiative-wrap"><label>Initiative</label><input data-field="initiative" type="number" step="any" placeholder="e.g. 17"></div><button class="btn btn-sm btn-outline-danger" data-action="remove">Remove</button></div><div class="bi-badges mt-2" data-role="badges"></div><div class="bi-monster-meta" data-role="monster-meta" hidden></div><div class="bi-template-actions" data-role="template-actions" hidden><button class="btn btn-sm btn-outline-secondary" data-action="clone-monster"></button></div><details><summary>Advanced options</summary><div class="bi-advanced"><div class="bi-field"><label>Special block type</label><select data-field="block-type"><option value="standard">Standard block</option><option value="kaiju">Kaiju block</option></select></div><div class="bi-field"><label>Acts with controller</label><select data-field="controller"><option value="">No controller</option></select></div><div class="bi-field"><label>Initiative modifier</label><input data-field="modifier" type="number" step="any" placeholder="Optional"></div><div class="bi-field"><label>Rules Core reference</label><input data-field="rules-reference" readonly placeholder="Manual entry"></div></div></details>`;
    field<HTMLSelectElement>(card, "block-type").value = blockType;
    query<HTMLButtonElement>("[data-action='remove']", card).onclick = () => { const group = card.closest<HTMLElement>(".bi-tactical-group"); monsterTemplates.delete(card.dataset.id ?? ""); card.remove(); if (group) updateGroupSummary(group); refreshControllers(); changed(); };
    card.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select").forEach(element => element.addEventListener("input", () => { if (element.dataset.field === "name") { card.dataset.autoName = "false"; refreshControllers(); } updateBadges(card); const group = card.closest<HTMLElement>(".bi-tactical-group"); if (group) updateGroupSummary(group); changed(); }));
    field<HTMLSelectElement>(card, "block-type").addEventListener("change", () => { const group = card.closest<HTMLElement>(".bi-tactical-group"); if (group && card.dataset.alliance === "enemies" && type(card) === "kaiju") { card.dataset.groupId = ""; kaijuList.append(card); updateGroupSummary(group); } updateBadges(card); changed(); });
    if (allianceId !== "players" && blockType === "standard") attachMonsterAutocomplete(card);
    destination.append(card); updateBadges(card); refreshControllers(); changed(); if (focus) field<HTMLInputElement>(card, "name").focus();
    return card;
}

function attachMonsterAutocomplete(card: HTMLElement): void {
    const input = field<HTMLInputElement>(card, "name");
    const box = query<HTMLElement>("[data-role='monster-results']", card);
    let timer: number | null = null;
    input.addEventListener("input", () => {
        const template = monsterTemplates.get(card.dataset.id ?? "");
        if (template && input.value.trim() !== renderedMonsterName(card, template)) { monsterTemplates.delete(card.dataset.id ?? ""); clearMonsterMetadata(card); }
        if (timer !== null) window.clearTimeout(timer);
        box.hidden = true; box.replaceChildren();
        const queryText = input.value.trim();
        if (!hosted || queryText.length < 2) return;
        const sequence = ++searchSequence;
        timer = window.setTimeout(() => void renderMonsterMatches(card, queryText, sequence), 180);
    });
    input.addEventListener("blur", () => { window.setTimeout(() => { box.hidden = true; }, 160); });
}

async function renderMonsterMatches(card: HTMLElement, queryText: string, sequence: number): Promise<void> {
    const box = query<HTMLElement>("[data-role='monster-results']", card);
    try {
        const matches = await searchRulesCoreMonsters(queryText);
        if (sequence !== searchSequence || field<HTMLInputElement>(card, "name").value.trim() !== queryText) return;
        box.replaceChildren();
        if (!matches.length) { const empty = document.createElement("div"); empty.className = "p-2 bi-muted"; empty.textContent = "No Rules Core monster matches. You can keep the manual name."; box.append(empty); }
        else for (const match of matches) box.append(monsterMatchButton(card, match));
        box.hidden = false;
    } catch (error) {
        if (sequence !== searchSequence) return;
        box.replaceChildren(); const warning = document.createElement("div"); warning.className = "p-2 bi-muted"; warning.textContent = error instanceof Error ? error.message : "Rules Core search is unavailable."; box.append(warning); box.hidden = false;
    }
}

function monsterMatchButton(card: HTMLElement, match: MonsterSearchMatch): HTMLButtonElement {
    const button = document.createElement("button"); button.type = "button";
    const title = document.createElement("strong"); title.textContent = match.displayName;
    const detail = document.createElement("small"); detail.textContent = `${match.sourceCode} · ${match.editionDisplayName}${match.kind === "resolved" ? " · resolved rules" : " · source"}`;
    button.append(title, detail); button.onmousedown = event => event.preventDefault();
    button.onclick = async () => { button.disabled = true; try { const template = await loadMonsterTemplate(match); applyMonsterTemplate(card, template, false); query<HTMLElement>("[data-role='monster-results']", card).hidden = true; } catch (error) { showError(error); } finally { button.disabled = false; } };
    return button;
}

function applyMonsterTemplate(card: HTMLElement, template: MonsterTemplate, cloning: boolean): void {
    const id = card.dataset.id ?? ""; monsterTemplates.set(id, template); card.dataset.templateId = template.match.id; card.dataset.autoName = "true";
    const group = card.closest<HTMLElement>(".bi-tactical-group");
    if (!cloning) field<HTMLInputElement>(card, "name").value = template.name;
    if (template.initiativeModifier !== null) field<HTMLInputElement>(card, "modifier").value = String(template.initiativeModifier);
    field<HTMLInputElement>(card, "rules-reference").value = template.match.conceptKey ? `rule:${template.match.conceptKey}` : `source:${template.match.sourceEntityId}`;
    const meta = query<HTMLElement>("[data-role='monster-meta']", card);
    const facts = [template.maxHp !== null ? `HP ${template.maxHp}` : null, template.armorClass ? `AC ${template.armorClass}` : null, template.initiativeModifier !== null ? `Init ${formatSigned(template.initiativeModifier)}` : null, template.challengeRating ? `CR ${template.challengeRating}` : null, template.match.sourceCode, template.match.editionDisplayName].filter((value): value is string => Boolean(value));
    meta.textContent = `Rules Core: ${facts.join(" · ")}`; meta.hidden = false;
    const actions = query<HTMLElement>("[data-role='template-actions']", card); const clone = query<HTMLButtonElement>("[data-action='clone-monster']", card); clone.textContent = `+ Another ${template.name}`; clone.onclick = () => { const parentGroup = card.closest<HTMLElement>(".bi-tactical-group"); if (parentGroup) cloneMonsterIntoGroup(parentGroup, template); }; actions.hidden = !group;
    if (group) { assignInstanceNames(group, template.match.id, template.name); updateGroupSummary(group); }
    hydrateEnemyHealth(card, template.maxHp); refreshControllers(); changed();
}

function cloneMonsterIntoGroup(group: HTMLElement, template: MonsterTemplate): void {
    if (!group.classList.contains("bi-other-side-block")) {
        addEnemyToGroup(group, template, false);
        return;
    }

    const before = new Set(Array.from(group.querySelectorAll<HTMLElement>(".bi-entry[data-id]")).map(card => card.dataset.id));
    group.querySelector<HTMLButtonElement>("[data-side-action='add-member']")?.click();
    const target = Array.from(group.querySelectorAll<HTMLElement>(".bi-entry[data-id]"))
        .find(card => Boolean(card.dataset.id) && !before.has(card.dataset.id));
    if (target) applyMonsterTemplate(target, template, true);
}

function clearMonsterMetadata(card: HTMLElement): void {
    delete card.dataset.templateId; delete card.dataset.instanceNumber; field<HTMLInputElement>(card, "rules-reference").value = "";
    const meta = query<HTMLElement>("[data-role='monster-meta']", card); meta.hidden = true; meta.textContent = ""; query<HTMLElement>("[data-role='template-actions']", card).hidden = true;
    const group = card.closest<HTMLElement>(".bi-tactical-group"); if (group) updateGroupSummary(group);
}

function assignInstanceNames(group: HTMLElement, templateId: string, baseName: string): void {
    const matching = Array.from(group.querySelectorAll<HTMLElement>(".bi-entry")).filter(card => card.dataset.templateId === templateId);
    if (matching.length < 2) return;
    let next = Math.max(0, ...matching.map(card => Number(card.dataset.instanceNumber ?? 0))) + 1;
    for (const card of matching) if (!card.dataset.instanceNumber) card.dataset.instanceNumber = String(next++);
    const sorted = [...matching].sort((a, b) => Number(a.dataset.instanceNumber) - Number(b.dataset.instanceNumber));
    if (sorted.length >= 2 && Number(sorted[0].dataset.instanceNumber) > 1) sorted[0].dataset.instanceNumber = "1";
    for (const card of sorted) if (card.dataset.autoName === "true") field<HTMLInputElement>(card, "name").value = `${baseName} ${card.dataset.instanceNumber}`;
}


function renderedMonsterName(
    card: HTMLElement,
    template: MonsterTemplate
): string {
    return card.dataset.instanceNumber
        ? `${template.name} ${card.dataset.instanceNumber}`
        : template.name;
}

function clonePrimaryMonster(group: HTMLElement): void {
    const members = Array.from(group.querySelectorAll<HTMLElement>(".bi-entry[data-id]"));
    const templates = members.map(card => monsterTemplates.get(card.dataset.id ?? "")).filter((value): value is MonsterTemplate => Boolean(value));
    if (!templates.length) return;
    const templateId = templates[0].match.id;
    if (!templates.every(template => template.match.id === templateId)) return;
    cloneMonsterIntoGroup(group, templates[0]);
}


function updateEnemyMethodUi(): void {
    const mode = currentGroupMode();

    enemyMethodHelp.textContent =
        mode === "average"
            ? "Grouped non-player blocks use a calculated initiative. "
                + "Roll average rolls every member separately with its own modifier; "
                + "Single roll uses one d20 plus the group's highest modifier."
            : mode === "shared"
                ? "Roll once for each tactical group."
                : "Every non-player creature uses its own roll; turn blocks are "
                    + "still derived afterward from side and placement.";

    for (const group of enemyGroups.querySelectorAll<HTMLElement>(
        ".bi-tactical-group"
    )) {
        updateGroupModeUi(group);
        updateGroupSummary(group);
    }
}


function updateGroupModeUi(group: HTMLElement): void {
    const mode = currentGroupMode();
    const shared =
        group.querySelector<HTMLElement>(
            "[data-role='shared-roll-wrap']");

    if (shared) shared.hidden = mode !== "shared";

    for (const card of group.querySelectorAll<HTMLElement>(
        ".bi-entry[data-id]"
    )) {
        query<HTMLElement>(
            "[data-role='initiative-wrap']",
            card
        ).hidden = mode === "shared";
    }
}


function updateGroupSummary(group: HTMLElement): void {
    const members = Array.from(
        group.querySelectorAll<HTMLElement>(".bi-entry[data-id]")
    );
    const summary = query<HTMLElement>(
        "[data-role='group-summary']",
        group
    );
    const mode = currentGroupMode();

    let placement: string;
    if (mode === "individual") {
        placement = "individual placement";
    } else if (mode === "shared") {
        const shared =
            group.querySelector<HTMLInputElement>(
                "[data-role='shared-roll']");
        const raw = shared?.value.trim() ?? "";
        placement = raw
            ? `group initiative ${raw}`
            : "group initiative not entered";
    } else {
        const values = members
            .map(card =>
                Number(
                    field<HTMLInputElement>(
                        card,
                        "initiative"
                    ).value))
            .filter(Number.isFinite);

        placement =
            values.length === members.length && values.length > 0
                ? `group initiative ${formatNumber(
                    values.reduce(
                        (sum, value) => sum + value,
                        0
                    ) / values.length
                )}`
                : "not rolled";
    }

    const generic = group.classList.contains("bi-other-side-block");
    const noun = generic
        ? members.length === 1 ? "creature" : "creatures"
        : members.length === 1 ? "enemy" : "enemies";

    summary.textContent =
        `${members.length} ${noun} · ${placement}`;

    const cloneButton =
        group.querySelector<HTMLButtonElement>(
            "[data-action='clone-primary']");
    const templates = members
        .map(card => monsterTemplates.get(card.dataset.id ?? ""))
        .filter((value): value is MonsterTemplate => Boolean(value));

    const sameTemplate =
        templates.length === members.length
        && templates.length > 0
        && templates.every(
            template => template.match.id === templates[0].match.id);

    if (!cloneButton) return;

    cloneButton.hidden = !sameTemplate;
    if (sameTemplate) {
        cloneButton.textContent = `+ Another ${templates[0].name}`;
    }
}


function hydrateEnemyHealth(
    card: HTMLElement,
    maxHp: number | null
): void {
    if (maxHp === null) return;

    let attempts = 0;
    const apply = () => {
        const panel =
            card.querySelector<HTMLElement>(
                "[data-combat-setup='standard']");

        if (!panel) {
            if (attempts++ < 8) {
                window.setTimeout(apply, 0);
            }
            return;
        }

        setLabeledNumber(panel, "Max HP", maxHp);
        setLabeledNumber(panel, "Current HP", maxHp);
    };

    window.setTimeout(apply, 0);
}


function setLabeledNumber(
    scope: HTMLElement,
    labelText: string,
    value: number
): void {
    for (const wrapper of scope.querySelectorAll<HTMLElement>(
        ".bi-field"
    )) {
        const label =
            wrapper.querySelector("label")?.textContent?.trim();
        const input =
            wrapper.querySelector<HTMLInputElement>(
                "input[type='number']");

        if (label !== labelText || !input) continue;

        input.value = String(value);
        input.dispatchEvent(
            new Event("input", { bubbles: true }));
        input.dispatchEvent(
            new Event("change", { bubbles: true }));
        return;
    }
}


function cards(): HTMLElement[] {
    return Array.from(
        shell.querySelectorAll<HTMLElement>(".bi-entry[data-id]")
    );
}


function alliance(card: HTMLElement): string {
    return card.dataset.custom === "true"
        ? field<HTMLInputElement>(
            card,
            "custom-side"
        ).value.trim()
        : card.dataset.alliance ?? "";
}


function type(card: HTMLElement): CombatantBlockType {
    return field<HTMLSelectElement>(
        card,
        "block-type"
    ).value === "kaiju"
        ? "kaiju"
        : "standard";
}


function tacticalGroupId(card: HTMLElement): string | null {
    if (alliance(card) === "players"
        || type(card) !== "standard"
        || currentGroupMode() === "individual") {
        return null;
    }

    return card
        .closest<HTMLElement>(".bi-tactical-group")
        ?.dataset.groupId
        || null;
}


function updateBadges(card: HTMLElement): void {
    const box = query<HTMLElement>(
        "[data-role='badges']",
        card
    );
    box.replaceChildren(
        createBadge(
            friendlyAlliance(
                alliance(card)
                || card.dataset.alliance
                || "Other side")));

    if (type(card) === "kaiju") {
        box.append(createBadge("Kaiju", true));
    }

    const group =
        card.closest<HTMLElement>(".bi-tactical-group");
    if (group) {
        box.append(
            createBadge(
                group.querySelector<HTMLInputElement>(
                    "[data-role='group-name']")
                    ?.value
                || "Group"));
    }
}


function refreshControllers(): void {
    const all = cards().map(card => ({
        id: card.dataset.id!,
        name: field<HTMLInputElement>(
            card,
            "name"
        ).value.trim()
    }));

    for (const card of cards()) {
        const select =
            field<HTMLSelectElement>(card, "controller");
        const previous = select.value;

        select.replaceChildren(
            new Option("No controller", ""));

        for (const candidate of all) {
            if (candidate.id === card.dataset.id) continue;

            select.add(
                new Option(
                    candidate.name || "(unnamed)",
                    candidate.id));
        }

        if ([...select.options].some(
            option => option.value === previous
        )) {
            select.value = previous;
        }
    }
}


function changed(): void {
    results.replaceChildren();
    setup.hidden = false;
    clearMessage();

    previewButton.textContent = runner.isEditing
        ? "Review encounter changes"
        : "Build initiative blocks";

    updateReady();
}


function updateReady(): void {
    const all = cards();
    const mode = currentGroupMode();
    let ready = all.length >= 2;

    for (const card of all) {
        const name =
            field<HTMLInputElement>(card, "name").value.trim();

        if (!name || !alliance(card)) {
            ready = false;
        }

        const group =
            card.closest<HTMLElement>(".bi-tactical-group");
        const usesShared =
            mode === "shared"
            && Boolean(group)
            && card.dataset.alliance === "enemies"
            && type(card) === "standard";
        const shared =
            group?.querySelector<HTMLInputElement>(
                "[data-role='shared-roll']");
        const initiative =
            usesShared && shared
                ? shared.value.trim()
                : field<HTMLInputElement>(
                    card,
                    "initiative"
                ).value.trim();

        if (!initiative
            || !Number.isFinite(Number(initiative))) {
            ready = false;
        }
    }

    status.textContent =
        !previewUrl
            ? "Connecting to the initiative service…"
            : all.length < 2
                ? "Add at least two combatants."
                : !ready
                    ? "Finish the name and initiative fields above."
                    : runner.isEditing
                        ? "Ready to review changes and resume the running encounter."
                        : "Ready to build the initiative blocks.";

    previewButton.disabled =
        busy || !previewUrl || !ready;
}


function collect(): InitiativeCombatantInput[] {
    const mode = currentGroupMode();

    return cards().map((card, index) => {
        const name =
            field<HTMLInputElement>(card, "name").value.trim();
        const allianceId = alliance(card);
        const group =
            card.closest<HTMLElement>(".bi-tactical-group");
        const usesShared =
            mode === "shared"
            && Boolean(group)
            && card.dataset.alliance === "enemies"
            && type(card) === "standard";
        const shared =
            group?.querySelector<HTMLInputElement>(
                "[data-role='shared-roll']");
        const raw =
            usesShared && shared
                ? shared.value.trim()
                : field<HTMLInputElement>(
                    card,
                    "initiative"
                ).value.trim();
        const modifierRaw =
            field<HTMLInputElement>(
                card,
                "modifier"
            ).value.trim();

        if (!name) {
            throw new Error(
                `Combatant ${index + 1} needs a name.`);
        }
        if (!allianceId) {
            throw new Error(`${name} needs a side.`);
        }
        if (!raw) {
            throw new Error(
                `Enter initiative for ${name}.`);
        }

        const initiativeTotal = Number(raw);
        const initiativeModifier =
            modifierRaw ? Number(modifierRaw) : null;

        if (!Number.isFinite(initiativeTotal)
            || (
                initiativeModifier !== null
                && !Number.isFinite(initiativeModifier)
            )) {
            throw new Error(
                `${name} has an invalid initiative value.`);
        }

        return {
            id: card.dataset.id!,
            name,
            allianceId,
            initiativeTotal,
            initiativeModifier,
            controllerId:
                field<HTMLSelectElement>(
                    card,
                    "controller"
                ).value
                || null,
            tacticalGroupId: tacticalGroupId(card),
            blockType: type(card)
        };
    });
}

async function buildPreview(
    manualOrderOverride: string[] | null = null
): Promise<void> {
    if (!previewUrl) return;

    busy = true;
    updateReady();

    try {
        const request: InitiativePreviewRequest = {
            combatants: collect(),
            manualOrderOverride,
            tacticalGroupMode: currentGroupMode()
        };
        const preview =
            await previewInitiative(previewUrl, request);

        renderInitiativePreview({
            results,
            preview,
            request,
            editingRunningEncounter: runner.isEditing,
            groupName,
            onApplyManualOrder:
                order => void buildPreview(order),
            onStart:
                () => void runner.start(request, preview),
            onResume:
                () => void runner.resume(request, preview)
        });

        results.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    } catch (error) {
        showError(error);
    } finally {
        busy = false;
        updateReady();
    }
}


function groupName(groupId: string): string {
    const group = Array.from(
        shell.querySelectorAll<HTMLElement>(
            ".bi-tactical-group")
    ).find(candidate =>
        candidate.dataset.groupId === groupId);

    return group
        ? group.querySelector<HTMLInputElement>(
            "[data-role='group-name']")
            ?.value.trim()
            || "Group"
        : "Group";
}


function clearMessage(): void {
    message.hidden = true;
    message.className = "";
    message.textContent = "";
}


function showError(error: unknown): void {
    message.hidden = false;
    message.className = "bi-message bi-error";
    message.textContent =
        error instanceof Error
            ? error.message
            : "Something went wrong.";
}

