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
.block-initiative-app .bi-grid { display: grid; gap: 1rem; }
.block-initiative-app .bi-toolbar { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
.block-initiative-app .bi-table-wrap { overflow-x: auto; }
.block-initiative-app table { width: 100%; border-collapse: collapse; }
.block-initiative-app th, .block-initiative-app td { padding: .45rem; vertical-align: middle; border-bottom: 1px solid rgba(127,127,127,.25); }
.block-initiative-app input, .block-initiative-app select { width: 100%; min-width: 6rem; padding: .35rem .45rem; }
.block-initiative-app .bi-name { min-width: 10rem; }
.block-initiative-app .bi-small { min-width: 5rem; }
.block-initiative-app .bi-blocks { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.block-initiative-app .bi-block { border: 1px solid rgba(127,127,127,.3); border-radius: .5rem; padding: .75rem; }
.block-initiative-app .bi-muted { opacity: .72; }
.block-initiative-app .bi-warning { border-left: 4px solid currentColor; padding: .65rem .8rem; background: rgba(180,130,0,.08); }
.block-initiative-app .bi-error { border-left: 4px solid currentColor; padding: .65rem .8rem; background: rgba(180,0,0,.08); }
.block-initiative-app button { padding: .45rem .75rem; cursor: pointer; }
.block-initiative-app button:disabled { cursor: not-allowed; opacity: .55; }
`;
root.append(style);

const container = document.createElement("section");
container.className = "container-fluid px-0 bi-grid";
container.innerHTML = `
    <header>
        <h2 class="h4 mb-1">Block Initiative</h2>
        <p class="mb-1">Enter ordinary initiative results. The tracker derives contiguous allied blocks while preserving the original rolls.</p>
        <p class="mb-0 bi-muted" data-role="host-status" role="status"></p>
    </header>

    <section class="card card-body">
        <div class="bi-toolbar mb-2">
            <strong>Combatants</strong>
            <button type="button" data-action="add">Add combatant</button>
            <button type="button" data-action="preview">Preview blocks</button>
            <button type="button" data-action="override">Use current row order as DM override</button>
        </div>
        <div class="bi-table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Alliance</th>
                        <th>Initiative</th>
                        <th>Modifier</th>
                        <th>Controller</th>
                        <th>Tactical group</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody data-role="combatants"></tbody>
            </table>
        </div>
        <datalist id="block-initiative-alliance-suggestions">
            <option value="players"></option>
            <option value="enemies"></option>
        </datalist>
    </section>

    <section data-role="message" hidden></section>
    <section data-role="results" class="bi-grid"></section>
`;
root.append(container);

const tbody = requireElement<HTMLTableSectionElement>("[data-role='combatants']");
const hostStatus = requireElement<HTMLElement>("[data-role='host-status']");
const message = requireElement<HTMLElement>("[data-role='message']");
const results = requireElement<HTMLElement>("[data-role='results']");
const addButton = requireElement<HTMLButtonElement>("[data-action='add']");
const previewButton = requireElement<HTMLButtonElement>("[data-action='preview']");
const overrideButton = requireElement<HTMLButtonElement>("[data-action='override']");

let hostContext: ToolHostContext | null = null;
let backendUrl: string | null = null;

addButton.addEventListener("click", () => addCombatant());
previewButton.addEventListener("click", () => void runPreview(false));
overrideButton.addEventListener("click", () => void runPreview(true));

addCombatant({ allianceId: "players" });
addCombatant({ allianceId: "enemies" });

const contextUrl = root.dataset.toolContextUrl;
if (!contextUrl) {
    hostStatus.textContent = "Standalone development mode.";
    backendUrl = initiativePreviewUrl(null);
} else {
    setActionsDisabled(true);
    hostStatus.textContent = "Loading Dorks & Dice host context…";

    try {
        hostContext = await loadToolHostContext(contextUrl);
        backendUrl = initiativePreviewUrl(hostContext);
        hostStatus.textContent = hostContext.user
            ? `Connected to Dorks & Dice as ${hostContext.user.displayName || hostContext.user.id}.`
            : "Connected to Dorks & Dice anonymously.";
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
    const row = document.createElement("tr");
    row.dataset.combatantId = seed.id ?? crypto.randomUUID();
    row.innerHTML = `
        <td><input class="bi-name" data-field="name" type="text" autocomplete="off" placeholder="Combatant"></td>
        <td><input data-field="alliance" type="text" list="block-initiative-alliance-suggestions" autocomplete="off" placeholder="players"></td>
        <td><input class="bi-small" data-field="initiative" type="number" step="any" inputmode="decimal"></td>
        <td><input class="bi-small" data-field="modifier" type="number" step="any" inputmode="decimal" placeholder="optional"></td>
        <td><select data-field="controller"><option value="">None</option></select></td>
        <td><input data-field="tactical-group" type="text" autocomplete="off" placeholder="optional"></td>
        <td><button type="button" data-action="remove" aria-label="Remove combatant">Remove</button></td>
    `;

    field<HTMLInputElement>(row, "name").value = seed.name ?? "";
    field<HTMLInputElement>(row, "alliance").value = seed.allianceId ?? "players";
    field<HTMLInputElement>(row, "initiative").value = seed.initiativeTotal === undefined
        ? ""
        : String(seed.initiativeTotal);
    field<HTMLInputElement>(row, "modifier").value = seed.initiativeModifier === null || seed.initiativeModifier === undefined
        ? ""
        : String(seed.initiativeModifier);
    field<HTMLInputElement>(row, "tactical-group").value = seed.tacticalGroupId ?? "";

    field<HTMLButtonElement>(row, undefined, "[data-action='remove']").addEventListener("click", () => {
        row.remove();
        refreshControllerOptions();
    });
    field<HTMLInputElement>(row, "name").addEventListener("input", refreshControllerOptions);

    tbody.append(row);
    refreshControllerOptions();
}

function refreshControllerOptions(): void {
    const rows = combatantRows();
    const combatants = rows.map(row => ({
        id: row.dataset.combatantId!,
        name: field<HTMLInputElement>(row, "name").value.trim()
    }));

    for (const row of rows) {
        const select = field<HTMLSelectElement>(row, "controller");
        const previous = select.value;
        select.replaceChildren(new Option("None", ""));

        for (const combatant of combatants) {
            if (combatant.id === row.dataset.combatantId) {
                continue;
            }
            select.add(new Option(combatant.name || "(unnamed combatant)", combatant.id));
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
        const rowOrder = combatantRows().map(row => row.dataset.combatantId!);
        const preview = await previewInitiative(backendUrl, {
            combatants,
            manualOrderOverride: useManualOrder ? rowOrder : null
        });
        renderPreview(preview);
    } catch (error) {
        showMessage(error instanceof Error ? error.message : "Initiative preview failed.", true);
    } finally {
        setActionsDisabled(false);
    }
}

function collectCombatants(): InitiativeCombatantInput[] {
    return combatantRows().map((row, index) => {
        const id = row.dataset.combatantId!;
        const name = field<HTMLInputElement>(row, "name").value.trim();
        const allianceId = field<HTMLInputElement>(row, "alliance").value.trim();
        const initiativeText = field<HTMLInputElement>(row, "initiative").value.trim();
        const modifierText = field<HTMLInputElement>(row, "modifier").value.trim();
        const controllerId = field<HTMLSelectElement>(row, "controller").value || null;
        const tacticalGroupId = field<HTMLInputElement>(row, "tactical-group").value.trim() || null;

        if (!name) {
            throw new Error(`Combatant ${index + 1} requires a name.`);
        }
        if (!allianceId) {
            throw new Error(`${name} requires an alliance.`);
        }
        if (!initiativeText) {
            throw new Error(`${name} requires an initiative value.`);
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

function renderPreview(preview: InitiativePreviewResponse): void {
    results.replaceChildren();

    if (preview.issues.length > 0) {
        const issueBox = document.createElement("div");
        issueBox.className = "bi-warning";
        const heading = document.createElement("strong");
        heading.textContent = "DM adjudication required";
        issueBox.append(heading);
        const list = document.createElement("ul");
        for (const issue of preview.issues) {
            const item = document.createElement("li");
            item.textContent = issue.message;
            list.append(item);
        }
        issueBox.append(list);
        results.append(issueBox);
    }

    if (preview.usesManualOrderOverride) {
        const overrideNote = document.createElement("div");
        overrideNote.className = "bi-warning";
        overrideNote.textContent = "DM order override is active. Original initiative values remain unchanged.";
        results.append(overrideNote);
    }

    const combatantById = new Map(preview.orderedCombatants.map(combatant => [combatant.id, combatant]));

    const orderSection = document.createElement("section");
    orderSection.className = "card card-body";
    const orderHeading = document.createElement("h3");
    orderHeading.className = "h5";
    orderHeading.textContent = "Initiative order";
    orderSection.append(orderHeading);

    const orderList = document.createElement("ol");
    for (const combatant of preview.orderedCombatants) {
        const item = document.createElement("li");
        const effective = combatant.effectiveInitiative === combatant.initiativeTotal
            ? `${combatant.initiativeTotal}`
            : `${combatant.effectiveInitiative} effective; original ${combatant.initiativeTotal}`;
        item.textContent = `${combatant.name} — ${effective} — ${combatant.allianceId}`;
        orderList.append(item);
    }
    orderSection.append(orderList);
    results.append(orderSection);

    const blockSection = document.createElement("section");
    blockSection.className = "card card-body";
    const blockHeading = document.createElement("h3");
    blockHeading.className = "h5";
    blockHeading.textContent = "Derived turn blocks";
    blockSection.append(blockHeading);

    const blockGrid = document.createElement("div");
    blockGrid.className = "bi-blocks";
    for (const block of preview.blocks) {
        const card = document.createElement("article");
        card.className = "bi-block";
        const heading = document.createElement("strong");
        heading.textContent = `${block.id}: ${block.allianceId}`;
        card.append(heading);

        const memberList = document.createElement("ol");
        for (const memberId of block.memberOrder) {
            const member = combatantById.get(memberId);
            const item = document.createElement("li");
            item.textContent = member
                ? `${member.name} (${member.initiativeTotal})`
                : memberId;
            memberList.append(item);
        }
        card.append(memberList);
        blockGrid.append(card);
    }
    blockSection.append(blockGrid);

    if (preview.cyclicMerge) {
        const merge = document.createElement("p");
        merge.className = "bi-warning mt-2";
        merge.textContent = `Cyclic merge pending: ${preview.cyclicMerge.bottomBlockId} skips its separate round-one activation and joins ${preview.cyclicMerge.topBlockId} at the top of round two.`;
        blockSection.append(merge);
    }

    results.append(blockSection);
}

function combatantRows(): HTMLTableRowElement[] {
    return Array.from(tbody.querySelectorAll("tr"));
}

function field<T extends HTMLElement>(
    row: HTMLTableRowElement,
    fieldName?: string,
    selector?: string
): T {
    const actualSelector = selector ?? `[data-field='${fieldName}']`;
    const element = row.querySelector(actualSelector);
    if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing combatant field ${fieldName ?? actualSelector}.`);
    }
    return element as T;
}

function showMessage(text: string, isError: boolean): void {
    message.hidden = false;
    message.className = isError ? "bi-error" : "bi-warning";
    message.textContent = text;
}

function clearMessage(): void {
    message.hidden = true;
    message.textContent = "";
}

function setActionsDisabled(disabled: boolean): void {
    previewButton.disabled = disabled;
    overrideButton.disabled = disabled;
}
