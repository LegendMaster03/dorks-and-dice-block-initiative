import { readKaijuRuntimeMetadata } from "../combat/kaiju-combat-state";
import { captureActedRounds } from "../combatant-turn-markers";
import {
    captureCombatantReorderRuntime
} from "../initiative/combatant-reorder-state";
import {
    getInitiativeMode
} from "../initiative/initiative-mode";
import {
    checkboxByText,
    combatInput,
    controlKey,
    directCards,
    directSection,
    inputByLabel,
    runnerCard
} from "./encounter-dom";
import type {
    PreviewDetail,
    SavedCombatant,
    SavedCondition,
    SavedControl,
    SavedEncounter,
    SavedEnemyGroup,
    SavedOtherSide,
    SavedRulesCoreLink,
    SavedRunnerCombat,
    SavedView,
    StateDetail
} from "./encounter-schema";

export type EncounterCaptureContext = {
    lastPreview: PreviewDetail | null;
    lastState: StateDetail | null;
    rulesCoreLinks: Iterable<SavedRulesCoreLink>;
};

/**
 * Captures the complete encounter state.
 *
 * Standard and Kaiju combatants are captured with equal completeness; block
 * type is never used as a reason to omit a combatant or its runtime state.
 */
export function captureEncounter(
    root: HTMLElement,
    context: EncounterCaptureContext
): SavedEncounter {
    const players =
        root.querySelector<HTMLElement>("[data-role='players']");
    const enemyGroups =
        root.querySelector<HTMLElement>("[data-role='enemy-groups']");
    const kaijuList =
        root.querySelector<HTMLElement>("[data-role='kaiju-list']");
    const others =
        root.querySelector<HTMLElement>("[data-role='others']");
    const groupMode =
        root.querySelector<HTMLSelectElement>(
            "[data-role='enemy-method']")?.value;

    return {
        version: 2,
        savedAt: new Date().toISOString(),
        view: captureView(root, context.lastState),
        campaignId: root.dataset.campaignId ?? null,
        initiativeMode: getInitiativeMode(),
        groupMode:
            groupMode === "individual" || groupMode === "shared"
                ? groupMode
                : "average",
        players:
            players ? directCards(players).map(captureCombatant) : [],
        enemyGroups:
            enemyGroups
                ? Array.from(
                    enemyGroups.querySelectorAll<HTMLElement>(
                        ":scope > .bi-tactical-group"))
                    .map(captureEnemyGroup)
                : [],
        kaiju:
            kaijuList ? directCards(kaijuList).map(captureCombatant) : [],
        otherSides:
            others
                ? Array.from(
                    others.querySelectorAll<HTMLElement>(
                        ":scope > .bi-other-side"))
                    .map(captureOtherSide)
                : [],
        preview: context.lastPreview,
        state: context.lastState,
        runnerCombat:
            captureRunnerCombat(root, context.lastPreview),
        rulesCoreLinks: Array.from(context.rulesCoreLinks),
        actedRounds: captureActedRounds(),
        reorderRuntime:
            captureCombatantReorderRuntime()
    };
}

function captureView(
    root: HTMLElement,
    lastState: StateDetail | null
): SavedView {
    const setup =
        root.querySelector<HTMLElement>("[data-role='setup']");

    if (lastState
        && setup
        && !setup.hidden
        && setup.querySelector("[data-role='running-edit-note']")) {
        return "editing";
    }

    if (lastState && setup?.hidden) return "running";
    if (root.querySelector("[data-role='results'] .bi-blocks")) {
        return "preview";
    }

    return "setup";
}

function captureEnemyGroup(group: HTMLElement): SavedEnemyGroup {
    const members =
        group.querySelector<HTMLElement>("[data-role='group-members']");

    return {
        groupId: group.dataset.groupId ?? crypto.randomUUID(),
        name:
            group.querySelector<HTMLInputElement>(
                "[data-role='group-name']")?.value
            ?? "Enemy Group",
        sharedRoll:
            group.querySelector<HTMLInputElement>(
                "[data-role='shared-roll']")?.value
            ?? "",
        members:
            members ? directCards(members).map(captureCombatant) : []
    };
}

function captureOtherSide(side: HTMLElement): SavedOtherSide {
    return {
        sideKey: side.dataset.sideKey ?? crypto.randomUUID(),
        name:
            side.querySelector<HTMLInputElement>(
                "[data-role='side-name']")?.value
            ?? "Other side",
        blocks: Array.from(
            side.querySelectorAll<HTMLElement>(
                "[data-role='side-blocks'] > .bi-other-side-block"))
            .map(block => ({
                groupId:
                    block.dataset.groupId ?? crypto.randomUUID(),
                name:
                    block.querySelector<HTMLInputElement>(
                        "[data-role='group-name']")?.value
                    ?? "Block",
                blockType:
                    block.dataset.sideBlockType === "kaiju"
                        ? "kaiju"
                        : "standard",
                members:
                    directCards(
                        block.querySelector<HTMLElement>(
                            "[data-role='group-members']")
                        ?? block)
                    .map(captureCombatant)
            }))
    };
}

function captureCombatant(card: HTMLElement): SavedCombatant {
    const panel =
        card.querySelector<HTMLElement>("[data-combat-setup]");
    const blockType =
        card.querySelector<HTMLSelectElement>(
            "[data-field='block-type']")?.value === "kaiju"
            ? "kaiju"
            : "standard";

    return {
        id: card.dataset.id ?? crypto.randomUUID(),
        name:
            card.querySelector<HTMLInputElement>(
                "[data-field='name']")?.value
            ?? "",
        initiative:
            card.querySelector<HTMLInputElement>(
                "[data-field='initiative']")?.value
            ?? "",
        modifier:
            card.querySelector<HTMLInputElement>(
                "[data-field='modifier']")?.value
            ?? "",
        armorClass:
            captureArmorClass(
                card,
                "setup-armor-class",
                "armor-class"),
        touchArmorClass:
            captureArmorClass(
                card,
                "setup-touch-armor-class",
                "touch-armor-class"),
        flatFootedArmorClass:
            captureArmorClass(
                card,
                "setup-flat-footed-armor-class",
                "flat-footed-armor-class"),
        blockType,
        controllerId:
            card.querySelector<HTMLSelectElement>(
                "[data-field='controller']")?.value
            ?? "",
        rulesReference:
            card.querySelector<HTMLInputElement>(
                "[data-field='rules-reference']")?.value
            ?? "",
        campaignCharacterId:
            card.dataset.campaignCharacterId ?? null,
        campaignId: card.dataset.campaignId ?? null,
        templateId: card.dataset.templateId ?? null,
        instanceNumber: card.dataset.instanceNumber ?? null,
        autoName: card.dataset.autoName ?? null,
        monsterMetaText:
            card.querySelector<HTMLElement>(
                "[data-role='monster-meta']")?.textContent
            ?? "",
        setupAreaCount:
            panel?.querySelectorAll(".bi-area-row").length ?? 0,
        setupControls:
            panel ? captureControls(panel) : [],
        conditions: captureConditions(card)
    };
}

function captureArmorClass(
    card: HTMLElement,
    role: string,
    quickStat: string
): string {
    return card.querySelector<HTMLInputElement>(
        `:scope > .bi-entry-main [data-role='${role}']`
    )?.value
        ?? card.querySelector<HTMLInputElement>(
            `:scope > [data-quick-stats-setup] [data-quick-stat='${quickStat}']`
        )?.value
        ?? "";
}
function captureConditions(card: HTMLElement): SavedCondition[] {
    const editor =
        card.querySelector<HTMLElement>(
            ":scope > .bi-condition-setup [data-condition-editor-for]");
    if (!editor) return [];

    return Array.from(
        editor.querySelectorAll<HTMLElement>(".bi-condition-chip-wrap"))
        .map(wrapper => {
            const menu =
                wrapper.querySelector<HTMLElement>(
                    ".bi-condition-menu");

            return {
                name:
                    menu?.querySelector("strong")
                        ?.textContent?.trim()
                    ?? wrapper.querySelector(".bi-condition-chip")
                        ?.textContent?.trim()
                    ?? "Condition",
                note:
                    menu?.querySelector<HTMLInputElement>("input")
                        ?.value.trim()
                    ?? "",
                href:
                    menu?.querySelector<HTMLAnchorElement>("a[href]")
                        ?.href
                    ?? null
            };
        });
}

function captureControls(scope: HTMLElement): SavedControl[] {
    const controls =
        Array.from(
            scope.querySelectorAll<
                HTMLInputElement | HTMLSelectElement>("input,select"));

    return controls.map(control => ({
        key: controlKey(control, scope),
        value: control.value,
        checked:
            control instanceof HTMLInputElement
            && control.type === "checkbox"
                ? control.checked
                : null
    }));
}

function captureRunnerCombat(
    root: HTMLElement,
    lastPreview: PreviewDetail | null
): SavedRunnerCombat {
    const result: SavedRunnerCombat = {
        standard: {},
        kaiju: {}
    };
    const ordered =
        lastPreview?.response.orderedCombatants ?? [];

    for (const combatant of ordered.filter(
        combatant =>
            combatant.allianceId !== "players"
            && combatant.blockType === "standard")) {
        const card = runnerCard(root, combatant.id);
        if (!card) continue;

        result.standard[combatant.id] = {
            currentHp:
                combatInput(
                    card,
                    "current-hp",
                    "Current HP")?.value
                ?? "",
            maxHp:
                combatInput(
                    card,
                    "max-hp",
                    "Max HP")?.value
                ?? ""
        };
    }

    for (const combatant of ordered.filter(
        combatant => combatant.blockType === "kaiju")) {
        const panel =
            runnerCard(root, combatant.id)
                ?.querySelector<HTMLElement>(
                    "[data-card-state='kaiju']");
        if (!panel) continue;

        const chaosSection =
            directSection(panel, "Chaos Threshold");
        const areaSection =
            directSection(panel, "Vulnerable Areas");
        const finishingSection =
            directSection(panel, "Finishing Blow");

        const runtimeMetadata =
            readKaijuRuntimeMetadata(combatant.id);

        result.kaiju[combatant.id] = {
            chaosCurrent:
                chaosSection
                    ? inputByLabel(
                        chaosSection,
                        "Current")?.value ?? ""
                    : "",
            chaosMax:
                chaosSection
                    ? inputByLabel(
                        chaosSection,
                        "Maximum")?.value ?? ""
                    : "",
            behaviourPhase:
                inputByLabel(
                    panel,
                    "Current behaviour / phase")?.value
                ?? "",
            finishingTarget:
                finishingSection
                    ? inputByLabel(
                        finishingSection,
                        "Target")?.value ?? ""
                    : "",
            finishingDamageThisTurn:
                runtimeMetadata
                    ? String(
                        runtimeMetadata
                            .finishingBlowDamageThisTurn)
                    : finishingSection
                        ? inputByLabel(
                            finishingSection,
                            "Damage this turn")?.value ?? ""
                        : "",
            defeatedRound:
                runtimeMetadata?.defeatedRound ?? null,
            areas:
                areaSection
                    ? Array.from(
                        areaSection.querySelectorAll<HTMLElement>(
                            ".bi-area-row"))
                        .map(row => ({
                            name:
                                row.querySelector("strong")
                                    ?.textContent?.trim()
                                ?? "Vulnerable Area",
                            currentHp:
                                inputByLabel(
                                    row,
                                    "Current HP")?.value
                                ?? "",
                            maxHp:
                                inputByLabel(
                                    row,
                                    "Max HP")?.value
                                ?? "",
                            targetable:
                                checkboxByText(
                                    row,
                                    "Targetable")?.checked
                                ?? false
                        }))
                    : []
        };
    }

    return result;
}
