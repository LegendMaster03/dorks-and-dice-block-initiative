import { previewInitiative } from "./api";
import type {
    InitiativeCombatantInput,
    InitiativePreviewResponse
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
.block-initiative-app { --bi-border: rgba(127,127,127,.28); }
.block-initiative-app .bi-grid { display: grid; gap: 1rem; }
.block-initiative-app .bi-hero { display: grid; gap: .8rem; }
.block-initiative-app .bi-steps { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: .75rem; }
.block-initiative-app .bi-step { border: 1px solid var(--bi-border); border-radius: .6rem; padding: .75rem; }
.block-initiative-app .bi-step strong { display: block; margin-bottom: .2rem; }
.block-initiative-app .bi-step-number { display: inline-grid; place-items: center; width: 1.7rem; height: 1.7rem; border: 1px solid currentColor; border-radius: 999px; margin-right: .35rem; font-size: .85rem; }
.block-initiative-app .bi-toolbar { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
.block-initiative-app .bi-toolbar-spacer { flex: 1 1 auto; }
.block-initiative-app .bi-combatants { display: grid; gap: .75rem; }
.block-initiative-app .bi-combatant { border: 1px solid var(--bi-border); border-radius: .65rem; padding: .8rem; }
.block-initiative-app .bi-combatant-main { display: grid; grid-template-columns: minmax(12rem,2fr) minmax(9rem,1fr) minmax(7rem,.7fr) auto; gap: .65rem; align-items: end; }
.block-initiative-app .bi-field { display: grid; gap: .25rem; }
.block-initiative-app .bi-field label { font-size: .82rem; font-weight: 600; opacity: .82; }
.block-initiative-app input, .block-initiative-app select { width: 100%; min-width: 0; padding: .45rem .55rem; }
.block-initiative-app details { margin-top: .55rem; }
.block-initiative-app details > summary { cursor: pointer; user-select: none; opacity: .8; }
.block-initiative-app .bi-advanced-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: .65rem; margin-top: .65rem; }
.block-initiative-app .bi-order-controls { display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; margin-top: .65rem; }
.block-initiative-app .bi-primary-action { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .75rem; align-items: center; border-top: 1px solid var(--bi-border); margin-top: 1rem; padding-top: 1rem; }
.block-initiative-app .bi-muted { opacity: .72; }
.block-initiative-app .bi-message { border-left: 4px solid currentColor; border-radius: .25rem; padding: .7rem .85rem; }
.block-initiative-app .bi-warning { background: rgba(180,130,0,.08); }
.block-initiative-app .bi-error { background: rgba(180,0,0,.08); }
.block-initiative-app .bi-success { background: rgba(0,130,70,.08); }
.block-initiative-app .bi-results-header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .75rem; align-items: start; }
.block-initiative-app .bi-blocks { display: grid; gap: .75rem; }
.block-initiative-app .bi-block { border: 1px solid var(--bi-border); border-radius: .65rem; overflow: hidden; }
.block-initiative-app .bi-block-header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .5rem; padding: .65rem .8rem; border-bottom: 1px solid var(--bi-border); }
.block-initiative-app .bi-block-body { padding: .75rem .8rem; }
.block-initiative-app .bi-member-list { display: grid; gap: .45rem; margin: 0; padding: 0; list-style: none; }
.block-initiative-app .bi-member { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 1px solid rgba(127,127,127,.15); padding-bottom: .35rem; }
.block-initiative-app .bi-member:last-child { border-bottom: 0; padding-bottom: 0; }
.block-initiative-app .bi-badge { display: inline-block; border: 1px solid currentColor; border-radius: 999px; padding: .12rem .5rem; font-size: .78rem; }
.block-initiative-app .bi-raw-order { margin-top: .75rem; }
.block-initiative-app button { padding: .45rem .75rem; cursor: pointer; }
.block-initiative-app button:disabled { cursor: not-allowed; opacity: .55; }
@media (max-width: 820px) {
    .block-initiative-app .bi-steps { grid-template-columns: 1fr; }
    .block-initiative-app .bi-combatant-main { grid-template-columns: 1fr 1fr; }
    .block-initiative-app .bi-advanced-grid { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
    .block-initiative-app .bi-combatant-main { grid-template-columns: 1fr; }
}
`;
root.append(style);

const container = document.createElement("section");
container.className = "container-fluid px-0 bi-grid";
container.innerHTML = `
    <header class="bi-hero">
        <div>
            <h2 class="h4 mb-1">Block Initiative</h2>
            <p class="mb-1">Turn ordinary initiative rolls into the block order used at the table.</p>
            <p class="mb-0 bi-muted" data-role="host-status" role="status"></p>
        </div>
        <div class="bi-steps" aria-label="How to use Block Initiative">
            <div class="bi-step"><strong><span class="bi-step-number">1</span>Add combatants</strong><span class="bi-muted">Enter each creature's name, side, and initiative result.</span></div>
            <div class="bi-step"><strong><span class="bi-step-number">2</span>Build turn order</strong><span class="bi-muted">The tool sorts initiative and combines adjacent allies into blocks.</span></div>
            <div class="bi-step"><strong><span class="bi-step-number">3</span>Review exceptions</strong><span class="bi-muted">Only ties or unusual cases need a DM ruling.</span></div>
        </div>
    </header>

    <section class="card card-body">
        <div class="bi-toolbar mb-3">
            <div>
                <h3 class="h5 mb-1">1. Encounter setup</h3>
                <div class="bi-muted">For a normal encounter, only the three visible fields are required.</div>
            </div>
            <div class="bi-toolbar-spacer"></div>
            <button type="button" class="btn btn-outline-primary" data-action="add-player">+ Player</button>
            <button type="button" class="btn btn-outline-secondary" data-action="add-enemy">+ Enemy</button>
            <button type="button" class="btn btn-outline-secondary" data-action="add-other">+ Other side</button>
        </div>

        <div class="bi-combatants" data-role="combatants"></div>

        <div class="bi-primary-action">
            <div>
                <strong>Ready?</strong>
                <div class="bi-muted">Build the order after everyone has an initiative value. Advanced fields are optional.</div>
            </div>
            <button type="button" class="btn btn-primary" data-action="preview">Build turn order</button>
        </div>
    </section>

    <section data-role="message" hidden></section>
    <section data-role="results" class="bi-grid"></section>
`;
root.append(container);

const combatantsContainer = requireElement<HTMLElement>("[data-role='combatants']");
const hostStatus = requireElement<HTMLElement>("[data-role='host-status']");
const message = requireElement<HTMLElement>("[data-role='message']");
const results = requireElement<HTMLElement>("[data-role='results']");
const addPlayerButton = requireElement<HTMLButtonElement>("[data-action='add-player']");
const addEnemyButton = requireElement<HTMLButtonElement>("[data-action='add-enemy']");
const addOtherButton = requireElement<HTMLButtonElement>("[data-action='add-other']");
const previewButton = requireElement<HTMLButtonElement>("[data-action='preview']");

let hostContext: ToolHostContext | null = null;
let backendUrl: string | null = null;

addPlayerButton.addEventListener("click", () => addCombatant({ allianceId: "players" }));
addEnemyButton.addEventListener("click", () => addCombatant({ allianceId: "enemies" }));
addOtherButton.addEventListener("click", () => addCombatant({ allianceId: "other" }));
previewButton.addEventListener("click", () => void runPreview(false));

addCombatant({ allianceId: "players" });
addCombatant({ allianceId: "enemies" });

const contextUrl = root.dataset.toolContextUrl;
if (!contextUrl) {
    hostStatus.textContent = "Standalone development mode.";
    backendUrl = initiativePreviewUrl(null);
} else {
    setActionsDisabled(true);
    hostStatus.textContent = "Connecting to Dorks & Dice…";

    try {
        hostContext = await loadToolHostContext(contextUrl);
        backendUrl = initiativePreviewUrl(hostContext);
        hostStatus.textContent = hostContext.user
            ? `Signed in as ${hostContext.user.displayName || hostContext.user.id}.`
            : "No sign-in required for manual encounters.";
        setActionsDisabled(false);
    } catch (error) {
        console.error("Block Initiative host-context check failed.", error);
        hostStatus.textContent = "Dorks & Dice host context could not be loaded.";
        showMessage(error instanceof Error ? error.message : "Host context could not be loaded.", true);
    }
}

function requireElement<T extends Element>(selector: string): T {
    const element = container.querySelector(selector);
    if (!(element instanceof Element)) {
        throw new Error(`Block Initiative could not find ${selector}.`);
    }
    return element as T;
}

function addCombatant(seed: Partial<InitiativeCombatantInput> = {}): void {
    const card = document.createElement("article");
    card.className = "bi-combatant";
    card.dataset.combatantId = seed.id ?? crypto.randomUUID();

    const seededAlliance = seed.allianceId ?? "players";
    const standardAlliance = seededAlliance === "players" || seededAlliance === "enemies";

    card.innerHTML = `
        <div class="bi-combatant-main">
            <div class="bi-field">
                <label>Name</label>
                <input data-field="name" type="text" autocomplete="off" placeholder="Character or creature">
            </div>
            <div class="bi-field">
                <label>Side</label>
                <select data-field="side">
                    <option value="players">Players</option>
                    <option value="enemies">Enemies</option>
                    <option value="custom">Other…</option>
                </select>
            </div>
            <div class="bi-field">
                <label>Initiative</label>
                <input data-field="initiative" type="number" step="any" inputmode="decimal" placeholder="e.g. 17">
            </div>
            <button type="button" class="btn btn-sm btn-outline-danger" data-action="remove">Remove</button>
        </div>
        <div class="bi-field mt-2" data-role="custom-side" hidden>
            <label>Side name</label>
            <input data-field="custom-alliance" type="text" autocomplete="off" placeholder="e.g. neutral guards">
        </div>
        <details>
            <summary>Advanced options</summary>
            <div class="bi-advanced-grid">
                <div class="bi-field">
                    <label>Initiative modifier</label>
                    <input data-field="modifier" type="number" step="any" inputmode="decimal" placeholder="Optional">
                </div>
                <div class="bi-field">
                    <label>Acts with controller</label>
                    <select data-field="controller"><option value="">No controller</option></select>
                </div>
                <div class="bi-field">
                    <label>Tactical enemy group</label>
                    <input data-field="tactical-group" type="text" autocomplete="off" placeholder="Optional group name">
                </div>
            </div>
            <div class="bi-order-controls">
                <span class="bi-muted">Manual DM order:</span>
                <button type="button" class="btn btn-sm btn-outline-secondary" data-action="move-up">Move up</button>
                <button type="button" class="btn btn-sm btn-outline-secondary" data-action="move-down">Move down</button>
            </div>
        </details>
    `;

    field<HTMLInputElement>(card, "name").value = seed.name ?? "";
    field<HTMLSelectElement>(card, "side").value = standardAlliance ? seededAlliance : "custom";
    field<HTMLInputElement>(card, "custom-alliance").value = standardAlliance ? "" : seededAlliance;
    field<HTMLInputElement>(card, "initiative").value = seed.initiativeTotal === undefined ? "" : String(seed.initiativeTotal);
    field<HTMLInputElement>(card, "modifier").value = seed.initiativeModifier === null || seed.initiativeModifier === undefined ? "" : String(seed.initiativeModifier);
    field<HTMLInputElement>(card, "tactical-group").value = seed.tacticalGroupId ?? "";

    field<HTMLButtonElement>(card, undefined, "[data-action='remove']").addEventListener("click", () => {
        card.remove();
        refreshControllerOptions();
    });
    field<HTMLButtonElement>(card, undefined, "[data-action='move-up']").addEventListener("click", () => moveCombatant(card, -1));
    field<HTMLButtonElement>(card, undefined, "[data-action='move-down']").addEventListener("click", () => moveCombatant(card, 1));
    field<HTMLInputElement>(card, "name").addEventListener("input", refreshControllerOptions);
    field<HTMLSelectElement>(card, "side").addEventListener("change", () => updateCustomSideVisibility(card));

    combatantsContainer.append(card);
    updateCustomSideVisibility(card);
    refreshControllerOptions();
}

function updateCustomSideVisibility(card: HTMLElement): void {
    const customSide = card.querySelector<HTMLElement>("[data-role='custom-side']");
    if (customSide) {
        customSide.hidden = field<HTMLSelectElement>(card, "side").value !== "custom";
    }
}

function moveCombatant(card: HTMLElement, direction: -1 | 1): void {
    if (direction < 0) {
        const previous = card.previousElementSibling;
        if (previous) {
            combatantsContainer.insertBefore(card, previous);
        }
    } else {
        const next = card.nextElementSibling;
        if (next) {
            combatantsContainer.insertBefore(next, card);
        }
    }
    refreshControllerOptions();
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

async function runPreview(useManualOrder: boolean): Promise<void> {
    if (!backendUrl) {
        showMessage("The Block Initiative backend is not available.", true);
        return;
    }

    clearMessage();
    setActionsDisabled(true);

    try {
        const combatants = collectCombatants();
        const rowOrder = combatantCards().map(card => card.dataset.combatantId!);
        const preview = await previewInitiative(backendUrl, {
            combatants,
            manualOrderOverride: useManualOrder ? rowOrder : null
        });
        renderPreview(preview);
    } catch (error) {
        showMessage(error instanceof Error ? error.message : "Turn order could not be built.", true);
    } finally {
        setActionsDisabled(false);
    }
}

function collectCombatants(): InitiativeCombatantInput[] {
    const cards = combatantCards();
    if (cards.length < 2) {
        throw new Error("Add at least two combatants before building the turn order.");
    }

    return cards.map((card, index) => {
        const id = card.dataset.combatantId!;
        const name = field<HTMLInputElement>(card, "name").value.trim();
        const allianceId = allianceFor(card);
        const initiativeText = field<HTMLInputElement>(card, "initiative").value.trim();
        const modifierText = field<HTMLInputElement>(card, "modifier").value.trim();
        const controllerId = field<HTMLSelectElement>(card, "controller").value || null;
        const tacticalGroupId = field<HTMLInputElement>(card, "tactical-group").value.trim() || null;

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
            tacticalGroupId
        };
    });
}

function allianceFor(card: HTMLElement): string {
    const side = field<HTMLSelectElement>(card, "side").value;
    return side === "custom"
        ? field<HTMLInputElement>(card, "custom-alliance").value.trim()
        : side;
}

function renderPreview(preview: InitiativePreviewResponse): void {
    results.replaceChildren();

    const summary = document.createElement("section");
    summary.className = "card card-body";
    summary.innerHTML = `
        <div class="bi-results-header">
            <div>
                <h3 class="h5 mb-1">2. ${preview.requiresAdjudication ? "Review the exception" : "Turn order ready"}</h3>
                <p class="mb-0 bi-muted">${preview.requiresAdjudication
                    ? "The normal block order is shown below, but one issue needs a DM decision."
                    : "Read the blocks from top to bottom. Each block finishes before the next block begins."}</p>
            </div>
            <span class="bi-badge">${preview.blocks.length} block${preview.blocks.length === 1 ? "" : "s"}</span>
        </div>
    `;
    results.append(summary);

    if (preview.issues.length > 0) {
        const issueBox = document.createElement("section");
        issueBox.className = "bi-message bi-warning";
        issueBox.innerHTML = `<strong>DM ruling needed</strong><p class="mb-2">The house rules do not define an automatic answer for this case, so the tool will not invent one.</p>`;

        const list = document.createElement("ul");
        list.className = "mb-2";
        for (const issue of preview.issues) {
            const item = document.createElement("li");
            item.textContent = issue.message;
            list.append(item);
        }
        issueBox.append(list);

        const instructions = document.createElement("p");
        instructions.className = "mb-2";
        instructions.textContent = "Open Advanced options, move the combatants into the order you want, then apply that row order as your ruling.";
        issueBox.append(instructions);

        const overrideButton = document.createElement("button");
        overrideButton.type = "button";
        overrideButton.className = "btn btn-outline-secondary";
        overrideButton.textContent = "Use my combatant order as the DM ruling";
        overrideButton.addEventListener("click", () => void runPreview(true));
        issueBox.append(overrideButton);
        results.append(issueBox);
    }

    if (preview.usesManualOrderOverride) {
        const overrideNote = document.createElement("div");
        overrideNote.className = "bi-message bi-success";
        overrideNote.textContent = "DM manual order is active. Original initiative rolls are still preserved.";
        results.append(overrideNote);
    }

    const combatantById = new Map(preview.orderedCombatants.map(combatant => [combatant.id, combatant]));

    const blockSection = document.createElement("section");
    blockSection.className = "card card-body";
    blockSection.innerHTML = `<h3 class="h5 mb-1">Turn blocks</h3><p class="bi-muted">Adjacent combatants on the same side share a block. Within a player block, the players may choose their order.</p>`;

    const blockGrid = document.createElement("div");
    blockGrid.className = "bi-blocks";
    for (const [index, block] of preview.blocks.entries()) {
        const card = document.createElement("article");
        card.className = "bi-block";

        const header = document.createElement("div");
        header.className = "bi-block-header";
        const title = document.createElement("strong");
        title.textContent = `Block ${index + 1}`;
        const side = document.createElement("span");
        side.className = "bi-badge";
        side.textContent = friendlySide(block.allianceId);
        header.append(title, side);
        card.append(header);

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
        card.append(body);
        blockGrid.append(card);
    }
    blockSection.append(blockGrid);

    if (preview.cyclicMerge) {
        const merge = document.createElement("div");
        merge.className = "bi-message bi-warning mt-3";
        merge.innerHTML = `<strong>Round-one wraparound</strong><div>The bottom ${friendlySide(preview.cyclicMerge.allianceId)} block does not take a separate turn in round one. At the start of round two it joins the top block, creating one block across the round boundary.</div>`;
        blockSection.append(merge);
    }

    const rawDetails = document.createElement("details");
    rawDetails.className = "bi-raw-order";
    const summaryLabel = document.createElement("summary");
    summaryLabel.textContent = "Show raw initiative order";
    rawDetails.append(summaryLabel);
    const orderList = document.createElement("ol");
    for (const combatant of preview.orderedCombatants) {
        const item = document.createElement("li");
        item.textContent = `${combatant.name}: ${combatant.initiativeTotal} (${friendlySide(combatant.allianceId)})`;
        orderList.append(item);
    }
    rawDetails.append(orderList);
    blockSection.append(rawDetails);
    results.append(blockSection);
}

function friendlySide(allianceId: string): string {
    if (allianceId === "players") {
        return "Players";
    }
    if (allianceId === "enemies") {
        return "Enemies";
    }
    return allianceId;
}

function combatantCards(): HTMLElement[] {
    return Array.from(combatantsContainer.querySelectorAll<HTMLElement>(".bi-combatant"));
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

function setActionsDisabled(disabled: boolean): void {
    previewButton.disabled = disabled;
}
