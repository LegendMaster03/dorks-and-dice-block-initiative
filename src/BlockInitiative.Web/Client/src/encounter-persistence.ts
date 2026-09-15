import type {
    InitiativePreviewRequest,
    InitiativePreviewResponse,
    InitiativeTurnStateRequest,
    InitiativeTurnStateResponse
} from "./api";
import { registerAfterRender, requestEnhancement } from "./render-lifecycle";

type SavedView = "setup" | "preview" | "running" | "editing";
type CombatantBlockType = "standard" | "kaiju";

type PreviewDetail = {
    request: InitiativePreviewRequest;
    response: InitiativePreviewResponse;
};

type StateDetail = {
    request: InitiativeTurnStateRequest;
    response: InitiativeTurnStateResponse;
};

type SavedControl = {
    key: string;
    value: string;
    checked: boolean | null;
};

type SavedCondition = {
    name: string;
    note: string;
    href: string | null;
};

type SavedCombatant = {
    id: string;
    name: string;
    initiative: string;
    modifier: string;
    blockType: CombatantBlockType;
    controllerId: string;
    rulesReference: string;
    campaignCharacterId: string | null;
    campaignId: string | null;
    templateId: string | null;
    instanceNumber: string | null;
    autoName: string | null;
    monsterMetaText: string;
    setupAreaCount: number;
    setupControls: SavedControl[];
    conditions: SavedCondition[];
};

type SavedEnemyGroup = {
    groupId: string;
    name: string;
    sharedRoll: string;
    members: SavedCombatant[];
};

type SavedOtherBlock = {
    groupId: string;
    name: string;
    blockType: CombatantBlockType;
    members: SavedCombatant[];
};

type SavedOtherSide = {
    sideKey: string;
    name: string;
    blocks: SavedOtherBlock[];
};

type SavedStandardRuntime = {
    currentHp: string;
    maxHp: string;
};

type SavedKaijuAreaRuntime = {
    name: string;
    currentHp: string;
    maxHp: string;
    targetable: boolean;
};

type SavedKaijuRuntime = {
    chaosCurrent: string;
    chaosMax: string;
    behaviourPhase: string;
    finishingTarget: string;
    finishingDamageThisTurn: string;
    areas: SavedKaijuAreaRuntime[];
};

type SavedRunnerCombat = {
    standard: Record<string, SavedStandardRuntime>;
    kaiju: Record<string, SavedKaijuRuntime>;
};

type SavedRulesCoreLink = Record<string, unknown> & { templateId: string };

type SavedEncounter = {
    version: 1;
    savedAt: string;
    view: SavedView;
    campaignId: string | null;
    groupMode: "individual" | "average" | "shared";
    players: SavedCombatant[];
    enemyGroups: SavedEnemyGroup[];
    kaiju: SavedCombatant[];
    otherSides: SavedOtherSide[];
    preview: PreviewDetail | null;
    state: StateDetail | null;
    runnerCombat: SavedRunnerCombat;
    rulesCoreLinks: SavedRulesCoreLink[];
};

const storageKey = "dorks-and-dice:block-initiative:encounter:v1";
const saveDelayMs = 80;
const maxReplayAdvances = 1000;

let initialized = false;
let resetting = false;
let restoring = false;
let restorePhase: "idle" | "await-preview" | "await-state" = "idle";
let replayAdvances = 0;
let saveTimer: number | null = null;
let pendingRestore: SavedEncounter | null = null;
let lastPreview: PreviewDetail | null = null;
let lastState: StateDetail | null = null;
const rulesCoreLinks = new Map<string, SavedRulesCoreLink>();
const restoredConditionLinks = new Map<string, SavedCondition[]>();

export function initializeEncounterPersistence(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    pendingRestore = readSavedEncounter();
    restoring = pendingRestore !== null;
    if (pendingRestore) {
        lastPreview = pendingRestore.preview;
        lastState = pendingRestore.state;
        for (const detail of pendingRestore.rulesCoreLinks) rulesCoreLinks.set(detail.templateId, detail);
        refreshConditionLinkCache(pendingRestore);
    }

    root.addEventListener("input", () => scheduleSave(root));
    root.addEventListener("change", () => scheduleSave(root));
    root.addEventListener("click", () => scheduleSave(root));

    window.addEventListener("block-initiative:preview", event => {
        lastPreview = (event as CustomEvent<PreviewDetail>).detail ?? null;
        if (!restoring) {
            scheduleSave(root);
            return;
        }
        if (restorePhase === "await-preview") window.setTimeout(() => continueAfterPreview(root), 0);
    });

    window.addEventListener("block-initiative:state", event => {
        lastState = (event as CustomEvent<StateDetail>).detail ?? null;
        if (!restoring) {
            scheduleSave(root);
            return;
        }
        if (restorePhase === "await-state") window.setTimeout(() => replaySavedTurn(root), 0);
    });

    window.addEventListener("block-initiative:campaign-change", () => scheduleSave(root));
    window.addEventListener("block-initiative:rules-core-template-link", event => {
        const cloned = cloneRulesCoreLink((event as CustomEvent<unknown>).detail);
        if (cloned) rulesCoreLinks.set(cloned.templateId, cloned);
        scheduleSave(root);
    });

    window.addEventListener("beforeunload", () => {
        if (!resetting && !restoring) saveNow(root);
    });

    registerAfterRender("encounter-persistence", 220, () => {
        ensurePersistenceBar(root);
        ensureRestoredConditionLinks(root);
    });

    ensurePersistenceBar(root);
    if (pendingRestore) {
        window.setTimeout(() => void restoreEncounter(root, pendingRestore!), 0);
    }
}

function ensurePersistenceBar(root: HTMLElement): void {
    const header = root.querySelector<HTMLElement>("header");
    if (!header || header.querySelector("[data-encounter-persistence-bar]")) return;

    const bar = document.createElement("div");
    bar.className = "bi-row";
    bar.dataset.encounterPersistenceBar = "true";

    const status = document.createElement("span");
    status.className = "bi-muted";
    status.dataset.encounterPersistenceStatus = "true";
    status.textContent = restoring
        ? "Restoring the saved encounter from this browser…"
        : "Encounter changes save automatically in this browser until you reset them.";

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "btn btn-sm btn-outline-danger";
    reset.dataset.action = "reset-persisted-encounter";
    reset.textContent = "Reset encounter";
    reset.onclick = () => {
        if (!window.confirm("Reset this encounter? This clears the saved encounter from this browser and starts a blank encounter.")) return;
        resetting = true;
        if (saveTimer !== null) window.clearTimeout(saveTimer);
        try {
            window.localStorage.removeItem(storageKey);
        } catch {
            // Reload still resets the current in-memory encounter when storage is unavailable.
        }
        window.location.reload();
    };

    bar.append(status, reset);
    header.append(bar);
}

function setPersistenceStatus(root: HTMLElement, text: string): void {
    const status = root.querySelector<HTMLElement>("[data-encounter-persistence-status]");
    if (status) status.textContent = text;
}

function scheduleSave(root: HTMLElement): void {
    if (resetting || restoring) return;
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
        saveTimer = null;
        saveNow(root);
    }, saveDelayMs);
}

function saveNow(root: HTMLElement): void {
    if (resetting || restoring) return;
    const snapshot = captureEncounter(root);
    refreshConditionLinkCache(snapshot);
    try {
        window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
        setPersistenceStatus(root, "Encounter saved in this browser. It will remain until you reset it.");
    } catch {
        setPersistenceStatus(root, "Browser storage is unavailable, so this encounter can not be saved through reloads.");
    }
}

function captureEncounter(root: HTMLElement): SavedEncounter {
    const players = root.querySelector<HTMLElement>("[data-role='players']");
    const enemyGroups = root.querySelector<HTMLElement>("[data-role='enemy-groups']");
    const kaijuList = root.querySelector<HTMLElement>("[data-role='kaiju-list']");
    const others = root.querySelector<HTMLElement>("[data-role='others']");
    const groupMode = root.querySelector<HTMLSelectElement>("[data-role='enemy-method']")?.value;

    return {
        version: 1,
        savedAt: new Date().toISOString(),
        view: captureView(root),
        campaignId: root.dataset.campaignId ?? null,
        groupMode: groupMode === "individual" || groupMode === "shared" ? groupMode : "average",
        players: players ? directCards(players).map(captureCombatant) : [],
        enemyGroups: enemyGroups
            ? Array.from(enemyGroups.querySelectorAll<HTMLElement>(":scope > .bi-tactical-group")).map(captureEnemyGroup)
            : [],
        kaiju: kaijuList ? directCards(kaijuList).map(captureCombatant) : [],
        otherSides: others
            ? Array.from(others.querySelectorAll<HTMLElement>(":scope > .bi-other-side")).map(captureOtherSide)
            : [],
        preview: lastPreview,
        state: lastState,
        runnerCombat: captureRunnerCombat(root),
        rulesCoreLinks: Array.from(rulesCoreLinks.values())
    };
}

function captureView(root: HTMLElement): SavedView {
    const setup = root.querySelector<HTMLElement>("[data-role='setup']");
    if (lastState && setup && !setup.hidden && setup.querySelector("[data-role='running-edit-note']")) return "editing";
    if (lastState && setup?.hidden) return "running";
    if (root.querySelector("[data-role='results'] .bi-blocks")) return "preview";
    return "setup";
}

function directCards(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(":scope > .bi-entry[data-id]"));
}

function captureEnemyGroup(group: HTMLElement): SavedEnemyGroup {
    const members = group.querySelector<HTMLElement>("[data-role='group-members']");
    return {
        groupId: group.dataset.groupId ?? crypto.randomUUID(),
        name: group.querySelector<HTMLInputElement>("[data-role='group-name']")?.value ?? "Enemy Group",
        sharedRoll: group.querySelector<HTMLInputElement>("[data-role='shared-roll']")?.value ?? "",
        members: members ? directCards(members).map(captureCombatant) : []
    };
}

function captureOtherSide(side: HTMLElement): SavedOtherSide {
    return {
        sideKey: side.dataset.sideKey ?? crypto.randomUUID(),
        name: side.querySelector<HTMLInputElement>("[data-role='side-name']")?.value ?? "Other side",
        blocks: Array.from(side.querySelectorAll<HTMLElement>("[data-role='side-blocks'] > .bi-other-side-block")).map(block => ({
            groupId: block.dataset.groupId ?? crypto.randomUUID(),
            name: block.querySelector<HTMLInputElement>("[data-role='group-name']")?.value ?? "Block",
            blockType: block.dataset.sideBlockType === "kaiju" ? "kaiju" : "standard",
            members: directCards(block.querySelector<HTMLElement>("[data-role='group-members']") ?? block).map(captureCombatant)
        }))
    };
}

function captureCombatant(card: HTMLElement): SavedCombatant {
    const panel = card.querySelector<HTMLElement>("[data-combat-setup]");
    const blockType = card.querySelector<HTMLSelectElement>("[data-field='block-type']")?.value === "kaiju" ? "kaiju" : "standard";
    return {
        id: card.dataset.id ?? crypto.randomUUID(),
        name: card.querySelector<HTMLInputElement>("[data-field='name']")?.value ?? "",
        initiative: card.querySelector<HTMLInputElement>("[data-field='initiative']")?.value ?? "",
        modifier: card.querySelector<HTMLInputElement>("[data-field='modifier']")?.value ?? "",
        blockType,
        controllerId: card.querySelector<HTMLSelectElement>("[data-field='controller']")?.value ?? "",
        rulesReference: card.querySelector<HTMLInputElement>("[data-field='rules-reference']")?.value ?? "",
        campaignCharacterId: card.dataset.campaignCharacterId ?? null,
        campaignId: card.dataset.campaignId ?? null,
        templateId: card.dataset.templateId ?? null,
        instanceNumber: card.dataset.instanceNumber ?? null,
        autoName: card.dataset.autoName ?? null,
        monsterMetaText: card.querySelector<HTMLElement>("[data-role='monster-meta']")?.textContent ?? "",
        setupAreaCount: panel?.querySelectorAll(".bi-area-row").length ?? 0,
        setupControls: panel ? captureControls(panel) : [],
        conditions: captureConditions(card)
    };
}

function captureConditions(card: HTMLElement): SavedCondition[] {
    const editor = card.querySelector<HTMLElement>(":scope > .bi-condition-setup [data-condition-editor-for]");
    if (!editor) return [];
    return Array.from(editor.querySelectorAll<HTMLElement>(".bi-condition-chip-wrap")).map(wrapper => {
        const menu = wrapper.querySelector<HTMLElement>(".bi-condition-menu");
        return {
            name: menu?.querySelector("strong")?.textContent?.trim() ?? wrapper.querySelector(".bi-condition-chip")?.textContent?.trim() ?? "Condition",
            note: menu?.querySelector<HTMLInputElement>("input")?.value.trim() ?? "",
            href: menu?.querySelector<HTMLAnchorElement>("a[href]")?.href ?? null
        };
    });
}

function captureControls(scope: HTMLElement): SavedControl[] {
    const controls = Array.from(scope.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select"));
    return controls.map(control => ({
        key: controlKey(control, scope),
        value: control.value,
        checked: control instanceof HTMLInputElement && control.type === "checkbox" ? control.checked : null
    }));
}

function controlKey(control: HTMLInputElement | HTMLSelectElement, scope: HTMLElement): string {
    const area = control.closest<HTMLElement>(".bi-area-row");
    const areas = Array.from(scope.querySelectorAll<HTMLElement>(".bi-area-row"));
    const areaPrefix = area ? `area:${areas.indexOf(area)}:` : "";
    const field = control.closest<HTMLElement>(".bi-field, .bi-inline-check");
    const explicit = field?.querySelector(":scope > label")?.textContent?.trim();
    const fallback = field?.textContent?.trim() || control.dataset.field || control.dataset.role || control.name || "control";
    const kind = control instanceof HTMLSelectElement ? "select" : control.type || "input";
    return `${areaPrefix}${explicit || fallback}|${kind}`;
}

function captureRunnerCombat(root: HTMLElement): SavedRunnerCombat {
    const result: SavedRunnerCombat = { standard: {}, kaiju: {} };
    const ordered = lastPreview?.response.orderedCombatants ?? [];
    const dashboard = root.querySelector<HTMLElement>("[data-combat-dashboard]");
    if (!dashboard) return result;

    const standards = ordered.filter(combatant => combatant.allianceId !== "players" && combatant.blockType === "standard");
    const healthRows = Array.from(dashboard.querySelectorAll<HTMLElement>(".bi-health-row"));
    standards.forEach((combatant, index) => {
        const row = healthRows[index];
        if (!row) return;
        result.standard[combatant.id] = {
            currentHp: inputByLabel(row, "Current HP")?.value ?? "",
            maxHp: inputByLabel(row, "Max HP")?.value ?? ""
        };
    });

    const kaijus = ordered.filter(combatant => combatant.blockType === "kaiju");
    const panels = Array.from(dashboard.querySelectorAll<HTMLElement>(".bi-kaiju-panel"));
    kaijus.forEach((combatant, index) => {
        const panel = panels[index];
        if (!panel) return;
        const chaosSection = directSection(panel, "Chaos Threshold");
        const areaSection = directSection(panel, "Vulnerable Areas");
        const finishingSection = directSection(panel, "Finishing Blow");
        result.kaiju[combatant.id] = {
            chaosCurrent: chaosSection ? inputByLabel(chaosSection, "Current")?.value ?? "" : "",
            chaosMax: chaosSection ? inputByLabel(chaosSection, "Maximum")?.value ?? "" : "",
            behaviourPhase: inputByLabel(panel, "Current behaviour / phase")?.value ?? "",
            finishingTarget: finishingSection ? inputByLabel(finishingSection, "Target")?.value ?? "" : "",
            finishingDamageThisTurn: finishingSection ? inputByLabel(finishingSection, "Damage this turn")?.value ?? "" : "",
            areas: areaSection
                ? Array.from(areaSection.querySelectorAll<HTMLElement>(".bi-area-row")).map(row => ({
                    name: row.querySelector("strong")?.textContent?.trim() ?? "Vulnerable Area",
                    currentHp: inputByLabel(row, "Current HP")?.value ?? "",
                    maxHp: inputByLabel(row, "Max HP")?.value ?? "",
                    targetable: checkboxByText(row, "Targetable")?.checked ?? false
                }))
                : []
        };
    });

    return result;
}

function directSection(panel: HTMLElement, heading: string): HTMLElement | null {
    return Array.from(panel.querySelectorAll<HTMLElement>(":scope > section"))
        .find(section => section.querySelector(":scope > strong")?.textContent?.trim() === heading) ?? null;
}

function inputByLabel(scope: HTMLElement, labelText: string): HTMLInputElement | null {
    for (const field of scope.querySelectorAll<HTMLElement>(".bi-field")) {
        if (field.querySelector("label")?.textContent?.trim() !== labelText) continue;
        const input = field.querySelector<HTMLInputElement>("input");
        if (input) return input;
    }
    return null;
}

function checkboxByText(scope: HTMLElement, labelText: string): HTMLInputElement | null {
    for (const label of scope.querySelectorAll<HTMLElement>(".bi-inline-check")) {
        if (!label.textContent?.includes(labelText)) continue;
        const input = label.querySelector<HTMLInputElement>("input[type='checkbox']");
        if (input) return input;
    }
    return null;
}

async function restoreEncounter(root: HTMLElement, saved: SavedEncounter): Promise<void> {
    try {
        setPersistenceStatus(root, "Restoring the saved encounter from this browser…");
        clearRoster(root);
        restoreGroupMode(root, saved.groupMode);

        for (const combatant of saved.players) {
            const card = clickForNewCard(root.querySelector<HTMLButtonElement>("[data-action='add-player']"), root.querySelector<HTMLElement>("[data-role='players']"));
            if (card) applyCombatantBase(card, combatant);
        }

        for (const savedGroup of saved.enemyGroups) restoreEnemyGroup(root, savedGroup);

        for (const combatant of saved.kaiju) {
            const card = clickForNewCard(root.querySelector<HTMLButtonElement>("[data-action='add-kaiju']"), root.querySelector<HTMLElement>("[data-role='kaiju-list']"));
            if (card) applyCombatantBase(card, combatant);
        }

        for (const side of saved.otherSides) restoreOtherSide(root, side);

        restoreControllerOptions(root, saved);
        requestEnhancement();
        await nextTask();
        requestEnhancement();
        await nextTask();

        restoreEnhancementState(root, saved);
        restoreRunnerValuesIntoSetup(root, saved.runnerCombat);
        restoreConditions(root, saved);
        replayRulesCoreLinks();
        void restoreCampaignSelection(root, saved.campaignId);
        requestEnhancement();
        await nextTask();

        if (saved.view === "setup") {
            completeRestore(root);
            return;
        }

        const manualOrder = saved.state?.request.manualOrderOverride ?? saved.preview?.request.manualOrderOverride ?? null;
        const api = await import("./api");
        api.setRuntimeManualOrder(manualOrder);

        const preview = root.querySelector<HTMLButtonElement>("[data-action='preview']");
        if (!preview || !(await waitFor(() => !preview.disabled, 1200))) {
            throw new Error("The saved encounter roster is not ready to rebuild.");
        }
        restorePhase = "await-preview";
        preview.click();
    } catch (error) {
        failRestore(root, error);
    }
}

function clearRoster(root: HTMLElement): void {
    root.querySelector<HTMLElement>("[data-role='players']")?.replaceChildren();
    root.querySelector<HTMLElement>("[data-role='enemy-groups']")?.replaceChildren();
    root.querySelector<HTMLElement>("[data-role='kaiju-list']")?.replaceChildren();
    root.querySelector<HTMLElement>("[data-role='others']")?.replaceChildren();
}

function restoreGroupMode(root: HTMLElement, mode: SavedEncounter["groupMode"]): void {
    const select = root.querySelector<HTMLSelectElement>("[data-role='enemy-method']");
    if (!select) return;
    select.value = mode;
    select.dispatchEvent(new Event("change", { bubbles: true }));
}

function restoreEnemyGroup(root: HTMLElement, saved: SavedEnemyGroup): void {
    const container = root.querySelector<HTMLElement>("[data-role='enemy-groups']");
    const add = root.querySelector<HTMLButtonElement>("[data-action='add-group']");
    if (!container || !add) return;
    const before = new Set(Array.from(container.querySelectorAll<HTMLElement>(":scope > .bi-tactical-group")));
    add.click();
    const group = Array.from(container.querySelectorAll<HTMLElement>(":scope > .bi-tactical-group")).find(candidate => !before.has(candidate));
    if (!group) return;
    group.dataset.groupId = saved.groupId;
    setInputValue(group.querySelector<HTMLInputElement>("[data-role='group-name']"), saved.name, true);
    setInputValue(group.querySelector<HTMLInputElement>("[data-role='shared-roll']"), saved.sharedRoll, true);

    const members = group.querySelector<HTMLElement>("[data-role='group-members']");
    const addMember = group.querySelector<HTMLButtonElement>("[data-action='add-member']");
    for (const combatant of saved.members) {
        const card = clickForNewCard(addMember, members);
        if (card) applyCombatantBase(card, combatant);
    }
}

function restoreOtherSide(root: HTMLElement, saved: SavedOtherSide): void {
    const others = root.querySelector<HTMLElement>("[data-role='others']");
    const add = root.querySelector<HTMLButtonElement>("[data-action='add-other']");
    if (!others || !add) return;
    const before = new Set(Array.from(others.querySelectorAll<HTMLElement>(":scope > .bi-other-side")));
    add.click();
    const side = Array.from(others.querySelectorAll<HTMLElement>(":scope > .bi-other-side")).find(candidate => !before.has(candidate));
    if (!side) return;

    side.dataset.sideKey = saved.sideKey;
    setInputValue(side.querySelector<HTMLInputElement>("[data-role='side-name']"), saved.name, true);
    side.querySelector<HTMLElement>("[data-role='side-blocks']")?.replaceChildren();

    for (const savedBlock of saved.blocks) {
        const action = side.querySelector<HTMLButtonElement>(savedBlock.blockType === "kaiju"
            ? "[data-side-action='add-kaiju-block']"
            : "[data-side-action='add-standard-block']");
        const blockContainer = side.querySelector<HTMLElement>("[data-role='side-blocks']");
        if (!action || !blockContainer) continue;
        const oldBlocks = new Set(Array.from(blockContainer.querySelectorAll<HTMLElement>(":scope > .bi-other-side-block")));
        action.click();
        const block = Array.from(blockContainer.querySelectorAll<HTMLElement>(":scope > .bi-other-side-block")).find(candidate => !oldBlocks.has(candidate));
        if (!block) continue;
        block.dataset.groupId = savedBlock.groupId;
        setInputValue(block.querySelector<HTMLInputElement>("[data-role='group-name']"), savedBlock.name, true);

        const members = block.querySelector<HTMLElement>("[data-role='group-members']");
        const initial = members ? directCards(members)[0] ?? null : null;
        savedBlock.members.forEach((combatant, index) => {
            const card = index === 0
                ? initial
                : clickForNewCard(block.querySelector<HTMLButtonElement>("[data-side-action='add-member']"), members);
            if (card) applyCombatantBase(card, combatant);
        });
        if (savedBlock.members.length === 0) members?.replaceChildren();
    }
}

function clickForNewCard(button: HTMLButtonElement | null, scope: HTMLElement | null): HTMLElement | null {
    if (!button || !scope) return null;
    const before = new Set(Array.from(scope.querySelectorAll<HTMLElement>(".bi-entry[data-id]")));
    button.click();
    return Array.from(scope.querySelectorAll<HTMLElement>(".bi-entry[data-id]")).find(candidate => !before.has(candidate)) ?? null;
}

function applyCombatantBase(card: HTMLElement, saved: SavedCombatant): void {
    card.dataset.id = saved.id;
    setDataset(card, "campaignCharacterId", saved.campaignCharacterId);
    setDataset(card, "campaignId", saved.campaignId);
    setDataset(card, "templateId", saved.templateId);
    setDataset(card, "instanceNumber", saved.instanceNumber);

    const blockType = card.querySelector<HTMLSelectElement>("[data-field='block-type']");
    if (blockType && blockType.value !== saved.blockType) {
        blockType.value = saved.blockType;
        blockType.dispatchEvent(new Event("change", { bubbles: true }));
    }

    setInputValue(card.querySelector<HTMLInputElement>("[data-field='name']"), saved.name, false);
    setInputValue(card.querySelector<HTMLInputElement>("[data-field='initiative']"), saved.initiative, true);
    setInputValue(card.querySelector<HTMLInputElement>("[data-field='modifier']"), saved.modifier, true);
    setInputValue(card.querySelector<HTMLInputElement>("[data-field='rules-reference']"), saved.rulesReference, false);
    if (saved.autoName !== null) card.dataset.autoName = saved.autoName;

    const meta = card.querySelector<HTMLElement>("[data-role='monster-meta']");
    if (meta) {
        meta.textContent = saved.monsterMetaText;
        meta.hidden = saved.monsterMetaText.length === 0;
    }
}

function setDataset(element: HTMLElement, key: string, value: string | null): void {
    if (value === null) delete element.dataset[key];
    else element.dataset[key] = value;
}

function setInputValue(input: HTMLInputElement | null, value: string, dispatch: boolean): void {
    if (!input) return;
    input.value = value;
    if (!dispatch) return;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
}

function restoreControllerOptions(root: HTMLElement, saved: SavedEncounter): void {
    const savedCombatants = allSavedCombatants(saved);
    const currentCards = Array.from(root.querySelectorAll<HTMLElement>(".bi-entry[data-id]"));
    const byId = new Map(currentCards.map(card => [card.dataset.id ?? "", card]));
    for (const combatant of savedCombatants) {
        const card = byId.get(combatant.id);
        const select = card?.querySelector<HTMLSelectElement>("[data-field='controller']");
        if (!select) continue;
        select.replaceChildren(new Option("No controller", ""));
        for (const candidate of savedCombatants) {
            if (candidate.id === combatant.id) continue;
            select.add(new Option(candidate.name || "(unnamed)", candidate.id));
        }
        if (combatant.controllerId && Array.from(select.options).some(option => option.value === combatant.controllerId)) {
            select.value = combatant.controllerId;
        }
    }
}

function allSavedCombatants(saved: SavedEncounter): SavedCombatant[] {
    return [
        ...saved.players,
        ...saved.enemyGroups.flatMap(group => group.members),
        ...saved.kaiju,
        ...saved.otherSides.flatMap(side => side.blocks.flatMap(block => block.members))
    ];
}

function restoreEnhancementState(root: HTMLElement, saved: SavedEncounter): void {
    for (const combatant of allSavedCombatants(saved)) {
        const card = root.querySelector<HTMLElement>(`.bi-entry[data-id='${cssEscape(combatant.id)}']`);
        const panel = card?.querySelector<HTMLElement>("[data-combat-setup]");
        if (!panel) continue;
        if (panel.dataset.combatSetup === "kaiju") resizeKaijuAreas(panel, combatant.setupAreaCount);
        applyControls(panel, combatant.setupControls);
    }
}

function resizeKaijuAreas(panel: HTMLElement, targetCount: number): void {
    const count = () => panel.querySelectorAll(".bi-area-row").length;
    const add = panel.querySelector<HTMLButtonElement>("[data-action='add-area']");
    while (add && count() < targetCount) add.click();
    while (count() > targetCount) {
        const rows = Array.from(panel.querySelectorAll<HTMLElement>(".bi-area-row"));
        const last = rows.at(-1);
        const remove = Array.from(last?.querySelectorAll<HTMLButtonElement>("button") ?? []).find(button => button.textContent?.trim() === "Remove");
        if (!remove) break;
        remove.click();
    }
}

function applyControls(scope: HTMLElement, savedControls: SavedControl[]): void {
    const current = Array.from(scope.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select"));
    const byKey = new Map(current.map(control => [controlKey(control, scope), control]));
    for (const saved of savedControls) {
        const control = byKey.get(saved.key);
        if (!control) continue;
        if (control instanceof HTMLInputElement && saved.checked !== null) control.checked = saved.checked;
        else control.value = saved.value;
        control.dispatchEvent(new Event("input", { bubbles: true }));
        control.dispatchEvent(new Event("change", { bubbles: true }));
    }
}

function restoreRunnerValuesIntoSetup(root: HTMLElement, saved: SavedRunnerCombat): void {
    for (const [id, hp] of Object.entries(saved.standard)) {
        const card = root.querySelector<HTMLElement>(`.bi-entry[data-id='${cssEscape(id)}']`);
        const panel = card?.querySelector<HTMLElement>("[data-combat-setup='standard']");
        if (!panel) continue;
        setLabeledInput(panel, "Max HP", hp.maxHp);
        setLabeledInput(panel, "Current HP", hp.currentHp);
    }

    for (const [id, kaiju] of Object.entries(saved.kaiju)) {
        const card = root.querySelector<HTMLElement>(`.bi-entry[data-id='${cssEscape(id)}']`);
        const panel = card?.querySelector<HTMLElement>("[data-combat-setup='kaiju']");
        if (!panel) continue;
        setLabeledInput(panel, "Chaos Threshold", kaiju.chaosMax);
        setLabeledInput(panel, "Current Chaos", kaiju.chaosCurrent);
        setLabeledInput(panel, "Finishing Blow", kaiju.finishingTarget);
        setLabeledInput(panel, "Current behaviour / phase", kaiju.behaviourPhase);

        const rows = Array.from(panel.querySelectorAll<HTMLElement>(".bi-area-row"));
        kaiju.areas.forEach((area, index) => {
            const row = rows[index];
            if (!row) return;
            setLabeledInput(row, "Name", area.name);
            setLabeledInput(row, "Max HP", area.maxHp);
            setLabeledInput(row, "Current HP", area.currentHp);
            const targetable = checkboxByText(row, "Targetable");
            if (targetable) {
                targetable.checked = area.targetable;
                targetable.dispatchEvent(new Event("change", { bubbles: true }));
            }
        });
    }
}

function setLabeledInput(scope: HTMLElement, label: string, value: string): void {
    const input = inputByLabel(scope, label);
    if (!input) return;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
}

function restoreConditions(root: HTMLElement, saved: SavedEncounter): void {
    for (const combatant of allSavedCombatants(saved)) {
        for (const condition of combatant.conditions) addManualCondition(root, combatant.id, condition);
    }
    ensureRestoredConditionLinks(root);
}

function addManualCondition(root: HTMLElement, combatantId: string, condition: SavedCondition): void {
    const card = root.querySelector<HTMLElement>(`.bi-entry[data-id='${cssEscape(combatantId)}']`);
    const editor = card?.querySelector<HTMLElement>(":scope > .bi-condition-setup [data-condition-editor-for]");
    const add = editor?.querySelector<HTMLButtonElement>(".bi-condition-add");
    if (!editor || !add) return;
    add.click();
    const picker = editor.querySelector<HTMLElement>(".bi-condition-picker");
    const search = picker?.querySelector<HTMLInputElement>("[data-role='condition-search']");
    const inputs = picker ? Array.from(picker.querySelectorAll<HTMLInputElement>("input")) : [];
    const note = inputs.find(input => input !== search) ?? null;
    if (!picker || !search) return;
    search.value = condition.name;
    search.dispatchEvent(new Event("input", { bubbles: true }));
    if (note) note.value = condition.note;
    const manual = Array.from(picker.querySelectorAll<HTMLButtonElement>("button")).find(button => button.textContent?.trim() === "Add manually");
    manual?.click();
}

function refreshConditionLinkCache(saved: SavedEncounter): void {
    restoredConditionLinks.clear();
    for (const combatant of allSavedCombatants(saved)) {
        if (combatant.conditions.some(condition => condition.href)) restoredConditionLinks.set(combatant.id, combatant.conditions);
    }
}

function ensureRestoredConditionLinks(root: HTMLElement): void {
    for (const [combatantId, conditions] of restoredConditionLinks) {
        const card = root.querySelector<HTMLElement>(`.bi-entry[data-id='${cssEscape(combatantId)}']`);
        const wrappers = Array.from(card?.querySelectorAll<HTMLElement>(":scope > .bi-condition-setup .bi-condition-chip-wrap") ?? []);
        conditions.forEach((condition, index) => {
            if (!condition.href) return;
            const wrapper = wrappers[index];
            const menu = wrapper?.querySelector<HTMLElement>(".bi-condition-menu");
            const actions = menu?.querySelector<HTMLElement>(".bi-condition-menu-actions");
            if (!menu || !actions || actions.querySelector("a[href]")) return;
            const link = document.createElement("a");
            link.className = "btn btn-sm btn-outline-secondary";
            link.href = condition.href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "View rule";
            actions.prepend(link);
        });
    }
}

function replayRulesCoreLinks(): void {
    for (const detail of rulesCoreLinks.values()) {
        window.dispatchEvent(new CustomEvent("block-initiative:rules-core-template-link", { detail }));
    }
}

async function restoreCampaignSelection(root: HTMLElement, campaignId: string | null): Promise<void> {
    if (!campaignId) return;
    root.dataset.campaignId = campaignId;
    const found = await waitFor(() => {
        const select = root.querySelector<HTMLSelectElement>("[data-role='campaign-select']");
        return Boolean(select && Array.from(select.options).some(option => option.value === campaignId));
    }, 2500);
    if (!found) return;
    const select = root.querySelector<HTMLSelectElement>("[data-role='campaign-select']");
    if (!select) return;
    select.value = campaignId;
    select.dispatchEvent(new Event("change", { bubbles: true }));
}

function continueAfterPreview(root: HTMLElement): void {
    if (!pendingRestore || !restoring || restorePhase !== "await-preview") return;
    if (pendingRestore.view === "preview" || !pendingRestore.state) {
        completeRestore(root);
        return;
    }

    const start = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-role='results'] button"))
        .find(button => button.textContent?.trim() === "Start encounter");
    if (!start) {
        failRestore(root, new Error("The saved running encounter could not be restarted from its initiative preview."));
        return;
    }
    restorePhase = "await-state";
    replayAdvances = 0;
    start.click();
}

function replaySavedTurn(root: HTMLElement): void {
    if (!pendingRestore?.state || !lastState || !restoring || restorePhase !== "await-state") return;
    if (sameTurnTarget(lastState.response, pendingRestore.state.response)) {
        void finishRunningRestore(root);
        return;
    }
    if (replayAdvances++ >= maxReplayAdvances) {
        failRestore(root, new Error("The saved active turn could not be reached while restoring the encounter."));
        return;
    }

    const next = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-role='results'] button"))
        .find(button => button.textContent?.trim() === "Next block");
    if (!next) {
        failRestore(root, new Error("The saved encounter runner could not continue to its stored active turn."));
        return;
    }
    next.click();
}

async function finishRunningRestore(root: HTMLElement): Promise<void> {
    if (!pendingRestore) return;
    requestEnhancement();
    await nextTask();
    restoreRunnerValues(root, pendingRestore.runnerCombat);
    requestEnhancement();
    await nextTask();

    if (pendingRestore.view === "editing") {
        const edit = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-role='results'] button"))
            .find(button => button.textContent?.trim() === "Add / edit combatants");
        edit?.click();
    }
    completeRestore(root);
}

function restoreRunnerValues(root: HTMLElement, saved: SavedRunnerCombat): void {
    const ordered = lastPreview?.response.orderedCombatants ?? [];
    const dashboard = root.querySelector<HTMLElement>("[data-combat-dashboard]");
    if (!dashboard) return;

    const standards = ordered.filter(combatant => combatant.allianceId !== "players" && combatant.blockType === "standard");
    const rows = Array.from(dashboard.querySelectorAll<HTMLElement>(".bi-health-row"));
    standards.forEach((combatant, index) => {
        const hp = saved.standard[combatant.id];
        const row = rows[index];
        if (!hp || !row) return;
        setLabeledInput(row, "Max HP", hp.maxHp);
        setLabeledInput(row, "Current HP", hp.currentHp);
    });

    const kaijus = ordered.filter(combatant => combatant.blockType === "kaiju");
    const panels = Array.from(dashboard.querySelectorAll<HTMLElement>(".bi-kaiju-panel"));
    kaijus.forEach((combatant, index) => {
        const state = saved.kaiju[combatant.id];
        const panel = panels[index];
        if (!state || !panel) return;
        const chaos = directSection(panel, "Chaos Threshold");
        const finishing = directSection(panel, "Finishing Blow");
        if (chaos) {
            setLabeledInput(chaos, "Maximum", state.chaosMax);
            setLabeledInput(chaos, "Current", state.chaosCurrent);
        }
        setLabeledInput(panel, "Current behaviour / phase", state.behaviourPhase);
        if (finishing) {
            setLabeledInput(finishing, "Target", state.finishingTarget);
            setLabeledInput(finishing, "Damage this turn", state.finishingDamageThisTurn);
        }
    });
}

function sameTurnTarget(current: InitiativeTurnStateResponse, target: InitiativeTurnStateResponse): boolean {
    if (current.round !== target.round || current.cyclicMergeCompleted !== target.cyclicMergeCompleted) return false;
    if (current.activeBlockId === null || target.activeBlockId === null) return current.activeBlockId === target.activeBlockId;
    if (current.activeBlockId === target.activeBlockId) return true;
    const currentBlock = current.blocks.find(block => block.id === current.activeBlockId);
    const targetBlock = target.blocks.find(block => block.id === target.activeBlockId);
    if (!currentBlock || !targetBlock) return false;
    const targetMembers = new Set(targetBlock.memberOrder);
    return currentBlock.memberOrder.some(id => targetMembers.has(id));
}

function completeRestore(root: HTMLElement): void {
    restoring = false;
    restorePhase = "idle";
    replayAdvances = 0;
    pendingRestore = null;
    setPersistenceStatus(root, "Saved encounter restored. Changes continue saving until you reset it.");
    scheduleSave(root);
}

function failRestore(root: HTMLElement, error: unknown): void {
    restoring = false;
    restorePhase = "idle";
    replayAdvances = 0;
    console.error("Block Initiative could not restore the saved encounter.", error);
    setPersistenceStatus(root, "The saved encounter could not be fully restored. It remains stored until you choose Reset encounter.");
}

function readSavedEncounter(): SavedEncounter | null {
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as unknown;
        return isSavedEncounter(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function isSavedEncounter(value: unknown): value is SavedEncounter {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<SavedEncounter>;
    return candidate.version === 1
        && typeof candidate.savedAt === "string"
        && (candidate.view === "setup" || candidate.view === "preview" || candidate.view === "running" || candidate.view === "editing")
        && Array.isArray(candidate.players)
        && Array.isArray(candidate.enemyGroups)
        && Array.isArray(candidate.kaiju)
        && Array.isArray(candidate.otherSides)
        && Boolean(candidate.runnerCombat && typeof candidate.runnerCombat === "object")
        && Array.isArray(candidate.rulesCoreLinks);
}

function cloneRulesCoreLink(value: unknown): SavedRulesCoreLink | null {
    if (!value || typeof value !== "object") return null;
    const templateId = (value as { templateId?: unknown }).templateId;
    if (typeof templateId !== "string" || !templateId.trim()) return null;
    try {
        const cloned = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
        return { ...cloned, templateId: templateId.trim() };
    } catch {
        return null;
    }
}

function cssEscape(value: string): string {
    return CSS.escape(value);
}

function nextTask(): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, 0));
}

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (predicate()) return true;
        await new Promise(resolve => window.setTimeout(resolve, 25));
    }
    return predicate();
}
