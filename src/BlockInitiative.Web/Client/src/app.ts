import { loadInitiativeTurnState, previewInitiative } from "./api";
import type {
    InitiativeCombatantInput,
    InitiativePreviewRequest,
    InitiativePreviewResponse,
    InitiativeTurnStateResponse,
    TacticalGroupInitiativeMode,
    TurnBlockType
} from "./api";
import { initiativePreviewUrl, initiativeStateUrl, loadToolHostContext } from "./host";
import type { ToolHostContext } from "./host";
import { loadMonsterTemplate, searchRulesCoreMonsters } from "./rules-core-monsters";
import type { MonsterSearchMatch, MonsterTemplate } from "./rules-core-monsters";

type CombatantBlockType = Exclude<TurnBlockType, "mixed">;
type RunnerSession = {
    request: InitiativePreviewRequest;
    preview: InitiativePreviewResponse;
    state: InitiativeTurnStateResponse;
};

const root = document.getElementById("tool-root");
if (!(root instanceof HTMLElement)) {
    throw new Error("Block Initiative could not find the Dorks & Dice tool root.");
}

root.replaceChildren();
root.classList.add("block-initiative-app");

const style = document.createElement("style");
style.textContent = `
.block-initiative-app{--bi-border:rgba(127,127,127,.28);--bi-soft:rgba(127,127,127,.08)}
.block-initiative-app .bi-grid,.block-initiative-app .bi-list{display:grid;gap:.75rem}
.block-initiative-app .bi-steps,.block-initiative-app .bi-sides{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}
.block-initiative-app .bi-steps{grid-template-columns:repeat(3,minmax(0,1fr))}
.block-initiative-app .bi-step,.block-initiative-app .bi-side,.block-initiative-app .bi-entry,.block-initiative-app .bi-block,.block-initiative-app .bi-active,.block-initiative-app .bi-tactical-group{border:1px solid var(--bi-border);border-radius:.65rem}
.block-initiative-app .bi-step,.block-initiative-app .bi-entry,.block-initiative-app .bi-active{padding:.75rem}
.block-initiative-app .bi-side,.block-initiative-app .bi-tactical-group{overflow:visible}
.block-initiative-app .bi-side-head,.block-initiative-app .bi-block-head,.block-initiative-app .bi-group-head{display:flex;justify-content:space-between;gap:.6rem;align-items:start;padding:.7rem;background:var(--bi-soft);border-bottom:1px solid var(--bi-border)}
.block-initiative-app .bi-side-body,.block-initiative-app .bi-block-body,.block-initiative-app .bi-group-body{padding:.7rem}.block-initiative-app .bi-side-body,.block-initiative-app .bi-group-body{display:grid;gap:.55rem}
.block-initiative-app .bi-entry-main{display:grid;grid-template-columns:minmax(11rem,1.7fr) minmax(6rem,.6fr) auto;gap:.5rem;align-items:end}.block-initiative-app .bi-entry-main.custom{grid-template-columns:1.3fr 1fr .6fr auto}
.block-initiative-app .bi-field{display:grid;gap:.2rem;position:relative}.block-initiative-app .bi-field label{font-size:.82rem;font-weight:600;opacity:.8}.block-initiative-app input,.block-initiative-app select{width:100%;min-width:0;padding:.4rem .5rem}
.block-initiative-app .bi-row,.block-initiative-app .bi-actions,.block-initiative-app .bi-badges,.block-initiative-app .bi-sequence{display:flex;flex-wrap:wrap;gap:.45rem;align-items:center}.block-initiative-app .bi-row{justify-content:space-between}.block-initiative-app .bi-actions{justify-content:flex-end}
.block-initiative-app .bi-badge,.block-initiative-app .bi-seq{border:1px solid currentColor;border-radius:999px;padding:.15rem .5rem;font-size:.8rem}.block-initiative-app .bi-seq.active{border-width:2px;font-weight:700}.block-initiative-app .bi-kaiju{font-weight:700}
.block-initiative-app .bi-muted{opacity:.72}.block-initiative-app .bi-message{border-left:4px solid currentColor;padding:.65rem .8rem}.block-initiative-app .bi-warning{background:rgba(180,130,0,.08)}.block-initiative-app .bi-success{background:rgba(0,130,70,.08)}.block-initiative-app .bi-error{background:rgba(180,0,0,.08)}
.block-initiative-app .bi-blocks{display:grid;gap:.6rem}.block-initiative-app .bi-member{display:flex;justify-content:space-between;gap:.5rem;padding:.3rem 0;border-bottom:1px solid var(--bi-border)}.block-initiative-app .bi-member:last-child{border-bottom:0}
.block-initiative-app .bi-primary{border-top:1px solid var(--bi-border);margin-top:.8rem;padding-top:.8rem}.block-initiative-app details{margin-top:.55rem}.block-initiative-app summary{cursor:pointer}.block-initiative-app .bi-advanced{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.55rem;margin-top:.55rem}
.block-initiative-app .bi-active{border-width:2px}.block-initiative-app .bi-active h4{margin-bottom:.2rem}.block-initiative-app .bi-runner-member{padding:.5rem;border:1px solid var(--bi-border);border-radius:.45rem}
.block-initiative-app .bi-enemy-options{display:grid;grid-template-columns:minmax(12rem,1fr) 2fr;gap:.7rem;align-items:end;padding:.65rem;border:1px solid var(--bi-border);border-radius:.55rem;background:var(--bi-soft)}
.block-initiative-app .bi-groups{display:grid;gap:.7rem}.block-initiative-app .bi-group-name{font-weight:700;border:0;background:transparent;padding:.1rem 0;max-width:18rem}.block-initiative-app .bi-group-name:focus{background:var(--bs-body-bg,white);border:1px solid var(--bi-border);padding:.25rem}
.block-initiative-app .bi-monster-meta{font-size:.82rem;opacity:.78;margin-top:.4rem}.block-initiative-app .bi-template-actions{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.45rem}
.block-initiative-app .bi-autocomplete{position:absolute;z-index:20;top:100%;left:0;right:0;border:1px solid var(--bi-border);border-radius:.45rem;background:var(--bs-body-bg,#fff);box-shadow:0 .35rem 1rem rgba(0,0,0,.15);overflow:hidden;margin-top:.15rem}
.block-initiative-app .bi-autocomplete button{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--bi-border);background:transparent;padding:.5rem .6rem}.block-initiative-app .bi-autocomplete button:last-child{border-bottom:0}.block-initiative-app .bi-autocomplete button:hover,.block-initiative-app .bi-autocomplete button:focus{background:var(--bi-soft)}
.block-initiative-app .bi-autocomplete strong,.block-initiative-app .bi-autocomplete small{display:block}.block-initiative-app .bi-autocomplete small{opacity:.72}
.block-initiative-app .bi-group-roll{min-width:8rem;max-width:11rem}.block-initiative-app .bi-group-summary{font-size:.85rem;opacity:.8}
.block-initiative-app .bi-running-edit-note{margin:.1rem 0 .2rem}
@media(max-width:900px){.block-initiative-app .bi-steps,.block-initiative-app .bi-sides{grid-template-columns:1fr}.block-initiative-app .bi-enemy-options{grid-template-columns:1fr}}
@media(max-width:800px){.block-initiative-app .bi-entry-main,.block-initiative-app .bi-entry-main.custom,.block-initiative-app .bi-advanced{grid-template-columns:1fr 1fr}}
@media(max-width:500px){.block-initiative-app .bi-entry-main,.block-initiative-app .bi-entry-main.custom,.block-initiative-app .bi-advanced{grid-template-columns:1fr}}
`;
root.append(style);

const shell = document.createElement("section");
shell.className = "bi-grid";
shell.innerHTML = `
<header class="bi-grid">
  <div>
    <h2 class="h4 mb-1">Block Initiative</h2>
    <p class="mb-1">Build the encounter roster, derive turn blocks, then run combat from one screen.</p>
    <p class="bi-muted mb-0" data-role="host-status"></p>
  </div>
  <div class="bi-steps">
    <div class="bi-step"><strong>1. Build the roster</strong><div class="bi-muted">Players are simple. Non-player sides can use grouped initiative and Rules Core monster data.</div></div>
    <div class="bi-step"><strong>2. Build blocks</strong><div class="bi-muted">Initiative placement and side determine turn blocks. Adjacent members of one side always share a turn block.</div></div>
    <div class="bi-step"><strong>3. Run combat</strong><div class="bi-muted">Track the active block, health, Kaiju state, and creatures joining mid-fight.</div></div>
  </div>
  <details><summary>How the block rule works</summary><p class="mb-0">Initiative is sorted normally. Consecutive combatants from the same side form one turn block, even when their member block types differ. Players in the same player block may act in any order. If the first and last blocks belong to the same side, the lower block skips its separate round-one activation and joins the higher block across the round boundary.</p></details>
</header>
<section class="card card-body bi-grid" data-role="setup">
  <div><h3 class="h5 mb-1">Set up the encounter</h3><div class="bi-muted">Only name and initiative are required for manual entries. Rules Core can fill monster data when available.</div></div>
  <div class="bi-sides">
    <section class="bi-side">
      <div class="bi-side-head"><div><strong>Players</strong><div class="bi-muted">Player characters and allies</div></div><button class="btn btn-sm btn-outline-primary" data-action="add-player">+ Player</button></div>
      <div class="bi-side-body" data-role="players"></div>
    </section>
    <section class="bi-side">
      <div class="bi-side-head"><div><strong>Enemies</strong><div class="bi-muted">The default non-player side. Add other sides below when the encounter needs them.</div></div><button class="btn btn-sm btn-outline-secondary" data-action="add-kaiju">+ Kaiju</button></div>
      <div class="bi-side-body">
        <div class="bi-enemy-options">
          <div class="bi-field"><label>Non-player initiative method</label><select data-role="enemy-method"><option value="average">Tactical groups — average member rolls</option><option value="individual">Individual rolls — group by placement</option><option value="shared">One roll per tactical group</option></select></div>
          <div class="bi-muted" data-role="enemy-method-help"></div>
        </div>
        <div class="bi-groups" data-role="enemy-groups"></div>
        <div class="bi-row"><button class="btn btn-sm btn-outline-secondary" data-action="add-group">+ Tactical group</button><span class="bi-muted">Groups are roster units; actual turn blocks are always derived from side and initiative placement.</span></div>
        <div class="bi-list" data-role="kaiju-list"></div>
      </div>
    </section>
  </div>
  <details><summary>Other sides</summary><div class="bi-row mt-2"><span class="bi-muted">Add another side, then add Standard or Kaiju blocks within it.</span><button class="btn btn-sm btn-outline-secondary" data-action="add-other">+ Side</button></div><div class="bi-list mt-2" data-role="others"></div></details>
  <div class="bi-row bi-primary"><div><strong data-role="setup-status">Enter at least two combatants.</strong><div class="bi-muted">You can edit and rebuild before or during combat.</div></div><button class="btn btn-primary" data-action="preview">Build initiative blocks</button></div>
</section>
<section data-role="message" hidden></section>
<section class="bi-grid" data-role="results"></section>`;
root.append(shell);

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
let runnerSession: RunnerSession | null = null;
let editingRunningEncounter = false;
const monsterTemplates = new Map<string, MonsterTemplate>();

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

function renderedMonsterName(card: HTMLElement, template: MonsterTemplate): string { return card.dataset.instanceNumber ? `${template.name} ${card.dataset.instanceNumber}` : template.name; }

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
    enemyMethodHelp.textContent = mode === "average" ? "Grouped non-player blocks use a calculated initiative. Roll average rolls every member separately with its own modifier; Single roll uses one d20 plus the group's highest modifier." : mode === "shared" ? "Roll once for each tactical group." : "Every non-player creature uses its own roll; turn blocks are still derived afterward from side and placement.";
    for (const group of enemyGroups.querySelectorAll<HTMLElement>(".bi-tactical-group")) { updateGroupModeUi(group); updateGroupSummary(group); }
}

function updateGroupModeUi(group: HTMLElement): void {
    const mode = currentGroupMode(); const shared = group.querySelector<HTMLElement>("[data-role='shared-roll-wrap']"); if (shared) shared.hidden = mode !== "shared";
    for (const card of group.querySelectorAll<HTMLElement>(".bi-entry[data-id]")) query<HTMLElement>("[data-role='initiative-wrap']", card).hidden = mode === "shared";
}

function updateGroupSummary(group: HTMLElement): void {
    const members = Array.from(group.querySelectorAll<HTMLElement>(".bi-entry[data-id]")); const summary = query<HTMLElement>("[data-role='group-summary']", group); const mode = currentGroupMode();
    let placement = "";
    if (mode === "individual") placement = "individual placement";
    else if (mode === "shared") { const shared = group.querySelector<HTMLInputElement>("[data-role='shared-roll']"); const raw = shared?.value.trim() ?? ""; placement = raw ? `group initiative ${raw}` : "group initiative not entered"; }
    else { const values = members.map(card => Number(field<HTMLInputElement>(card, "initiative").value)).filter(Number.isFinite); placement = values.length === members.length && values.length ? `group initiative ${formatNumber(values.reduce((sum, value) => sum + value, 0) / values.length)}` : "not rolled"; }
    const generic = group.classList.contains("bi-other-side-block");
    const noun = generic ? (members.length === 1 ? "creature" : "creatures") : (members.length === 1 ? "enemy" : "enemies");
    summary.textContent = `${members.length} ${noun} · ${placement}`;
    const cloneButton = group.querySelector<HTMLButtonElement>("[data-action='clone-primary']"); const templates = members.map(card => monsterTemplates.get(card.dataset.id ?? "")).filter((value): value is MonsterTemplate => Boolean(value)); const sameTemplate = templates.length === members.length && templates.length > 0 && templates.every(template => template.match.id === templates[0].match.id); if (cloneButton) { cloneButton.hidden = !sameTemplate; if (sameTemplate) cloneButton.textContent = `+ Another ${templates[0].name}`; }
}

function hydrateEnemyHealth(card: HTMLElement, maxHp: number | null): void {
    if (maxHp === null) return;
    let attempts = 0;
    const apply = () => { const panel = card.querySelector<HTMLElement>("[data-combat-setup='standard']"); if (!panel) { if (attempts++ < 8) window.setTimeout(apply, 0); return; } setLabeledNumber(panel, "Max HP", maxHp); setLabeledNumber(panel, "Current HP", maxHp); };
    window.setTimeout(apply, 0);
}

function setLabeledNumber(scope: HTMLElement, labelText: string, value: number): void {
    for (const wrapper of scope.querySelectorAll<HTMLElement>(".bi-field")) { const label = wrapper.querySelector("label")?.textContent?.trim(); const input = wrapper.querySelector<HTMLInputElement>("input[type='number']"); if (label === labelText && input) { input.value = String(value); input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); return; } }
}

function cards(): HTMLElement[] { return Array.from(shell.querySelectorAll<HTMLElement>(".bi-entry[data-id]")); }
function alliance(card: HTMLElement): string { return card.dataset.custom === "true" ? field<HTMLInputElement>(card, "custom-side").value.trim() : card.dataset.alliance ?? ""; }
function type(card: HTMLElement): CombatantBlockType { return field<HTMLSelectElement>(card, "block-type").value === "kaiju" ? "kaiju" : "standard"; }
function tacticalGroupId(card: HTMLElement): string | null { if (alliance(card) === "players" || type(card) !== "standard" || currentGroupMode() === "individual") return null; return card.closest<HTMLElement>(".bi-tactical-group")?.dataset.groupId || null; }

function updateBadges(card: HTMLElement): void {
    const box = query<HTMLElement>("[data-role='badges']", card); box.replaceChildren(badge(friendly(alliance(card) || card.dataset.alliance || "Other side"))); if (type(card) === "kaiju") box.append(badge("Kaiju", true)); const group = card.closest<HTMLElement>(".bi-tactical-group"); if (group) box.append(badge(group.querySelector<HTMLInputElement>("[data-role='group-name']")?.value || "Group"));
}

function refreshControllers(): void {
    const all = cards().map(card => ({ id: card.dataset.id!, name: field<HTMLInputElement>(card, "name").value.trim() }));
    for (const card of cards()) { const select = field<HTMLSelectElement>(card, "controller"); const old = select.value; select.replaceChildren(new Option("No controller", "")); all.filter(candidate => candidate.id !== card.dataset.id).forEach(candidate => select.add(new Option(candidate.name || "(unnamed)", candidate.id))); if ([...select.options].some(option => option.value === old)) select.value = old; }
}

function changed(): void {
    results.replaceChildren(); setup.hidden = false; clearMessage();
    previewButton.textContent = editingRunningEncounter ? "Review encounter changes" : "Build initiative blocks";
    updateReady();
}

function updateReady(): void {
    const all = cards(); const mode = currentGroupMode(); let ready = all.length >= 2;
    for (const card of all) { if (!field<HTMLInputElement>(card, "name").value.trim() || !alliance(card)) ready = false; const group = card.closest<HTMLElement>(".bi-tactical-group"); const usesShared = mode === "shared" && group && card.dataset.alliance === "enemies" && type(card) === "standard"; const shared = group?.querySelector<HTMLInputElement>("[data-role='shared-roll']"); const initiative = usesShared && shared ? shared.value.trim() : field<HTMLInputElement>(card, "initiative").value.trim(); if (!initiative || !Number.isFinite(Number(initiative))) ready = false; }
    status.textContent = !previewUrl ? "Connecting to the initiative service…" : all.length < 2 ? "Add at least two combatants." : !ready ? "Finish the name and initiative fields above." : editingRunningEncounter ? "Ready to review changes and resume the running encounter." : "Ready to build the initiative blocks.";
    previewButton.disabled = busy || !previewUrl || !ready;
}

function collect(): InitiativeCombatantInput[] {
    const mode = currentGroupMode();
    return cards().map((card, index) => { const name = field<HTMLInputElement>(card, "name").value.trim(); const allianceId = alliance(card); const group = card.closest<HTMLElement>(".bi-tactical-group"); const usesShared = mode === "shared" && group && card.dataset.alliance === "enemies" && type(card) === "standard"; const shared = group?.querySelector<HTMLInputElement>("[data-role='shared-roll']"); const raw = usesShared && shared ? shared.value.trim() : field<HTMLInputElement>(card, "initiative").value.trim(); const modifierRaw = field<HTMLInputElement>(card, "modifier").value.trim(); if (!name) throw new Error(`Combatant ${index + 1} needs a name.`); if (!allianceId) throw new Error(`${name} needs a side.`); if (!raw) throw new Error(`Enter initiative for ${name}.`); const initiativeTotal = Number(raw); const initiativeModifier = modifierRaw ? Number(modifierRaw) : null; if (!Number.isFinite(initiativeTotal) || initiativeModifier !== null && !Number.isFinite(initiativeModifier)) throw new Error(`${name} has an invalid initiative value.`); return { id: card.dataset.id!, name, allianceId, initiativeTotal, initiativeModifier, controllerId: field<HTMLSelectElement>(card, "controller").value || null, tacticalGroupId: tacticalGroupId(card), blockType: type(card) }; });
}

async function buildPreview(manualOrderOverride: string[] | null = null): Promise<void> {
    if (!previewUrl) return; busy = true; updateReady();
    try { const request: InitiativePreviewRequest = { combatants: collect(), manualOrderOverride, tacticalGroupMode: currentGroupMode() }; const preview = await previewInitiative(previewUrl, request); renderPreview(preview, request); results.scrollIntoView({ behavior: "smooth", block: "start" }); }
    catch (error) { showError(error); }
    finally { busy = false; updateReady(); }
}

function renderPreview(preview: InitiativePreviewResponse, request: InitiativePreviewRequest): void {
    results.replaceChildren();
    const summary = document.createElement("section"); summary.className = "card card-body"; const summaryRow = document.createElement("div"); summaryRow.className = "bi-row"; const text = document.createElement("div"); const title = document.createElement("h3"); title.className = "h5 mb-1"; title.textContent = preview.requiresAdjudication ? "One ruling is needed" : editingRunningEncounter ? "Updated initiative blocks are ready" : "Initiative blocks are ready"; const detail = document.createElement("div"); detail.className = "bi-muted"; detail.textContent = preview.requiresAdjudication ? "Resolve the opposing tie below before continuing." : editingRunningEncounter ? "Review the new block order, then resume on the same active turn." : "Review the derived order, then start encounter tracking."; text.append(title, detail); summaryRow.append(text, badge(`${preview.blocks.length} block${preview.blocks.length === 1 ? "" : "s"}`)); summary.append(summaryRow); results.append(summary);
    if (preview.issues.length) results.append(renderTie(preview, request));
    if (preview.usesManualOrderOverride) { const note = document.createElement("div"); note.className = "bi-message bi-success"; note.textContent = "DM tie order applied. Original initiative rolls and tactical-group calculations are unchanged."; results.append(note); }
    const byId = new Map(preview.orderedCombatants.map(combatant => [combatant.id, combatant])); const section = document.createElement("section"); section.className = "card card-body"; const heading = document.createElement("h3"); heading.className = "h5 mb-1"; heading.textContent = "Block order"; const description = document.createElement("p"); description.className = "bi-muted"; description.textContent = "Initiative placement is sorted normally. Every contiguous run from one side becomes one turn block; Standard and Kaiju members can therefore share a side turn without creating consecutive same-side blocks."; section.append(heading, description);
    const list = document.createElement("div"); list.className = "bi-blocks";
    preview.blocks.forEach((block, index) => { const element = document.createElement("article"); element.className = "bi-block"; const head = document.createElement("div"); head.className = "bi-block-head"; const strong = document.createElement("strong"); strong.textContent = `Block ${index + 1}`; head.append(strong, blockBadges(block.allianceId, block.blockType)); const body = document.createElement("div"); body.className = "bi-block-body"; for (const id of block.memberOrder) { const combatant = byId.get(id); const row = document.createElement("div"); row.className = "bi-member"; const name = document.createElement("span"); name.textContent = combatant?.name ?? id; const initiative = document.createElement("span"); initiative.className = "bi-muted"; if (combatant) { const groupLabel = combatant.tacticalGroupId ? ` · ${groupName(combatant.tacticalGroupId)}` : ""; const effective = combatant.effectiveInitiative !== combatant.initiativeTotal ? ` → position ${formatNumber(combatant.effectiveInitiative)}` : ""; const kaiju = combatant.blockType === "kaiju" ? " · Kaiju" : ""; initiative.textContent = `Roll ${formatNumber(combatant.initiativeTotal)}${effective}${groupLabel}${kaiju}`; } row.append(name, initiative); body.append(row); } if (block.allianceId === "players" && block.memberOrder.length > 1) { const note = document.createElement("div"); note.className = "bi-muted mt-2"; note.textContent = "Players in this block may choose their order."; body.append(note); } element.append(head, body); list.append(element); });
    section.append(list, roundBoundary(preview));
    if (!preview.requiresAdjudication) { const action = document.createElement("div"); action.className = "bi-row bi-primary"; const actionText = document.createElement("div"); actionText.innerHTML = editingRunningEncounter ? "<strong>Resume?</strong><div class='bi-muted'>The current round and active side turn will be preserved.</div>" : "<strong>Ready?</strong><div class='bi-muted'>Tracking starts on the first active block in round 1.</div>"; const start = document.createElement("button"); start.className = "btn btn-primary"; start.textContent = editingRunningEncounter ? "Resume encounter" : "Start encounter"; start.onclick = () => void (editingRunningEncounter ? resumeEncounter(request, preview) : startEncounter(request, preview)); action.append(actionText, start); section.append(action); }
    results.append(section);
}

function renderTie(preview: InitiativePreviewResponse, request: InitiativePreviewRequest): HTMLElement {
    const box = document.createElement("section"); box.className = "bi-message bi-warning"; const title = document.createElement("strong"); title.textContent = "DM ruling needed"; const description = document.createElement("p"); description.textContent = "Opposing placements tied. Reorder the tied units only; grouped units stay together."; box.append(title, description);
    for (const issue of preview.issues) { const list = document.createElement("ol"); list.className = "bi-list"; list.dataset.tie = "true"; for (const unit of tieUnits(issue.combatantIds, preview, request)) { const item = document.createElement("li"); item.className = "bi-row"; item.dataset.ids = unit.ids.join(","); const label = document.createElement("strong"); label.textContent = unit.label; const controls = document.createElement("span"); controls.className = "bi-badges"; for (const [buttonLabel, direction] of [["Earlier", -1], ["Later", 1]] as const) { const button = document.createElement("button"); button.className = "btn btn-sm btn-outline-secondary"; button.textContent = buttonLabel; button.onclick = () => move(item, direction); controls.append(button); } item.append(label, controls); list.append(item); } box.append(list); }
    const apply = document.createElement("button"); apply.className = "btn btn-outline-secondary mt-2"; apply.textContent = "Apply DM tie order"; apply.onclick = () => { const order = preview.orderedCombatants.map(combatant => combatant.id); box.querySelectorAll<HTMLOListElement>("[data-tie='true']").forEach(list => { const units = Array.from(list.querySelectorAll<HTMLElement>("[data-ids]")).map(item => (item.dataset.ids ?? "").split(",").filter(Boolean)); const tiedIds = units.flat(); const positions = order.map((id, index) => tiedIds.includes(id) ? index : -1).filter(index => index >= 0).sort((a, b) => a - b); const flattened = units.flat(); positions.forEach((position, index) => { order[position] = flattened[index]; }); }); void buildPreview(order); }; box.append(apply); return box;
}

function tieUnits(ids: string[], preview: InitiativePreviewResponse, request: InitiativePreviewRequest): Array<{ ids: string[]; label: string }> {
    const byId = new Map(preview.orderedCombatants.map(combatant => [combatant.id, combatant])); const units: Array<{ ids: string[]; label: string }> = []; const usedGroups = new Set<string>();
    for (const id of ids) { const combatant = byId.get(id); if (!combatant) continue; if (request.tacticalGroupMode !== "individual" && combatant.tacticalGroupId) { if (usedGroups.has(combatant.tacticalGroupId)) continue; usedGroups.add(combatant.tacticalGroupId); const members = ids.map(candidateId => byId.get(candidateId)).filter(candidate => candidate?.tacticalGroupId === combatant.tacticalGroupId).map(candidate => candidate!); units.push({ ids: members.map(member => member.id), label: `${groupName(combatant.tacticalGroupId)} — ${members.map(member => member.name).join(", ")}` }); } else units.push({ ids: [id], label: `${combatant.name} — ${friendly(combatant.allianceId)}` }); }
    return units;
}

function move(element: HTMLElement, direction: -1 | 1): void { const sibling = direction < 0 ? element.previousElementSibling : element.nextElementSibling; if (!sibling) return; if (direction < 0) element.parentElement?.insertBefore(element, sibling); else element.parentElement?.insertBefore(sibling, element); }

function roundBoundary(preview: InitiativePreviewResponse): HTMLElement {
    const container = document.createElement("div"); container.className = "bi-list mt-3"; const title = document.createElement("strong"); title.textContent = "Round boundary"; const note = document.createElement("div"); note.className = "bi-message bi-warning";
    if (!preview.cyclicMerge) note.textContent = `After Block ${preview.blocks.length}, return to Block 1 for the next round.`;
    else { const bottom = preview.blocks.findIndex(block => block.id === preview.cyclicMerge!.bottomBlockId) + 1; const top = preview.blocks.findIndex(block => block.id === preview.cyclicMerge!.topBlockId) + 1; note.textContent = `Round 1: Block ${bottom} does not take a separate activation. It joins same-side Block ${top}, which remains at the higher initiative position from round 2 onward.`; }
    container.append(title, note); return container;
}

async function startEncounter(request: InitiativePreviewRequest, preview: InitiativePreviewResponse): Promise<void> {
    if (!stateUrl) return;
    setup.hidden = true;
    editingRunningEncounter = false;
    results.innerHTML = '<section class="card card-body">Loading encounter…</section>';
    try {
        const state = await loadInitiativeTurnState(stateUrl, { ...request, advanceCount: 0 });
        runnerSession = { request, preview, state };
        renderRunnerState();
    } catch (error) {
        setup.hidden = false;
        results.replaceChildren();
        showError(error);
    }
}

async function resumeEncounter(request: InitiativePreviewRequest, preview: InitiativePreviewResponse): Promise<void> {
    if (!stateUrl || !runnerSession) return;
    const active = runnerSession.state.blocks.find(block => block.id === runnerSession!.state.activeBlockId);
    const availableIds = new Set(request.combatants.map(combatant => combatant.id));
    const anchor = active?.memberOrder.find(id => availableIds.has(id));
    if (!anchor) {
        showError(new Error("Keep at least one combatant from the currently active block so the running encounter can be resumed."));
        return;
    }

    results.innerHTML = '<section class="card card-body">Resuming encounter…</section>';
    try {
        const state = await loadInitiativeTurnState(stateUrl, {
            ...request,
            advanceCount: 0,
            resumeRound: runnerSession.state.round,
            resumeActiveCombatantId: anchor,
            resumeCyclicMergeCompleted: runnerSession.state.cyclicMergeCompleted
        });
        runnerSession = { request, preview, state };
        editingRunningEncounter = false;
        setup.querySelector("[data-role='running-edit-note']")?.remove();
        previewButton.textContent = "Build initiative blocks";
        setup.hidden = true;
        renderRunnerState();
    } catch (error) {
        setup.hidden = false;
        results.replaceChildren();
        showError(error);
    }
}

async function advanceRunner(): Promise<void> {
    if (!stateUrl || !runnerSession) return;
    const active = runnerSession.state.blocks.find(block => block.id === runnerSession!.state.activeBlockId);
    const anchor = active?.memberOrder[0];
    if (!anchor) return;

    results.innerHTML = '<section class="card card-body">Advancing encounter…</section>';
    try {
        const state = await loadInitiativeTurnState(stateUrl, {
            ...runnerSession.request,
            advanceCount: 1,
            resumeRound: runnerSession.state.round,
            resumeActiveCombatantId: anchor,
            resumeCyclicMergeCompleted: runnerSession.state.cyclicMergeCompleted
        });
        runnerSession = { ...runnerSession, state };
        renderRunnerState();
    } catch (error) {
        results.replaceChildren();
        showError(error);
    }
}

function beginRunningEdit(): void {
    if (!runnerSession) return;
    editingRunningEncounter = true;
    setup.hidden = false;
    results.replaceChildren();
    previewButton.textContent = "Review encounter changes";
    let note = setup.querySelector<HTMLElement>("[data-role='running-edit-note']");
    if (!note) {
        note = document.createElement("div");
        note.dataset.role = "running-edit-note";
        note.className = "bi-message bi-warning bi-running-edit-note";
        setup.insertBefore(note, setup.children[1] ?? null);
    }
    note.textContent = `Editing the running encounter in round ${runnerSession.state.round}. Add combatants to an existing side or create a new side below, then review the updated blocks. The current active turn will be preserved.`;
    updateReady();
    setup.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderRunnerState(): void {
    if (!runnerSession) return;
    const { preview, state } = runnerSession;
    results.replaceChildren(); const byId = new Map(preview.orderedCombatants.map(combatant => [combatant.id, combatant])); const activeIndex = state.blocks.findIndex(block => block.id === state.activeBlockId); const active = activeIndex >= 0 ? state.blocks[activeIndex] : null;
    const card = document.createElement("section"); card.className = "card card-body bi-grid"; const top = document.createElement("div"); top.className = "bi-row"; const title = document.createElement("div"); const round = document.createElement("strong"); round.textContent = `Round ${state.round}`; const heading = document.createElement("h3"); heading.className = "h5 mb-0"; heading.textContent = active ? `Block ${activeIndex + 1} is active` : "Encounter"; title.append(round, heading); const edit = document.createElement("button"); edit.className = "btn btn-sm btn-outline-secondary"; edit.textContent = "Add / edit combatants"; edit.onclick = () => beginRunningEdit(); top.append(title, edit); card.append(top);
    if (state.lastAdvance?.cyclicMergeCompleted) { const note = document.createElement("div"); note.className = "bi-message bi-success"; note.textContent = "Round 1 complete. The lower same-side block joined the higher initiative block for round 2 onward."; card.append(note); }
    else if (state.lastAdvance?.roundAdvanced) { const note = document.createElement("div"); note.className = "bi-message bi-success"; note.textContent = `Round ${state.round} started.`; card.append(note); }
    if (active) { const activePanel = document.createElement("div"); activePanel.className = "bi-active bi-grid"; const head = document.createElement("div"); head.className = "bi-row"; const text = document.createElement("div"); const activeHeading = document.createElement("h4"); activeHeading.className = "h5 mb-0"; activeHeading.textContent = `${friendly(active.allianceId)} block`; const hint = document.createElement("div"); hint.className = "bi-muted"; hint.textContent = "Finish this side turn before advancing."; text.append(activeHeading, hint); head.append(text, blockBadges(active.allianceId, active.blockType)); activePanel.append(head); const members = document.createElement("div"); members.className = "bi-list"; for (const id of active.memberOrder) { const combatant = byId.get(id); const member = document.createElement("div"); member.className = "bi-runner-member bi-row"; const name = document.createElement("strong"); name.textContent = combatant?.name ?? id; const meta = document.createElement("span"); meta.className = "bi-muted"; const labels = [combatant?.tacticalGroupId ? groupName(combatant.tacticalGroupId) : "", combatant?.blockType === "kaiju" ? "Kaiju" : ""].filter(Boolean); meta.textContent = labels.join(" · "); member.append(name, meta); members.append(member); } activePanel.append(members); if (active.allianceId === "players" && active.memberOrder.length > 1) { const note = document.createElement("div"); note.className = "bi-muted"; note.textContent = "Players may act in any order within this block."; activePanel.append(note); } card.append(activePanel); }
    const sequence = document.createElement("div"); sequence.className = "bi-sequence"; state.blocks.forEach((block, index) => { const chip = document.createElement("span"); chip.className = `bi-seq${block.id === state.activeBlockId ? " active" : ""}`; const suffix = block.blockType === "kaiju" ? " · Kaiju" : block.blockType === "mixed" ? " · mixed" : ""; chip.textContent = `${index + 1}. ${friendly(block.allianceId)}${suffix}`; sequence.append(chip); }); card.append(sequence);
    const actions = document.createElement("div"); actions.className = "bi-actions bi-primary"; const next = document.createElement("button"); next.className = "btn btn-primary"; next.textContent = "Next block"; next.onclick = () => void advanceRunner(); actions.append(next); card.append(actions); results.append(card);
}

function groupName(groupId: string): string { const group = Array.from(shell.querySelectorAll<HTMLElement>(".bi-tactical-group")).find(candidate => candidate.dataset.groupId === groupId); return group ? group.querySelector<HTMLInputElement>("[data-role='group-name']")?.value.trim() || "Group" : "Group"; }
function friendly(value: string): string { if (value === "players") return "Players"; if (value === "enemies") return "Enemies"; return value.split(/[-_ ]+/).filter(Boolean).map(part => part[0]?.toUpperCase() + part.slice(1)).join(" ") || "Other side"; }
function badge(text: string, strong = false): HTMLElement { const element = document.createElement("span"); element.className = `bi-badge${strong ? " bi-kaiju" : ""}`; element.textContent = text; return element; }
function blockBadges(allianceId: string, blockType: TurnBlockType): HTMLElement { const container = document.createElement("div"); container.className = "bi-badges"; container.append(badge(friendly(allianceId))); if (blockType === "kaiju") container.append(badge("Kaiju", true)); else if (blockType === "mixed") container.append(badge("Standard + Kaiju", true)); return container; }
function formatSigned(value: number): string { return value >= 0 ? `+${value}` : String(value); }
function formatNumber(value: number): string { return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""); }
function clearMessage(): void { message.hidden = true; message.className = ""; message.textContent = ""; }
function showError(error: unknown): void { message.hidden = false; message.className = "bi-message bi-error"; message.textContent = error instanceof Error ? error.message : "Something went wrong."; }
