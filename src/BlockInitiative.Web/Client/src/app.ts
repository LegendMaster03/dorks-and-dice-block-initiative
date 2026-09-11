import { previewInitiative } from "./api";
import type {
    InitiativeCombatantInput,
    InitiativePreviewResponse,
    TurnBlockType
} from "./api";
import { initiativePreviewUrl, loadToolHostContext } from "./host";
import type { ToolHostContext } from "./host";

const root = document.getElementById("tool-root");
if (!(root instanceof HTMLElement)) {
    throw new Error("Block Initiative could not find the Dorks & Dice tool root.");
}

root.replaceChildren();
root.classList.add("block-initiative-app");

const style = document.createElement("style");
style.textContent = `
.block-initiative-app { --bi-border: rgba(127,127,127,.28); --bi-soft: rgba(127,127,127,.08); }
.block-initiative-app .bi-grid { display: grid; gap: 1rem; }
.block-initiative-app .bi-hero { display: grid; gap: .75rem; }
.block-initiative-app .bi-hero-copy { max-width: 62rem; }
.block-initiative-app .bi-steps { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: .65rem; }
.block-initiative-app .bi-step { border: 1px solid var(--bi-border); border-radius: .65rem; padding: .75rem; }
.block-initiative-app .bi-step strong { display: block; margin-bottom: .2rem; }
.block-initiative-app .bi-step-number { display: inline-grid; place-items: center; width: 1.65rem; height: 1.65rem; border: 1px solid currentColor; border-radius: 999px; margin-right: .35rem; font-size: .82rem; }
.block-initiative-app .bi-side-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 1rem; }
.block-initiative-app .bi-side-panel { border: 1px solid var(--bi-border); border-radius: .7rem; overflow: hidden; }
.block-initiative-app .bi-side-header { display: flex; align-items: start; justify-content: space-between; gap: .75rem; padding: .8rem; border-bottom: 1px solid var(--bi-border); background: var(--bi-soft); }
.block-initiative-app .bi-side-header p { margin: .2rem 0 0; }
.block-initiative-app .bi-entry-list { display: grid; gap: .6rem; padding: .75rem; }
.block-initiative-app .bi-entry { border: 1px solid var(--bi-border); border-radius: .6rem; padding: .7rem; }
.block-initiative-app .bi-entry-main { display: grid; grid-template-columns: minmax(12rem,1.8fr) minmax(7rem,.6fr) auto; gap: .6rem; align-items: end; }
.block-initiative-app .bi-entry-main.bi-entry-main-custom { grid-template-columns: minmax(11rem,1.4fr) minmax(10rem,1fr) minmax(7rem,.6fr) auto; }
.block-initiative-app .bi-entry-meta { display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; margin-top: .5rem; }
.block-initiative-app .bi-field { display: grid; gap: .25rem; }
.block-initiative-app .bi-field label { font-size: .82rem; font-weight: 600; opacity: .82; }
.block-initiative-app input, .block-initiative-app select { width: 100%; min-width: 0; padding: .45rem .55rem; }
.block-initiative-app details { margin-top: .6rem; }
.block-initiative-app details > summary { cursor: pointer; user-select: none; }
.block-initiative-app .bi-advanced-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .65rem; margin-top: .65rem; }
.block-initiative-app .bi-metadata { margin-top: .65rem; padding-top: .65rem; border-top: 1px solid var(--bi-border); }
.block-initiative-app .bi-metadata-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .65rem; margin-top: .5rem; }
.block-initiative-app .bi-other-panel { margin-top: 1rem; border-top: 1px solid var(--bi-border); padding-top: .8rem; }
.block-initiative-app .bi-other-actions { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; justify-content: space-between; }
.block-initiative-app .bi-primary-action { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .8rem; align-items: center; border-top: 1px solid var(--bi-border); margin-top: 1rem; padding-top: 1rem; }
.block-initiative-app .bi-muted { opacity: .72; }
.block-initiative-app .bi-badge { display: inline-block; border: 1px solid currentColor; border-radius: 999px; padding: .12rem .5rem; font-size: .78rem; }
.block-initiative-app .bi-kaiju-badge { font-weight: 700; }
.block-initiative-app .bi-message { border-left: 4px solid currentColor; border-radius: .25rem; padding: .75rem .9rem; }
.block-initiative-app .bi-warning { background: rgba(180,130,0,.08); }
.block-initiative-app .bi-error { background: rgba(180,0,0,.08); }
.block-initiative-app .bi-success { background: rgba(0,130,70,.08); }
.block-initiative-app .bi-results-header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .75rem; align-items: start; }
.block-initiative-app .bi-blocks { display: grid; gap: .7rem; margin-top: .75rem; }
.block-initiative-app .bi-block { border: 1px solid var(--bi-border); border-radius: .65rem; overflow: hidden; }
.block-initiative-app .bi-block-header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .5rem; align-items: center; padding: .65rem .8rem; border-bottom: 1px solid var(--bi-border); background: var(--bi-soft); }
.block-initiative-app .bi-block-body { padding: .75rem .8rem; }
.block-initiative-app .bi-member-list { display: grid; gap: .4rem; margin: 0; padding: 0; list-style: none; }
.block-initiative-app .bi-member { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 1px solid rgba(127,127,127,.15); padding-bottom: .35rem; }
.block-initiative-app .bi-member:last-child { border-bottom: 0; padding-bottom: 0; }
.block-initiative-app .bi-how-to-run { display: grid; gap: .45rem; margin-top: .8rem; }
.block-initiative-app .bi-round-rule { padding: .6rem .7rem; border: 1px solid var(--bi-border); border-radius: .55rem; }
.block-initiative-app .bi-tie-list { display: grid; gap: .4rem; margin: .6rem 0; padding: 0; list-style: none; }
.block-initiative-app .bi-tie-row { display: flex; flex-wrap: wrap; gap: .45rem; align-items: center; padding: .5rem; border: 1px solid var(--bi-border); border-radius: .5rem; }
.block-initiative-app .bi-tie-row strong { flex: 1 1 12rem; }
.block-initiative-app .bi-raw-order { margin-top: .8rem; }
.block-initiative-app button { padding: .45rem .75rem; cursor: pointer; }
.block-initiative-app button:disabled { cursor: not-allowed; opacity: .55; }
@media (max-width: 860px) {
    .block-initiative-app .bi-steps,
    .block-initiative-app .bi-side-grid { grid-template-columns: 1fr; }
    .block-initiative-app .bi-entry-main,
    .block-initiative-app .bi-entry-main.bi-entry-main-custom { grid-template-columns: 1fr 1fr; }
    .block-initiative-app .bi-advanced-grid,
    .block-initiative-app .bi-metadata-grid { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
    .block-initiative-app .bi-entry-main,
    .block-initiative-app .bi-entry-main.bi-entry-main-custom { grid-template-columns: 1fr; }
}
`;
root.append(style);

const container = document.createElement("section");
container.className = "container-fluid px-0 bi-grid";
container.innerHTML = `
    <header class="bi-hero">
        <div class="bi-hero-copy">
            <h2 class="h4 mb-1">Block Initiative</h2>
            <p class="mb-1">Enter the initiative rolls you already have. The tracker sorts them, creates the turn blocks, and tells you how to handle the round boundary.</p>
            <p class="mb-0 bi-muted" data-role="host-status" role="status"></p>
        </div>
        <div class="bi-steps" aria-label="How to use Block Initiative">
            <div class="bi-step"><strong><span class="bi-step-number">1</span>Enter rolls</strong><span class="bi-muted">Add each player and enemy with a name and initiative result.</span></div>
            <div class="bi-step"><strong><span class="bi-step-number">2</span>Build blocks</strong><span class="bi-muted">Adjacent allies become one turn block. Kaiju remain special blocks.</span></div>
            <div class="bi-step"><strong><span class="bi-step-number">3</span>Run top to bottom</strong><span class="bi-muted">Finish each block before moving to the next. The tracker explains any wraparound.</span></div>
        </div>
        <details>
            <summary>How the block rule works</summary>
            <p class="mb-1">Initiative is still rolled normally. After sorting from highest to lowest, consecutive combatants on the same side share a block. Players inside the same player block may act in any order.</p>
            <p class="mb-0">If the first and last blocks are allied, the last block does not act separately in round one. At the start of round two it joins the first block across the round boundary.</p>
        </details>
    </header>

    <section class="card card-body">
        <div class="mb-3">
            <h3 class="h5 mb-1">Set up the encounter</h3>
            <div class="bi-muted">For a normal fight, you only need names and initiative. Character sheets are not required.</div>
        </div>

        <div class="bi-side-grid">
            <section class="bi-side-panel" aria-labelledby="bi-players-heading">
                <div class="bi-side-header">
                    <div>
                        <h4 class="h6 mb-0" id="bi-players-heading">Players</h4>
                        <p class="bi-muted">Add each player character or allied combatant.</p>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-primary" data-action="add-player">+ Player</button>
                </div>
                <div class="bi-entry-list" data-role="players"></div>
            </section>

            <section class="bi-side-panel" aria-labelledby="bi-enemies-heading">
                <div class="bi-side-header">
                    <div>
                        <h4 class="h6 mb-0" id="bi-enemies-heading">Enemies</h4>
                        <p class="bi-muted">Add enemies normally, or add a Kaiju as its own special block type.</p>
                    </div>
                    <div class="d-flex flex-wrap gap-1">
                        <button type="button" class="btn btn-sm btn-outline-secondary" data-action="add-enemy">+ Enemy</button>
                        <button type="button" class="btn btn-sm btn-outline-secondary" data-action="add-kaiju">+ Kaiju</button>
                    </div>
                </div>
                <div class="bi-entry-list" data-role="enemies"></div>
            </section>
        </div>

        <details class="bi-other-panel">
            <summary>Other sides and advanced encounter setup</summary>
            <div class="bi-other-actions mt-2">
                <span class="bi-muted">Use this for neutral factions or encounters with more than two sides.</span>
                <button type="button" class="btn btn-sm btn-outline-secondary" data-action="add-other">+ Other side</button>
            </div>
            <div class="bi-entry-list px-0" data-role="others"></div>
        </details>

        <div class="bi-primary-action">
            <div>
                <strong data-role="setup-status">Enter at least two combatants.</strong>
                <div class="bi-muted">You can change the setup and rebuild at any time.</div>
            </div>
            <button type="button" class="btn btn-primary" data-action="preview">Build initiative blocks</button>
        </div>
    </section>

    <section data-role="message" hidden></section>
    <section data-role="results" class="bi-grid"></section>
`;
root.append(container);

const playersContainer = requireElement<HTMLElement>("[data-role='players']");
const enemiesContainer = requireElement<HTMLElement>("[data-role='enemies']");
const othersContainer = requireElement<HTMLElement>("[data-role='others']");
const hostStatus = requireElement<HTMLElement>("[data-role='host-status']");
const setupStatus = requireElement<HTMLElement>("[data-role='setup-status']");
const message = requireElement<HTMLElement>("[data-role='message']");
const results = requireElement<HTMLElement>("[data-role='results']");
const addPlayerButton = requireElement<HTMLButtonElement>("[data-action='add-player']");
const addEnemyButton = requireElement<HTMLButtonElement>("[data-action='add-enemy']");
const addKaijuButton = requireElement<HTMLButtonElement>("[data-action='add-kaiju']");
const addOtherButton = requireElement<HTMLButtonElement>("[data-action='add-other']");
const previewButton = requireElement<HTMLButtonElement>("[data-action='preview']");

let hostContext: ToolHostContext | null = null;
let backendUrl: string | null = null;
let busy = false;

addPlayerButton.addEventListener("click", () => addCombatant({ allianceId: "players" }));
addEnemyButton.addEventListener("click", () => addCombatant({ allianceId: "enemies" }));
addKaijuButton.addEventListener("click", () => addCombatant({ allianceId: "enemies", blockType: "kaiju" }));
addOtherButton.addEventListener("click", () => addCombatant({ allianceId: "other" }));
previewButton.addEventListener("click", () => void runPreview());

addCombatant({ allianceId: "players" }, false);
addCombatant({ allianceId: "enemies" }, false);
updateBuildState();

const contextUrl = root.dataset.toolContextUrl;
if (!contextUrl) {
    hostStatus.textContent = "Standalone development mode.";
    backendUrl = initiativePreviewUrl(null);
    updateBuildState();
} else {
    hostStatus.textContent = "Connecting to Dorks & Dice…";
    updateBuildState();

    try {
        hostContext = await loadToolHostContext(contextUrl);
        backendUrl = initiativePreviewUrl(hostContext);
        hostStatus.textContent = hostContext.user
            ? `Signed in as ${hostContext.user.displayName || hostContext.user.id}.`
            : "No sign-in required for manual encounters.";
        updateBuildState();
    } catch (error) {
        console.error("Block Initiative host-context check failed.", error);
        hostStatus.textContent = "Dorks & Dice host context could not be loaded.";
        showMessage(error instanceof Error ? error.message : "Host context could not be loaded.", true);
        updateBuildState();
    }
}

function requireElement<T extends Element>(selector: string): T {
    const element = container.querySelector(selector);
    if (!(element instanceof Element)) {
        throw new Error(`Block Initiative could not find ${selector}.`);
    }
    return element as T;
}

function addCombatant(seed: Partial<InitiativeCombatantInput> = {}, focus = true): void {
    const allianceId = seed.allianceId ?? "players";
    const blockType: TurnBlockType = seed.blockType ?? "standard";
    const isCustomSide = allianceId !== "players" && allianceId !== "enemies";
    const target = allianceId === "players"
        ? playersContainer
        : allianceId === "enemies"
            ? enemiesContainer
            : othersContainer;

    const card = document.createElement("article");
    card.className = "bi-entry";
    card.dataset.combatantId = seed.id ?? crypto.randomUUID();
    card.dataset.allianceId = allianceId;
    card.dataset.customSide = String(isCustomSide);

    card.innerHTML = `
        <div class="bi-entry-main ${isCustomSide ? "bi-entry-main-custom" : ""}">
            <div class="bi-field">
                <label>Name</label>
                <input data-field="name" type="text" autocomplete="off" placeholder="${blockType === "kaiju" ? "Kaiju name" : allianceId === "players" ? "Player name" : "Enemy name"}">
            </div>
            ${isCustomSide ? `
                <div class="bi-field">
                    <label>Side</label>
                    <input data-field="custom-alliance" type="text" autocomplete="off" placeholder="e.g. neutral guards">
                </div>` : ""}
            <div class="bi-field">
                <label>Initiative</label>
                <input data-field="initiative" type="number" step="any" inputmode="decimal" placeholder="e.g. 17">
            </div>
            <button type="button" class="btn btn-sm btn-outline-danger" data-action="remove">Remove</button>
        </div>
        <div class="bi-entry-meta" data-role="entry-meta"></div>
        <details>
            <summary>Advanced options</summary>
            <div class="bi-advanced-grid">
                <div class="bi-field">
                    <label>Special block type</label>
                    <select data-field="block-type">
                        <option value="standard">Standard block</option>
                        <option value="kaiju">Kaiju block</option>
                    </select>
                </div>
                <div class="bi-field">
                    <label>Acts with controller</label>
                    <select data-field="controller"><option value="">No controller</option></select>
                </div>
            </div>
            <div class="bi-metadata">
                <div class="bi-muted">Optional record fields — these do not change the current block calculation.</div>
                <div class="bi-metadata-grid">
                    <div class="bi-field">
                        <label>Initiative modifier</label>
                        <input data-field="modifier" type="number" step="any" inputmode="decimal" placeholder="Optional">
                    </div>
                    <div class="bi-field">
                        <label>Tactical group label</label>
                        <input data-field="tactical-group" type="text" autocomplete="off" placeholder="Optional group name">
                    </div>
                </div>
            </div>
        </details>
    `;

    field<HTMLInputElement>(card, "name").value = seed.name ?? "";
    if (isCustomSide) {
        field<HTMLInputElement>(card, "custom-alliance").value = allianceId === "other" ? "" : allianceId;
    }
    field<HTMLInputElement>(card, "initiative").value = seed.initiativeTotal === undefined ? "" : String(seed.initiativeTotal);
    field<HTMLSelectElement>(card, "block-type").value = blockType;
    field<HTMLInputElement>(card, "modifier").value = seed.initiativeModifier === null || seed.initiativeModifier === undefined ? "" : String(seed.initiativeModifier);
    field<HTMLInputElement>(card, "tactical-group").value = seed.tacticalGroupId ?? "";

    field<HTMLButtonElement>(card, undefined, "[data-action='remove']").addEventListener("click", () => {
        card.remove();
        refreshControllerOptions();
        setupChanged();
    });

    for (const input of Array.from(card.querySelectorAll<HTMLInputElement>("input"))) {
        input.addEventListener("input", () => {
            if (input.dataset.field === "name") {
                refreshControllerOptions();
            }
            if (input.dataset.field === "custom-alliance") {
                updateEntryMeta(card);
            }
            setupChanged();
        });
    }

    for (const select of Array.from(card.querySelectorAll<HTMLSelectElement>("select"))) {
        select.addEventListener("change", () => {
            if (select.dataset.field === "block-type") {
                updateEntryMeta(card);
            }
            setupChanged();
        });
    }

    target.append(card);
    updateEntryMeta(card);
    refreshControllerOptions();
    setupChanged();

    if (focus) {
        field<HTMLInputElement>(card, "name").focus();
    }
}

function updateEntryMeta(card: HTMLElement): void {
    const meta = field<HTMLElement>(card, undefined, "[data-role='entry-meta']");
    meta.replaceChildren();

    const sideBadge = document.createElement("span");
    sideBadge.className = "bi-badge";
    sideBadge.textContent = friendlySide(allianceFor(card) || card.dataset.allianceId || "Other side");
    meta.append(sideBadge);

    const blockType = blockTypeFor(card);
    if (blockType === "kaiju") {
        const typeBadge = document.createElement("span");
        typeBadge.className = "bi-badge bi-kaiju-badge";
        typeBadge.textContent = "Kaiju block";
        meta.append(typeBadge);
    }
}

function setupChanged(): void {
    clearMessage();
    if (results.childElementCount > 0) {
        results.replaceChildren();
    }
    updateBuildState();
}

function updateBuildState(): void {
    const cards = combatantCards();
    const allComplete = cards.length >= 2 && cards.every(card => {
        const name = field<HTMLInputElement>(card, "name").value.trim();
        const initiative = field<HTMLInputElement>(card, "initiative").value.trim();
        const alliance = allianceFor(card);
        return Boolean(name && initiative && alliance);
    });

    if (!backendUrl) {
        setupStatus.textContent = "Connecting to the initiative service…";
    } else if (cards.length < 2) {
        setupStatus.textContent = "Add at least two combatants.";
    } else if (!allComplete) {
        setupStatus.textContent = "Finish the name and initiative fields above.";
    } else {
        setupStatus.textContent = "Ready to build the initiative blocks.";
    }

    previewButton.disabled = busy || !backendUrl || !allComplete;
}

function refreshControllerOptions(): void {
    const cards = combatantCards();
    const combatants = cards.map(card => ({
        id: card.dataset.combatantId!,
        name: field<HTMLInputElement>(card, "name").value.trim()
    }));

    for (const card of cards) {
        const select = field<HTMLSelectElement>(card, "controller");
        const previous = select.value;
        select.replaceChildren(new Option("No controller", ""));

        for (const combatant of combatants) {
            if (combatant.id !== card.dataset.combatantId) {
                select.add(new Option(combatant.name || "(unnamed combatant)", combatant.id));
            }
        }

        if (Array.from(select.options).some(option => option.value === previous)) {
            select.value = previous;
        }
    }
}

async function runPreview(manualOrderOverride: string[] | null = null): Promise<void> {
    if (!backendUrl) {
        showMessage("The Block Initiative backend is not available.", true);
        return;
    }

    clearMessage();
    busy = true;
    updateBuildState();

    try {
        const preview = await previewInitiative(backendUrl, {
            combatants: collectCombatants(),
            manualOrderOverride
        });
        renderPreview(preview);
        results.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
        showMessage(error instanceof Error ? error.message : "Initiative blocks could not be built.", true);
    } finally {
        busy = false;
        updateBuildState();
    }
}

function collectCombatants(): InitiativeCombatantInput[] {
    const cards = combatantCards();
    if (cards.length < 2) {
        throw new Error("Add at least two combatants before building initiative blocks.");
    }

    return cards.map((card, index) => {
        const id = card.dataset.combatantId!;
        const name = field<HTMLInputElement>(card, "name").value.trim();
        const allianceId = allianceFor(card);
        const initiativeText = field<HTMLInputElement>(card, "initiative").value.trim();
        const modifierText = field<HTMLInputElement>(card, "modifier").value.trim();
        const controllerId = field<HTMLSelectElement>(card, "controller").value || null;
        const tacticalGroupId = field<HTMLInputElement>(card, "tactical-group").value.trim() || null;
        const blockType = blockTypeFor(card);

        if (!name) {
            throw new Error(`Combatant ${index + 1} needs a name.`);
        }
        if (!allianceId) {
            throw new Error(`${name} needs a side name.`);
        }
        if (!initiativeText) {
            throw new Error(`Enter an initiative result for ${name}.`);
        }

        const initiativeTotal = Number(initiativeText);
        if (!Number.isFinite(initiativeTotal)) {
            throw new Error(`${name} has an invalid initiative value.`);
        }

        const initiativeModifier = modifierText ? Number(modifierText) : null;
        if (initiativeModifier !== null && !Number.isFinite(initiativeModifier)) {
            throw new Error(`${name} has an invalid initiative modifier.`);
        }

        return {
            id,
            name,
            allianceId,
            initiativeTotal,
            initiativeModifier,
            controllerId,
            tacticalGroupId,
            blockType
        };
    });
}

function allianceFor(card: HTMLElement): string {
    if (card.dataset.customSide === "true") {
        return field<HTMLInputElement>(card, "custom-alliance").value.trim();
    }
    return card.dataset.allianceId ?? "";
}

function blockTypeFor(card: HTMLElement): TurnBlockType {
    return field<HTMLSelectElement>(card, "block-type").value === "kaiju" ? "kaiju" : "standard";
}

function renderPreview(preview: InitiativePreviewResponse): void {
    results.replaceChildren();

    const summary = document.createElement("section");
    summary.className = "card card-body";
    summary.innerHTML = `
        <div class="bi-results-header">
            <div>
                <h3 class="h5 mb-1">${preview.requiresAdjudication ? "One ruling is needed" : "Initiative blocks are ready"}</h3>
                <p class="mb-0 bi-muted">${preview.requiresAdjudication
                    ? "Resolve the highlighted tie below, then the encounter order is ready to use."
                    : "Run the blocks from top to bottom. When the round ends, return to the top unless the wraparound note says otherwise."}</p>
            </div>
            <span class="bi-badge">${preview.blocks.length} block${preview.blocks.length === 1 ? "" : "s"}</span>
        </div>
    `;
    results.append(summary);

    if (preview.issues.length > 0) {
        results.append(renderAdjudication(preview));
    }

    if (preview.usesManualOrderOverride) {
        const overrideNote = document.createElement("div");
        overrideNote.className = "bi-message bi-success";
        overrideNote.textContent = "DM tie order applied. The original initiative rolls are unchanged.";
        results.append(overrideNote);
    }

    const combatantById = new Map(preview.orderedCombatants.map(combatant => [combatant.id, combatant]));
    const blockSection = document.createElement("section");
    blockSection.className = "card card-body";
    blockSection.innerHTML = `<h3 class="h5 mb-1">Block order</h3><p class="mb-0 bi-muted">Each block completes before the next block begins.</p>`;

    const blockGrid = document.createElement("div");
    blockGrid.className = "bi-blocks";

    for (const [index, block] of preview.blocks.entries()) {
        const blockCard = document.createElement("article");
        blockCard.className = "bi-block";

        const header = document.createElement("div");
        header.className = "bi-block-header";
        const title = document.createElement("strong");
        title.textContent = `Block ${index + 1}`;

        const badges = document.createElement("div");
        badges.className = "d-flex flex-wrap gap-1";
        const sideBadge = document.createElement("span");
        sideBadge.className = "bi-badge";
        sideBadge.textContent = friendlySide(block.allianceId);
        badges.append(sideBadge);
        if (block.blockType === "kaiju") {
            const typeBadge = document.createElement("span");
            typeBadge.className = "bi-badge bi-kaiju-badge";
            typeBadge.textContent = "Kaiju";
            badges.append(typeBadge);
        }

        header.append(title, badges);
        blockCard.append(header);

        const body = document.createElement("div");
        body.className = "bi-block-body";
        const memberList = document.createElement("ul");
        memberList.className = "bi-member-list";

        for (const memberId of block.memberOrder) {
            const member = combatantById.get(memberId);
            const item = document.createElement("li");
            item.className = "bi-member";
            const name = document.createElement("span");
            name.textContent = member?.name ?? memberId;
            const initiative = document.createElement("span");
            initiative.className = "bi-muted";
            initiative.textContent = member
                ? member.effectiveInitiative === member.initiativeTotal
                    ? `Initiative ${member.initiativeTotal}`
                    : `Acts at ${member.effectiveInitiative} · rolled ${member.initiativeTotal}`
                : "";
            item.append(name, initiative);
            memberList.append(item);
        }

        body.append(memberList);

        if (block.allianceId === "players" && block.blockType === "standard" && block.memberOrder.length > 1) {
            const note = document.createElement("div");
            note.className = "bi-muted mt-2";
            note.textContent = "These players may choose their order within this block.";
            body.append(note);
        }

        if (block.blockType === "kaiju") {
            const note = document.createElement("div");
            note.className = "bi-muted mt-2";
            note.textContent = "Kaiju rules stay attached to this block instead of merging into a standard allied block.";
            body.append(note);
        }

        blockCard.append(body);
        blockGrid.append(blockCard);
    }

    blockSection.append(blockGrid);
    blockSection.append(renderHowToRun(preview));

    const rawDetails = document.createElement("details");
    rawDetails.className = "bi-raw-order";
    const summaryLabel = document.createElement("summary");
    summaryLabel.textContent = "Show original sorted initiative";
    rawDetails.append(summaryLabel);
    const orderList = document.createElement("ol");
    for (const combatant of preview.orderedCombatants) {
        const item = document.createElement("li");
        const blockLabel = combatant.blockType === "kaiju" ? " · Kaiju" : "";
        item.textContent = `${combatant.name}: ${combatant.initiativeTotal} (${friendlySide(combatant.allianceId)}${blockLabel})`;
        orderList.append(item);
    }
    rawDetails.append(orderList);
    blockSection.append(rawDetails);
    results.append(blockSection);
}

function renderAdjudication(preview: InitiativePreviewResponse): HTMLElement {
    const issueBox = document.createElement("section");
    issueBox.className = "bi-message bi-warning";
    issueBox.innerHTML = `<strong>DM ruling needed</strong><p class="mb-2">Opposing combatants tied. Choose their order below; the tool will keep their original initiative values.</p>`;

    for (const issue of preview.issues) {
        const tied = issue.combatantIds
            .map(id => preview.orderedCombatants.find(combatant => combatant.id === id))
            .filter((combatant): combatant is NonNullable<typeof combatant> => Boolean(combatant));

        const group = document.createElement("div");
        group.className = "mb-2";
        const explanation = document.createElement("div");
        explanation.className = "bi-muted";
        explanation.textContent = issue.message;
        group.append(explanation);

        const list = document.createElement("ol");
        list.className = "bi-tie-list";
        list.dataset.tieGroup = "true";
        for (const combatant of tied) {
            const item = document.createElement("li");
            item.className = "bi-tie-row";
            item.dataset.combatantId = combatant.id;

            const label = document.createElement("strong");
            label.textContent = `${combatant.name} — ${friendlySide(combatant.allianceId)}`;
            const up = document.createElement("button");
            up.type = "button";
            up.className = "btn btn-sm btn-outline-secondary";
            up.textContent = "Earlier";
            up.addEventListener("click", () => moveTieItem(item, -1));
            const down = document.createElement("button");
            down.type = "button";
            down.className = "btn btn-sm btn-outline-secondary";
            down.textContent = "Later";
            down.addEventListener("click", () => moveTieItem(item, 1));
            item.append(label, up, down);
            list.append(item);
        }
        group.append(list);
        issueBox.append(group);
    }

    const apply = document.createElement("button");
    apply.type = "button";
    apply.className = "btn btn-outline-secondary";
    apply.textContent = "Apply DM tie order";
    apply.addEventListener("click", () => {
        const override = preview.orderedCombatants.map(combatant => combatant.id);
        for (const tieList of Array.from(issueBox.querySelectorAll<HTMLOListElement>("[data-tie-group='true']"))) {
            const orderedIds = Array.from(tieList.querySelectorAll<HTMLElement>("[data-combatant-id]"))
                .map(item => item.dataset.combatantId!)
                .filter(Boolean);
            const positions = override
                .map((id, index) => orderedIds.includes(id) ? index : -1)
                .filter(index => index >= 0)
                .sort((a, b) => a - b);
            positions.forEach((position, index) => {
                override[position] = orderedIds[index];
            });
        }
        void runPreview(override);
    });
    issueBox.append(apply);
    return issueBox;
}

function moveTieItem(item: HTMLElement, direction: -1 | 1): void {
    if (direction < 0) {
        const previous = item.previousElementSibling;
        if (previous) {
            item.parentElement?.insertBefore(item, previous);
        }
    } else {
        const next = item.nextElementSibling;
        if (next) {
            item.parentElement?.insertBefore(next, item);
        }
    }
}

function renderHowToRun(preview: InitiativePreviewResponse): HTMLElement {
    const section = document.createElement("div");
    section.className = "bi-how-to-run";

    const heading = document.createElement("strong");
    heading.textContent = "How to run this order";
    section.append(heading);

    if (!preview.cyclicMerge) {
        const normal = document.createElement("div");
        normal.className = "bi-round-rule";
        normal.textContent = `Every round: run Block 1 through Block ${preview.blocks.length}, then return to Block 1 for the next round.`;
        section.append(normal);
        return section;
    }

    const bottomIndex = preview.blocks.findIndex(block => block.id === preview.cyclicMerge?.bottomBlockId);
    const topIndex = preview.blocks.findIndex(block => block.id === preview.cyclicMerge?.topBlockId);
    const bottomNumber = bottomIndex + 1;
    const topNumber = topIndex + 1;

    const roundOne = document.createElement("div");
    roundOne.className = "bi-round-rule";
    roundOne.innerHTML = `<strong>Round 1:</strong> Run the blocks from the top down, but do not give Block ${bottomNumber} a separate activation when you reach the bottom.`;

    const laterRounds = document.createElement("div");
    laterRounds.className = "bi-round-rule";
    laterRounds.innerHTML = `<strong>Round 2 onward:</strong> Block ${bottomNumber} joins Block ${topNumber} across the round boundary. Treat them as one ${friendlySide(preview.cyclicMerge.allianceId)} block at the top of the round.`;

    section.append(roundOne, laterRounds);
    return section;
}

function friendlySide(allianceId: string): string {
    if (allianceId === "players") {
        return "Players";
    }
    if (allianceId === "enemies") {
        return "Enemies";
    }
    return allianceId || "Other side";
}

function combatantCards(): HTMLElement[] {
    return [playersContainer, enemiesContainer, othersContainer]
        .flatMap(list => Array.from(list.querySelectorAll<HTMLElement>(".bi-entry")));
}

function field<T extends HTMLElement>(
    parent: HTMLElement,
    fieldName?: string,
    selector?: string
): T {
    const actualSelector = selector ?? `[data-field='${fieldName}']`;
    const element = parent.querySelector(actualSelector);
    if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing combatant field ${fieldName ?? actualSelector}.`);
    }
    return element as T;
}

function showMessage(text: string, isError: boolean): void {
    message.hidden = false;
    message.className = `bi-message ${isError ? "bi-error" : "bi-warning"}`;
    message.textContent = text;
}

function clearMessage(): void {
    message.hidden = true;
    message.textContent = "";
}
