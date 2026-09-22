import {
    addCondition
} from "../conditions/condition-model";
import type { InitiativeTurnStateResponse } from "../api";
import {
    restoreKaijuRuntimeMetadata
} from "../combat/kaiju-combat-state";
import { restoreActedRounds } from "../combatant-turn-markers";
import {
    restoreCombatantReorderRuntime
} from "../initiative/combatant-reorder-state";
import {
    setInitiativeMode
} from "../initiative/initiative-mode";
import {
    NON_NEGATIVE_TRACKER_LIMITS,
    parseBoundedNumber,
    POSITIVE_TRACKER_LIMITS,
    TRACKER_LIMITS
} from "../numeric-input-limits";
import { requestEnhancement } from "../render-lifecycle";
import {
    checkboxByText,
    combatInput,
    controlKey,
    cssEscape,
    directCards,
    directSection,
    inputByLabel,
    runnerCard
} from "./encounter-dom";
import {
    allSavedCombatants
} from "./encounter-schema";
import type {
    PreviewDetail,
    SavedCombatant,
    SavedCondition,
    SavedControl,
    SavedEncounter,
    SavedEnemyGroup,
    SavedOtherSide,
    SavedRunnerCombat,
    StateDetail
} from "./encounter-schema";

const maxReplayAdvances = 10_000;

export type EncounterRestoreCallbacks = {
    onComplete: () => void;
    onFailure: (error: unknown) => void;
};

/**
 * Reconstructs one complete saved encounter.
 *
 * The session owns its asynchronous restore phase and replay counters so the
 * persistence coordinator does not need to understand roster reconstruction,
 * initiative replay, condition relinking, or combat-state restoration.
 */
export class EncounterRestoreSession {
    private phase: "idle" | "await-preview" | "await-state" = "idle";
    private replayAdvances = 0;
    private lastPreview: PreviewDetail | null;
    private lastState: StateDetail | null;

    public constructor(
        private readonly root: HTMLElement,
        private readonly saved: SavedEncounter,
        private readonly callbacks: EncounterRestoreCallbacks
    ) {
        this.lastPreview = saved.preview;
        this.lastState = saved.state;
    }

    public handlePreview(detail: PreviewDetail | null): void {
        this.lastPreview = detail;
        if (this.phase !== "await-preview") return;

        window.setTimeout(
            () => this.continueAfterPreview(),
            0);
    }

    public handleState(detail: StateDetail | null): void {
        this.lastState = detail;
        if (this.phase !== "await-state") return;

        window.setTimeout(
            () => this.replaySavedTurn(),
            0);
    }

    public handleApiFailure(error: unknown): void {
        if (this.phase === "idle") return;
        this.fail(error);
    }

    public ensureConditionLinks(): void {
        // Condition identity now lives in the model and survives rerenders.
    }

    public async start(): Promise<void> {
        try {
            setInitiativeMode(
                this.saved.initiativeMode);
            clearRoster(this.root);
            const legacySharedMode =
                this.saved.groupMode === "shared";
            restoreGroupMode(this.root, this.saved.groupMode);

            for (const combatant of this.saved.players) {
                const card = clickForNewCard(
                    this.root.querySelector<HTMLButtonElement>(
                        "[data-action='add-player']"),
                    this.root.querySelector<HTMLElement>(
                        "[data-role='players']"));
                if (card) applyCombatantBase(card, combatant);
            }

            for (const group of this.saved.enemyGroups) {
                restoreEnemyGroup(
                    this.root,
                    group,
                    legacySharedMode);
            }

            for (const combatant of this.saved.kaiju) {
                const card = clickForNewCard(
                    this.root.querySelector<HTMLButtonElement>(
                        "[data-action='add-kaiju']"),
                    this.root.querySelector<HTMLElement>(
                        "[data-role='kaiju-list']"));
                if (card) applyCombatantBase(card, combatant);
            }

            for (const side of this.saved.otherSides) {
                restoreOtherSide(this.root, side);
            }

            restoreControllerOptions(this.root, this.saved);

            requestEnhancement();
            await nextTask();
            requestEnhancement();
            await nextTask();

            restoreEnhancementState(this.root, this.saved);
            restoreRunnerValuesIntoSetup(
                this.root,
                this.saved.runnerCombat);
            restoreConditions(
                this.root,
                this.saved,
                this.ensureConditionLinks.bind(this));
            replayRulesCoreLinks(this.saved);
            await restoreCampaignSelection(
                this.root,
                this.saved.campaignId);

            requestEnhancement();
            await nextTask();

            if (this.saved.view === "setup") {
                this.complete();
                return;
            }

            const manualOrder =
                this.saved.state?.request.manualOrderOverride
                ?? this.saved.preview?.request.manualOrderOverride
                ?? null;

            const api = await import("../api");
            api.setRuntimeManualOrder(manualOrder);

            const preview =
                this.root.querySelector<HTMLButtonElement>(
                    "[data-action='preview']");

            if (!preview) {
                throw new Error(
                    "The saved encounter preview control is unavailable.");
            }

            await waitForPreviewReady(
                this.root,
                preview);

            this.phase = "await-preview";
            preview.click();
        } catch (error) {
            this.fail(error);
        }
    }

    private continueAfterPreview(): void {
        if (this.phase !== "await-preview") return;

        if (this.saved.view === "preview"
            || !this.saved.state) {
            this.complete();
            return;
        }

        const start =
            this.root.querySelector<HTMLButtonElement>(
                "[data-role='results'] [data-action='start-encounter']");

        if (!start) {
            this.fail(new Error(
                "The saved running encounter could not be restarted "
                + "from its initiative preview."));
            return;
        }

        this.phase = "await-state";
        this.replayAdvances = 0;
        start.click();
    }

    private replaySavedTurn(): void {
        if (!this.saved.state
            || !this.lastState
            || this.phase !== "await-state") {
            return;
        }

        if (sameTurnTarget(
            this.lastState.response,
            this.saved.state.response)) {
            void this.finishRunningRestore();
            return;
        }

        if (this.replayAdvances++ >= maxReplayAdvances) {
            this.fail(new Error(
                "The saved active turn could not be reached "
                + "while restoring the encounter."));
            return;
        }

        const next =
            this.root.querySelector<HTMLButtonElement>(
                "[data-role='results'] [data-action='next-turn']");

        if (!next) {
            this.fail(new Error(
                "The saved encounter runner could not continue "
                + "to its stored active turn."));
            return;
        }

        next.click();
    }

    private async finishRunningRestore(): Promise<void> {
        requestEnhancement();
        await nextTask();

        restoreRunnerValues(
            this.root,
            this.saved.runnerCombat,
            this.lastPreview);
        restoreActedRounds(
            this.saved.actedRounds);
        restoreCombatantReorderRuntime(
            this.saved.reorderRuntime);

        requestEnhancement();
        await nextTask();

        if (this.saved.view === "editing") {
            this.root.querySelector<HTMLButtonElement>(
                "[data-role='results'] "
                + "[data-action='edit-running-encounter']")
                ?.click();
        }

        this.complete();
    }

    private complete(): void {
        this.phase = "idle";
        this.replayAdvances = 0;
        this.callbacks.onComplete();
    }

    private fail(error: unknown): void {
        this.phase = "idle";
        this.replayAdvances = 0;
        this.callbacks.onFailure(error);
    }
}

function clearRoster(root: HTMLElement): void {
    root.querySelector<HTMLElement>(
        "[data-role='players']")?.replaceChildren();
    root.querySelector<HTMLElement>(
        "[data-role='enemy-groups']")?.replaceChildren();
    root.querySelector<HTMLElement>(
        "[data-role='kaiju-list']")?.replaceChildren();
    root.querySelector<HTMLElement>(
        "[data-role='others']")?.replaceChildren();
}

function restoreGroupMode(
    root: HTMLElement,
    mode: SavedEncounter["groupMode"]
): void {
    const select =
        root.querySelector<HTMLSelectElement>(
            "[data-role='enemy-method']");
    if (!select) return;

    select.value =
        mode === "shared"
            ? "average"
            : mode;
    select.dispatchEvent(
        new Event("change", { bubbles: true }));
}

function restoreEnemyGroup(
    root: HTMLElement,
    saved: SavedEnemyGroup,
    migrateLegacySharedRoll: boolean
): void {
    const container =
        root.querySelector<HTMLElement>(
            "[data-role='enemy-groups']");
    const add =
        root.querySelector<HTMLButtonElement>(
            "[data-action='add-group']");
    if (!container || !add) return;

    const before = new Set(
        Array.from(
            container.querySelectorAll<HTMLElement>(
                ":scope > .bi-tactical-group")));
    add.click();

    const group =
        Array.from(
            container.querySelectorAll<HTMLElement>(
                ":scope > .bi-tactical-group"))
        .find(candidate => !before.has(candidate));
    if (!group) return;

    group.dataset.groupId = saved.groupId;
    setInputValue(
        group.querySelector<HTMLInputElement>(
            "[data-role='group-name']"),
        saved.name,
        true);
    setInputValue(
        group.querySelector<HTMLInputElement>(
            "[data-role='shared-roll']"),
        saved.sharedRoll,
        true);

    const members =
        group.querySelector<HTMLElement>(
            "[data-role='group-members']");
    const addMember =
        group.querySelector<HTMLButtonElement>(
            "[data-action='add-member']");

    for (const combatant of saved.members) {
        const card =
            clickForNewCard(addMember, members);
        if (!card) continue;

        applyCombatantBase(card, combatant);
        if (migrateLegacySharedRoll
            && saved.sharedRoll.trim()) {
            setInputValue(
                card.querySelector<HTMLInputElement>(
                    "[data-field='initiative']"),
                saved.sharedRoll,
                true);
        }
    }
}

function restoreOtherSide(
    root: HTMLElement,
    saved: SavedOtherSide
): void {
    const others =
        root.querySelector<HTMLElement>("[data-role='others']");
    const add =
        root.querySelector<HTMLButtonElement>(
            "[data-action='add-other']");
    if (!others || !add) return;

    const before = new Set(
        Array.from(
            others.querySelectorAll<HTMLElement>(
                ":scope > .bi-other-side")));
    add.click();

    const side =
        Array.from(
            others.querySelectorAll<HTMLElement>(
                ":scope > .bi-other-side"))
        .find(candidate => !before.has(candidate));
    if (!side) return;

    side.dataset.sideKey = saved.sideKey;
    setInputValue(
        side.querySelector<HTMLInputElement>(
            "[data-role='side-name']"),
        saved.name,
        true);
    side.querySelector<HTMLElement>(
        "[data-role='side-blocks']")
        ?.replaceChildren();

    for (const savedBlock of saved.blocks) {
        const action =
            side.querySelector<HTMLButtonElement>(
                savedBlock.blockType === "kaiju"
                    ? "[data-side-action='add-kaiju-block']"
                    : "[data-side-action='add-standard-block']");
        const blockContainer =
            side.querySelector<HTMLElement>(
                "[data-role='side-blocks']");
        if (!action || !blockContainer) continue;

        const oldBlocks = new Set(
            Array.from(
                blockContainer.querySelectorAll<HTMLElement>(
                    ":scope > .bi-other-side-block")));
        action.click();

        const block =
            Array.from(
                blockContainer.querySelectorAll<HTMLElement>(
                    ":scope > .bi-other-side-block"))
            .find(candidate => !oldBlocks.has(candidate));
        if (!block) continue;

        block.dataset.groupId = savedBlock.groupId;
        setInputValue(
            block.querySelector<HTMLInputElement>(
                "[data-role='group-name']"),
            savedBlock.name,
            true);

        const members =
            block.querySelector<HTMLElement>(
                "[data-role='group-members']");
        const initial =
            members ? directCards(members)[0] ?? null : null;

        savedBlock.members.forEach((combatant, index) => {
            const card =
                index === 0
                    ? initial
                    : clickForNewCard(
                        block.querySelector<HTMLButtonElement>(
                            "[data-side-action='add-member']"),
                        members);
            if (card) applyCombatantBase(card, combatant);
        });

        if (savedBlock.members.length === 0) {
            members?.replaceChildren();
        }
    }
}

function clickForNewCard(
    button: HTMLButtonElement | null,
    scope: HTMLElement | null
): HTMLElement | null {
    if (!button || !scope) return null;

    const before = new Set(
        Array.from(
            scope.querySelectorAll<HTMLElement>(
                ".bi-entry[data-id]")));
    button.click();

    return Array.from(
        scope.querySelectorAll<HTMLElement>(
            ".bi-entry[data-id]"))
        .find(candidate => !before.has(candidate))
        ?? null;
}

function applyCombatantBase(
    card: HTMLElement,
    saved: SavedCombatant
): void {
    card.dataset.id = saved.id;
    setDataset(
        card,
        "campaignCharacterId",
        saved.campaignCharacterId);
    setDataset(card, "campaignId", saved.campaignId);
    setDataset(card, "templateId", saved.templateId);
    setDataset(card, "instanceNumber", saved.instanceNumber);
    setDataset(
        card,
        "manualDuplicateKey",
        saved.manualDuplicateKey);
    setDataset(
        card,
        "manualDuplicateBase",
        saved.manualDuplicateBase);
    setDataset(
        card,
        "manualDuplicateIndex",
        saved.manualDuplicateIndex);

    const blockType =
        card.querySelector<HTMLSelectElement>(
            "[data-field='block-type']");
    if (blockType && blockType.value !== saved.blockType) {
        blockType.value = saved.blockType;
        blockType.dispatchEvent(
            new Event("change", { bubbles: true }));
    }

    setInputValue(
        card.querySelector<HTMLInputElement>(
            "[data-field='name']"),
        saved.name,
        false);
    setInputValue(
        card.querySelector<HTMLInputElement>(
            "[data-field='initiative']"),
        saved.initiative,
        true);
    setInputValue(
        card.querySelector<HTMLInputElement>(
            "[data-field='modifier']"),
        saved.modifier,
        true);
    setInputValue(
        card.querySelector<HTMLInputElement>(
            "[data-field='rules-reference']"),
        saved.rulesReference,
        false);

    if (saved.autoName !== null) {
        card.dataset.autoName = saved.autoName;
    }

    const meta =
        card.querySelector<HTMLElement>(
            "[data-role='monster-meta']");
    if (meta) {
        meta.textContent = saved.monsterMetaText;
        meta.hidden = saved.monsterMetaText.length === 0;
    }
}

function setDataset(
    element: HTMLElement,
    key: string,
    value: string | null
): void {
    if (value === null) delete element.dataset[key];
    else element.dataset[key] = value;
}

function setInputValue(
    input: HTMLInputElement | null,
    value: string,
    dispatch: boolean
): void {
    if (!input) return;

    input.value = value;
    if (!dispatch) return;

    input.dispatchEvent(
        new Event("input", { bubbles: true }));
    input.dispatchEvent(
        new Event("change", { bubbles: true }));
}

function restoreControllerOptions(
    root: HTMLElement,
    saved: SavedEncounter
): void {
    const savedCombatants = allSavedCombatants(saved);
    const currentCards =
        Array.from(
            root.querySelectorAll<HTMLElement>(
                ".bi-entry[data-id]"));
    const byId =
        new Map(
            currentCards.map(card => [
                card.dataset.id ?? "",
                card
            ]));

    for (const combatant of savedCombatants) {
        const card = byId.get(combatant.id);
        const select =
            card?.querySelector<HTMLSelectElement>(
                "[data-field='controller']");
        if (!select) continue;

        select.replaceChildren(
            new Option("No controller", ""));

        for (const candidate of savedCombatants) {
            if (candidate.id === combatant.id) continue;
            select.add(
                new Option(
                    candidate.name || "(unnamed)",
                    candidate.id));
        }

        if (combatant.controllerId
            && Array.from(select.options)
                .some(option =>
                    option.value === combatant.controllerId)) {
            select.value = combatant.controllerId;
        }
    }
}

function restoreEnhancementState(
    root: HTMLElement,
    saved: SavedEncounter
): void {
    for (const combatant of allSavedCombatants(saved)) {
        const card =
            root.querySelector<HTMLElement>(
                `.bi-entry[data-id='${cssEscape(combatant.id)}']`);
        if (!card) continue;

        restoreArmorClasses(card, combatant);

        const panel =
            card.querySelector<HTMLElement>(
                "[data-combat-setup]");
        if (!panel) continue;

        if (panel.dataset.combatSetup === "kaiju") {
            resizeKaijuAreas(
                panel,
                combatant.setupAreaCount);
        }

        applyControls(panel, combatant.setupControls);
    }
}

function restoreArmorClasses(
    card: HTMLElement,
    combatant: SavedCombatant
): void {
    restoreArmorClass(
        card,
        combatant.armorClass ?? "",
        "setup-armor-class",
        "armor-class");
    restoreArmorClass(
        card,
        combatant.touchArmorClass ?? "",
        "setup-touch-armor-class",
        "touch-armor-class");
    restoreArmorClass(
        card,
        combatant.flatFootedArmorClass ?? "",
        "setup-flat-footed-armor-class",
        "flat-footed-armor-class");
}

function restoreArmorClass(
    card: HTMLElement,
    armorClass: string,
    role: string,
    quickStat: string
): void {
    const input =
        card.querySelector<HTMLInputElement>(
            `:scope > .bi-entry-main [data-role='${role}']`)
        ?? card.querySelector<HTMLInputElement>(
            `:scope > [data-quick-stats-setup] [data-quick-stat='${quickStat}']`);
    if (!input) return;

    setInputAndDispatch(input, armorClass);
}
function resizeKaijuAreas(
    panel: HTMLElement,
    targetCount: number
): void {
    const count = () =>
        panel.querySelectorAll(".bi-area-row").length;
    const add =
        panel.querySelector<HTMLButtonElement>(
            "[data-action='add-area']");

    while (add && count() < targetCount) add.click();

    while (count() > targetCount) {
        const rows =
            Array.from(
                panel.querySelectorAll<HTMLElement>(
                    ".bi-area-row"));
        const last = rows.at(-1);
        const remove =
            Array.from(
                last?.querySelectorAll<HTMLButtonElement>(
                    "button")
                ?? [])
            .find(button =>
                button.textContent?.trim() === "Remove");

        if (!remove) break;
        remove.click();
    }
}

function applyControls(
    scope: HTMLElement,
    savedControls: SavedControl[]
): void {
    const current =
        Array.from(
            scope.querySelectorAll<
                HTMLInputElement | HTMLSelectElement>(
                    "input,select"));
    const byKey =
        new Map(
            current.map(control => [
                controlKey(control, scope),
                control
            ]));

    for (const saved of savedControls) {
        const control = byKey.get(saved.key);
        if (!control) continue;

        if (control instanceof HTMLInputElement
            && saved.checked !== null) {
            control.checked = saved.checked;
        } else {
            control.value = saved.value;
        }

        control.dispatchEvent(
            new Event("input", { bubbles: true }));
        control.dispatchEvent(
            new Event("change", { bubbles: true }));
    }
}

function restoreRunnerValuesIntoSetup(
    root: HTMLElement,
    saved: SavedRunnerCombat
): void {
    for (const [id, hp] of Object.entries(saved.standard)) {
        const card =
            root.querySelector<HTMLElement>(
                `.bi-entry[data-id='${cssEscape(id)}']`);
        const panel =
            card?.querySelector<HTMLElement>(
                "[data-combat-setup='standard']");
        if (!panel) continue;

        setLabeledInput(panel, "Max HP", hp.maxHp);
        setLabeledInput(panel, "Current HP", hp.currentHp);
    }

    for (const [id, kaiju] of Object.entries(saved.kaiju)) {
        const card =
            root.querySelector<HTMLElement>(
                `.bi-entry[data-id='${cssEscape(id)}']`);
        const panel =
            card?.querySelector<HTMLElement>(
                "[data-combat-setup='kaiju']");
        if (!panel) continue;

        setLabeledInput(
            panel,
            "Chaos Threshold",
            kaiju.chaosMax);
        setLabeledInput(
            panel,
            "Current Chaos",
            kaiju.chaosCurrent);
        setLabeledInput(
            panel,
            "Finishing Blow",
            kaiju.finishingTarget);
        setLabeledInput(
            panel,
            "Current behaviour / phase",
            kaiju.behaviourPhase);

        restoreKaijuRuntimeMetadata(
            id,
            {
                chaosCurrent:
                    parseBoundedNumber(
                        kaiju.chaosCurrent,
                        TRACKER_LIMITS),
                chaosMax:
                    parseBoundedNumber(
                        kaiju.chaosMax,
                        NON_NEGATIVE_TRACKER_LIMITS),
                behaviourPhase:
                    kaiju.behaviourPhase,
                finishingBlowTarget:
                    parseBoundedNumber(
                        kaiju.finishingTarget,
                        POSITIVE_TRACKER_LIMITS),
                finishingBlowDamageThisTurn:
                    parseBoundedNumber(
                        kaiju.finishingDamageThisTurn,
                        NON_NEGATIVE_TRACKER_LIMITS)
                    ?? 0,
                finishingBlowDamageByTurn:
                    kaiju.finishingDamageByTurn,
                defeatedRound:
                    typeof kaiju.defeatedRound === "number"
                    && parseBoundedNumber(
                        String(kaiju.defeatedRound),
                        POSITIVE_TRACKER_LIMITS) !== null
                        ? kaiju.defeatedRound
                        : null,
                areas:
                    kaiju.areas.map(area => ({
                        name: area.name,
                        currentHp:
                            parseBoundedNumber(
                                area.currentHp,
                                TRACKER_LIMITS),
                        maxHp:
                            parseBoundedNumber(
                                area.maxHp,
                                NON_NEGATIVE_TRACKER_LIMITS),
                        targetable:
                            area.targetable
                    }))
            });

        const rows =
            Array.from(
                panel.querySelectorAll<HTMLElement>(
                    ".bi-area-row"));

        kaiju.areas.forEach((area, index) => {
            const row = rows[index];
            if (!row) return;

            setLabeledInput(row, "Name", area.name);
            setLabeledInput(row, "Max HP", area.maxHp);
            setLabeledInput(
                row,
                "Current HP",
                area.currentHp);

            const targetable =
                checkboxByText(row, "Targetable");
            if (targetable) {
                targetable.checked = area.targetable;
                targetable.dispatchEvent(
                    new Event(
                        "change",
                        { bubbles: true }));
            }
        });
    }
}

function setLabeledInput(
    scope: HTMLElement,
    label: string,
    value: string
): void {
    const input = inputByLabel(scope, label);
    if (!input) return;
    setInputAndDispatch(input, value);
}

function setCombatInput(
    scope: HTMLElement,
    fieldKey: string,
    fallbackLabel: string,
    value: string
): void {
    const input =
        combatInput(scope, fieldKey, fallbackLabel);
    if (!input) return;
    setInputAndDispatch(input, value);
}

function setInputAndDispatch(
    input: HTMLInputElement,
    value: string
): void {
    input.value = value;
    input.dispatchEvent(
        new Event("input", { bubbles: true }));
    input.dispatchEvent(
        new Event("change", { bubbles: true }));
}

function restoreConditions(
    _root: HTMLElement,
    saved: SavedEncounter,
    _ensureConditionLinks: () => void
): void {
    for (const combatant of allSavedCombatants(saved)) {
        for (const condition of combatant.conditions) {
            addCondition(
                combatant.id,
                {
                    id:
                        condition.id
                        || crypto.randomUUID(),
                    name: condition.name,
                    level: condition.level,
                    note: condition.note,
                    browserLink:
                        condition.browserLink,
                    browserHref:
                        condition.browserHref,
                    origin: condition.origin
                });
        }
    }

    requestEnhancement();
}

function replayRulesCoreLinks(
    saved: SavedEncounter
): void {
    for (const detail of saved.rulesCoreLinks) {
        window.dispatchEvent(
            new CustomEvent(
                "block-initiative:rules-core-template-link",
                { detail }));
    }
}

async function restoreCampaignSelection(
    root: HTMLElement,
    campaignId: string | null
): Promise<void> {
    if (!campaignId) return;

    const select =
        await waitForCampaignOption(
            root,
            campaignId);

    await new Promise<void>(
        (resolve, reject) => {
            const onChange = (event: Event) => {
                const detail =
                    (event as CustomEvent<{
                        campaignId?: string
                    } | null>).detail;

                if (detail?.campaignId === campaignId
                    || root.dataset.campaignId === campaignId) {
                    root.removeEventListener(
                        "block-initiative:campaign-change",
                        onChange);
                    resolve();
                    return;
                }

                if (detail === null
                    && select.value === "") {
                    root.removeEventListener(
                        "block-initiative:campaign-change",
                        onChange);
                    reject(new Error(
                        "The saved campaign could not be restored. "
                        + "Retry campaign access or reset the encounter."));
                }
            };

            root.addEventListener(
                "block-initiative:campaign-change",
                onChange);

            select.value = campaignId;
            select.dispatchEvent(
                new Event(
                    "change",
                    { bubbles: true }));

            if (root.dataset.campaignId === campaignId) {
                root.removeEventListener(
                    "block-initiative:campaign-change",
                    onChange);
                resolve();
            }
        });
}

function campaignCatalogCanNotRestoreSelection(
    state: string | undefined
): boolean {
    return state === "ready"
        || state === "unavailable"
        || state === "error";
}

async function waitForCampaignOption(
    root: HTMLElement,
    campaignId: string
): Promise<HTMLSelectElement> {
    const find = (): HTMLSelectElement | null => {
        const select =
            root.querySelector<HTMLSelectElement>(
                "[data-role='campaign-select']");
        if (!select) return null;

        return Array.from(select.options)
            .some(option =>
                option.value === campaignId)
            ? select
            : null;
    };

    const current = find();
    if (current) return current;

    const currentState =
        root.dataset.campaignCatalogState;
    if (campaignCatalogCanNotRestoreSelection(
        currentState)) {
        throw new Error(
            "The saved campaign is not currently available to this account.");
    }

    return await new Promise<HTMLSelectElement>(
        (resolve, reject) => {
            const onCatalog = () => {
                const select = find();
                if (select) {
                    window.removeEventListener(
                        "block-initiative:campaign-catalog-change",
                        onCatalog);
                    resolve(select);
                    return;
                }

                const state =
                    root.dataset.campaignCatalogState;
                if (campaignCatalogCanNotRestoreSelection(
                    state)) {
                    window.removeEventListener(
                        "block-initiative:campaign-catalog-change",
                        onCatalog);
                    reject(new Error(
                        "The saved campaign is not currently available to this account."));
                }
            };

            window.addEventListener(
                "block-initiative:campaign-catalog-change",
                onCatalog);
        });
}

function restoreRunnerValues(
    root: HTMLElement,
    saved: SavedRunnerCombat,
    lastPreview: PreviewDetail | null
): void {
    const ordered =
        lastPreview?.response.orderedCombatants ?? [];

    for (const combatant of ordered.filter(
        combatant =>
            combatant.allianceId !== "players"
            && combatant.blockType === "standard")) {
        const hp = saved.standard[combatant.id];
        const card = runnerCard(root, combatant.id);
        if (!hp || !card) continue;

        setCombatInput(
            card,
            "max-hp",
            "Max HP",
            hp.maxHp);
        setCombatInput(
            card,
            "current-hp",
            "Current HP",
            hp.currentHp);
    }

    for (const combatant of ordered.filter(
        combatant => combatant.blockType === "kaiju")) {
        const state = saved.kaiju[combatant.id];
        const panel =
            runnerCard(root, combatant.id)
                ?.querySelector<HTMLElement>(
                    "[data-card-state='kaiju']");
        if (!state || !panel) continue;

        const chaos =
            directSection(panel, "Chaos Threshold");
        const finishing =
            directSection(panel, "Finishing Blow");

        if (chaos) {
            setLabeledInput(
                chaos,
                "Maximum",
                state.chaosMax);
            setLabeledInput(
                chaos,
                "Current",
                state.chaosCurrent);
        }

        setLabeledInput(
            panel,
            "Current behaviour / phase",
            state.behaviourPhase);

        if (finishing) {
            setLabeledInput(
                finishing,
                "Target",
                state.finishingTarget);
            setLabeledInput(
                finishing,
                "Damage this turn",
                state.finishingDamageThisTurn);
        }
    }
}

function sameTurnTarget(
    current: InitiativeTurnStateResponse,
    target: InitiativeTurnStateResponse
): boolean {
    if (current.round !== target.round
        || current.cyclicMergeCompleted
            !== target.cyclicMergeCompleted) {
        return false;
    }

    if (current.activeBlockId === null
        || target.activeBlockId === null) {
        return current.activeBlockId
            === target.activeBlockId;
    }

    if (current.activeBlockId === target.activeBlockId) {
        return true;
    }

    const currentBlock =
        current.blocks.find(
            block => block.id === current.activeBlockId);
    const targetBlock =
        target.blocks.find(
            block => block.id === target.activeBlockId);
    if (!currentBlock || !targetBlock) return false;

    const targetMembers = new Set(targetBlock.memberOrder);
    return currentBlock.memberOrder.some(
        id => targetMembers.has(id));
}

function nextTask(): Promise<void> {
    return new Promise(
        resolve => window.setTimeout(resolve, 0));
}

async function waitForPreviewReady(
    root: HTMLElement,
    preview: HTMLButtonElement
): Promise<void> {
    if (!preview.disabled) return;

    if (root.dataset.initiativeServiceConnected === "true") {
        throw new Error(
            "The saved encounter roster is not ready to rebuild.");
    }

    await new Promise<void>(
        (resolve, reject) => {
            const onReadiness = (event: Event) => {
                const detail =
                    (event as CustomEvent<{
                        connected?: boolean;
                        busy?: boolean;
                        ready?: boolean;
                    }>).detail;

                if (detail?.ready
                    || !preview.disabled) {
                    window.removeEventListener(
                        "block-initiative:service-readiness",
                        onReadiness);
                    resolve();
                    return;
                }

                if (detail?.connected
                    && !detail.busy) {
                    window.removeEventListener(
                        "block-initiative:service-readiness",
                        onReadiness);
                    reject(new Error(
                        "The saved encounter roster is not ready to rebuild."));
                }
            };

            window.addEventListener(
                "block-initiative:service-readiness",
                onReadiness);
        });
}
