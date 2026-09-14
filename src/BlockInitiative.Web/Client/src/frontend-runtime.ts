import { initializeCombatStateUi } from "./combat-state-ui";
import { initializeCombatStatsCollapseUi } from "./combat-stats-collapse-ui";
import { initializeCombatantDragReorderUi } from "./combatant-drag-reorder-ui";
import { initializeCombatantFieldUi } from "./combatant-field-ui";
import { initializeCombatantQuickStatsUi } from "./combatant-quick-stats-ui";
import { initializeConditionLayoutUi } from "./condition-layout-ui";
import { initializeConditionTrackingUi } from "./condition-tracking-ui";
import { initializeEncounterCardAffordancesUi } from "./encounter-card-affordances-ui";
import { initializeEncounterCardLayoutUi } from "./encounter-card-layout-ui";
import { initializeEncounterRunnerPolishUi } from "./encounter-runner-polish-ui";
import { initializeEnemyDuplicateUi } from "./enemy-duplicate-ui";
import { initializeHealthControlUi } from "./health-control-ui";
import { initializeInitiativeRollUi } from "./initiative-roll-ui";
import { initializeIntegratedRunnerCleanupUi } from "./integrated-runner-cleanup";
import { initializeKaijuLayoutUi } from "./kaiju-layout-ui";
import { initializeOtherSideUi } from "./other-side-ui";
import { initializePlayerDisplayOverrides } from "./player-display-overrides";
import { initializeRulesCoreLinkUi } from "./rules-core-link-ui";
import { initializeSetupLayoutUi } from "./setup-layout-ui";
import { initializeTrackerLayoutUi } from "./tracker-layout-ui";
import { requestEnhancement } from "./render-lifecycle";

let initialized = false;

export function initializeFrontendRuntime(): void {
    if (initialized) return;
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement)) return;
    initialized = true;

    // Registration order is encoded by each module's after-render priority.
    // Initialization only installs stable event handlers/styles and registers
    // hooks; application-owned DOM changes are handled by requested passes.
    initializeSetupLayoutUi();
    initializeOtherSideUi();
    initializeCombatantFieldUi();
    initializeCombatStateUi();
    initializeInitiativeRollUi();
    initializeHealthControlUi();
    initializeKaijuLayoutUi();
    initializeEnemyDuplicateUi();
    initializeTrackerLayoutUi();
    initializeConditionTrackingUi();
    initializeConditionLayoutUi();
    initializeRulesCoreLinkUi();
    initializeCombatantQuickStatsUi();
    initializeCombatStatsCollapseUi();
    initializeEncounterCardLayoutUi();
    initializeCombatantDragReorderUi();
    initializeIntegratedRunnerCleanupUi();
    initializeEncounterCardAffordancesUi();
    initializeEncounterRunnerPolishUi();
    initializePlayerDisplayOverrides();

    // App-level form events are authoritative render/enhancement boundaries.
    // Enhancement-owned popovers manage their own transient input state and
    // must not trigger a full pass on each keystroke or click.
    root.addEventListener("input", requestEnhancementForAppEvent);
    root.addEventListener("change", requestEnhancementForAppEvent);
    root.addEventListener("click", requestEnhancementForAppEvent);

    requestEnhancement();
}

function requestEnhancementForAppEvent(event: Event): void {
    const target = event.target;
    const element = target instanceof Element
        ? target
        : target instanceof Node
            ? target.parentElement
            : null;

    if (element?.closest(".bi-condition-picker, .bi-condition-menu")) return;
    requestEnhancement();
}
