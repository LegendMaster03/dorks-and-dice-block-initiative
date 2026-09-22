import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

async function source(relativePath) {
    return await readFile(
        path.resolve(testDirectory, relativePath),
        "utf8");
}

test("Kaiju evaluation coalesces stale requests and retries URL resolution", async () => {
    const kaiju = await source("../src/combat/kaiju-combat-state.ts");

    assert.match(kaiju, /evaluationRevisions/);
    assert.match(kaiju, /performLatestKaijuEvaluation/);
    assert.match(
        kaiju,
        /currentState !== state[\s\S]*performLatestKaijuEvaluation/);
    assert.match(kaiju, /resolvingEvaluateUrl = null/);
    assert.match(kaiju, /POSITIVE_TRACKER_LIMITS/);
    assert.match(kaiju, /NON_NEGATIVE_TRACKER_LIMITS/);
    assert.doesNotMatch(kaiju, /Math\.trunc\(/);
});

test("failed turn advance re-renders the existing runner state", async () => {
    const runner =
        await source("../src/application/encounter-runner.ts");
    const advance =
        runner.match(
            /private async advance\(\): Promise<void> \{[\s\S]*?\n    \}\n\n    private undoAdvance/)?.[0]
        ?? "";

    assert.match(
        advance,
        /catch \(error\) \{[\s\S]*this\.render\(\);[\s\S]*showError\(error\)/);
});

test("restore failures release persistence and legacy shared saves migrate", async () => {
    const api = await source("../src/api.ts");
    const coordinator =
        await source("../src/encounter-persistence.ts");
    const restore =
        await source("../src/persistence/encounter-restore.ts");

    assert.match(api, /block-initiative:api-error/);
    assert.match(coordinator, /restoreSession\.handleApiFailure/);
    assert.match(restore, /public handleApiFailure/);
    assert.match(restore, /const maxReplayAdvances = 10_000/);
    assert.match(
        restore,
        /mode === "shared"[\s\S]*\? "average"/);
    assert.match(
        restore,
        /migrateLegacySharedRoll[\s\S]*saved\.sharedRoll/);
});

test("complete runtime persistence includes turn markers and Kaiju metadata", async () => {
    const schema =
        await source("../src/persistence/encounter-schema.ts");
    const capture =
        await source("../src/persistence/encounter-capture.ts");
    const restore =
        await source("../src/persistence/encounter-restore.ts");

    assert.match(schema, /actedRounds/);
    assert.match(schema, /defeatedRound/);
    assert.match(capture, /captureActedRounds/);
    assert.match(capture, /readKaijuRuntimeMetadata/);
    assert.match(restore, /restoreActedRounds/);
    assert.match(restore, /restoreKaijuRuntimeMetadata/);
});

test("removed combatants are pruned from module-owned runtime maps", async () => {
    const combat =
        await source("../src/combat-state-ui.ts");
    const conditions =
        await source("../src/conditions/condition-tracking-ui.ts");
    const quickStats =
        await source("../src/combatant-quick-stats-ui.ts");

    assert.match(combat, /pruneStandardCombatStates/);
    assert.match(combat, /pruneKaijuCombatStates/);
    assert.match(conditions, /pruneConditions/);
    assert.match(quickStats, /pruneActedRounds/);
});

test("saved encounters restore initiative mode and reorder runtime", async () => {
    const schema =
        await source("../src/persistence/encounter-schema.ts");
    const capture =
        await source("../src/persistence/encounter-capture.ts");
    const restore =
        await source("../src/persistence/encounter-restore.ts");

    assert.match(schema, /version: 4/);
    assert.match(schema, /initiativeMode: InitiativeMode/);
    assert.match(schema, /reorderRuntime: CombatantReorderRuntimeSnapshot/);
    assert.match(capture, /getInitiativeMode\(\)/);
    assert.match(capture, /captureCombatantReorderRuntime\(\)/);
    assert.match(restore, /setInitiativeMode\(/);
    assert.match(restore, /restoreCombatantReorderRuntime\(/);
});

test("combatant reorder publishes preview and state only after both requests succeed", async () => {
    const api = await source("../src/api.ts");
    const reorder =
        await source("../src/initiative/combatant-drag-reorder-ui.ts");

    assert.match(api, /export async function requestInitiativePreview/);
    assert.match(api, /export async function requestInitiativeTurnState/);
    assert.match(api, /export function publishInitiativePreview/);
    assert.match(api, /export function publishInitiativeTurnState/);

    const apply = reorder.match(
        /async function applyOrder\([\s\S]*?\n\}/)?.[0] ?? "";
    assert.match(apply, /requestInitiativePreview/);
    assert.match(apply, /requestInitiativeTurnState/);
    assert.match(
        apply,
        /requestInitiativeTurnState[\s\S]*publishInitiativePreview[\s\S]*publishInitiativeTurnState/);
    assert.doesNotMatch(reorder, /endpointsPromise/);
});

test("Rules Core runner links use combatant identity without replacing card metadata", async () => {
    const links =
        await source("../src/rules-core-link-ui.ts");

    assert.match(
        links,
        /\.bi-runner-member\[data-combatant-id\]/);
    assert.match(
        links,
        /card\.dataset\.combatantId/);
    assert.match(
        links,
        /\[data-card-slot='identity'\] > strong/);
    assert.doesNotMatch(
        links,
        /active\.memberOrder\.forEach/);
    assert.match(
        links,
        /existing\.replaceWith\(/);
});

test("monster autocomplete sequences searches independently per card", async () => {
    const monsters =
        await source("../src/roster/monster-roster.ts");

    assert.match(
        monsters,
        /new WeakMap<HTMLElement, number>/);
    assert.match(
        monsters,
        /this\.searchSequences\.get\(card\)/);
    assert.doesNotMatch(
        monsters,
        /private searchSequence = 0/);
});

test("Tool Host and Rules Core transient failures remain retryable", async () => {
    const host = await source("../src/host.ts");
    const app = await source("../src/app.ts");
    const campaign =
        await source("../src/campaign/campaign-ui.ts");
    const quickStats =
        await source("../src/combatant-quick-stats-ui.ts");

    assert.match(host, /contextRequests\.delete\(url\)/);
    assert.match(host, /getJsonWithRetry/);
    assert.match(app, /Retry connection/);
    assert.match(campaign, /Retry campaign access/);
    assert.match(quickStats, /templateRetryAfter/);
    assert.match(
        quickStats,
        /\.catch\(\(\) => \{[\s\S]*templateRetryAfter\.set/);
    assert.doesNotMatch(
        quickStats,
        /catch \{[\s\S]*return null;[\s\S]*\n\}/);
});

test("browser persistence reads normalized v4 saves and migrates older keys", async () => {
    const storage =
        await source("../src/persistence/encounter-storage.ts");
    const migration =
        await source("../src/persistence/encounter-migration.ts");

    assert.match(storage, /encounter:v4/);
    assert.match(storage, /encounter:v3/);
    assert.match(storage, /encounter:v2/);
    assert.match(storage, /encounter:v1/);
    assert.match(storage, /normalizeSavedEncounter/);
    assert.match(migration, /candidate\.version !== 1/);
    assert.match(migration, /version: 4/);
    assert.match(migration, /normalizeRunnerCombat/);
});



test("runner undo and reorder synchronize the authoritative runner session", async () => {
    const runner =
        await source("../src/application/encounter-runner.ts");
    const reorder =
        await source("../src/initiative/combatant-drag-reorder-ui.ts");
    const events =
        await source("../src/application/runner-session-events.ts");

    assert.match(runner, /"previous"\);/);
    assert.match(runner, /onEncounterRunnerSessionReplacement/);
    assert.match(reorder, /replaceEncounterRunnerSession\(\{/);
    assert.match(events, /block-initiative:runner-session-replace/);
});

test("named-load reload and failed restore can not overwrite protected recovery", async () => {
    const coordinator =
        await source("../src/encounter-persistence.ts");

    assert.match(coordinator, /navigationReloading = true/);
    assert.match(coordinator, /autosaveSuspended = true/);
    assert.match(
        coordinator,
        /!navigationReloading[\s\S]*!autosaveSuspended[\s\S]*saveNow\(root\)/);
    assert.match(
        coordinator,
        /Automatic saving is paused to protect the stored snapshot/);
});

test("Kaiju finishing damage is keyed by turn and automatic defeat is latched", async () => {
    const kaiju =
        await source("../src/combat/kaiju-combat-state.ts");
    const coordinator =
        await source("../src/combat-state-ui.ts");

    assert.match(kaiju, /finishingBlowDamageByTurn/);
    assert.match(kaiju, /currentTurnKey/);
    assert.match(kaiju, /state\.defeatedRound !== null[\s\S]*\? true/);
    assert.match(
        kaiju,
        /state\.defeatedOverride === "off"[\s\S]*state\.defeatedRound = null/);
    assert.match(coordinator, /setKaijuCombatTurn\(/);
});

test("conditions preserve level and Rules Core identity through persistence", async () => {
    const model =
        await source("../src/conditions/condition-model.ts");
    const editor =
        await source("../src/conditions/condition-editor.ts");
    const schema =
        await source("../src/persistence/encounter-schema.ts");
    const capture =
        await source("../src/persistence/encounter-capture.ts");
    const restore =
        await source("../src/persistence/encounter-restore.ts");

    assert.match(model, /level: number \| null/);
    assert.match(model, /browserHref: string \| null/);
    assert.match(editor, /Level \(optional\)/);
    assert.match(schema, /browserLink: RuleBrowserLink \| null/);
    assert.match(capture, /conditionsFor\(combatantId\)/);
    assert.match(restore, /addCondition\(/);
});

test("campaign persistence only accepts confirmed campaign selection", async () => {
    const campaign =
        await source("../src/campaign/campaign-ui.ts");
    const restore =
        await source("../src/persistence/encounter-restore.ts");

    assert.match(campaign, /select\.value = ""/);
    assert.doesNotMatch(
        restore,
        /root\.dataset\.campaignId = campaignId/);
    assert.match(
        restore,
        /root\.dataset\.campaignId[\s\S]*=== campaignId/);
});

test("health maximum fields reject negative values while current HP may remain negative", async () => {
    const standard =
        await source("../src/combat/standard-combat-state.ts");
    const kaiju =
        await source("../src/combat/kaiju-combat-state.ts");

    assert.match(standard, /NON_NEGATIVE_TRACKER_LIMITS/);
    assert.match(standard, /TRACKER_LIMITS\.min/);
    assert.match(standard, /At or below 0 HP/);
    assert.match(kaiju, /"Chaos Threshold"[\s\S]*NON_NEGATIVE_TRACKER_LIMITS/);
    assert.match(kaiju, /"Max HP"[\s\S]*NON_NEGATIVE_TRACKER_LIMITS/);
});


test("Previous turn does not reset drag-reorder history", async () => {
    const runner =
        await source("../src/application/encounter-runner.ts");
    const reorder =
        await source("../src/initiative/combatant-drag-reorder-ui.ts");

    assert.match(runner, /"previous"\);/);
    assert.match(reorder, /publicationSource === "start"/);
    assert.match(reorder, /publicationSource === "resume"/);
    assert.doesNotMatch(
        reorder,
        /detail\.request\.advanceCount === 0\)[\s\S]*resetCombatantReorderRuntime/);
});

test("Kaiju persistence reads authoritative module state instead of waiting for DOM repaint", async () => {
    const capture =
        await source("../src/persistence/encounter-capture.ts");
    const kaiju =
        await source("../src/combat/kaiju-combat-state.ts");

    assert.match(capture, /runtime\.chaosCurrent/);
    assert.match(capture, /runtime\.areas\.map/);
    assert.match(kaiju, /chaosCurrent: state\.chaosCurrent/);
    assert.match(kaiju, /areas: state\.areas\.map/);
});

test("all fallback resource adjustments honor tracker bounds", async () => {
    const standard =
        await source("../src/combat/standard-combat-state.ts");
    const kaiju =
        await source("../src/combat/kaiju-combat-state.ts");

    assert.match(
        standard,
        /Math\.min\([\s\S]*TRACKER_LIMITS\.max[\s\S]*amount\.value/);
    assert.match(
        kaiju,
        /state\.chaosCurrent = Math\.max\([\s\S]*TRACKER_LIMITS\.min/);
    assert.match(
        kaiju,
        /const next = Math\.min\([\s\S]*TRACKER_LIMITS\.max/);
});

test("condition preview signatures include structured levels", async () => {
    const conditions =
        await source("../src/conditions/condition-tracking-ui.ts");

    assert.match(
        conditions,
        /condition\.name,[\s\S]*condition\.level,[\s\S]*condition\.note/);
});

test("restore waits on readiness events instead of fixed short timeouts", async () => {
    const app = await source("../src/app.ts");
    const campaign =
        await source("../src/campaign/campaign-ui.ts");
    const restore =
        await source("../src/persistence/encounter-restore.ts");

    assert.match(app, /block-initiative:service-readiness/);
    assert.match(campaign, /block-initiative:campaign-catalog-change/);
    assert.match(restore, /waitForPreviewReady/);
    assert.match(restore, /await restoreCampaignSelection/);
    assert.match(restore, /block-initiative:service-readiness/);
    assert.match(restore, /block-initiative:campaign-catalog-change/);
    assert.doesNotMatch(restore, /1200|2500|5000/);
});

test("legacy persistence is retired after successful promotion", async () => {
    const storage =
        await source("../src/persistence/encounter-storage.ts");

    assert.match(storage, /encounter:v4/);
    assert.match(storage, /currentRaw !== null/);
    assert.match(
        storage,
        /writeAutomaticEncounter\(legacy\)[\s\S]*removeItem\(key\)/);
    assert.match(
        storage,
        /writeNamedEncounters\(legacy\)[\s\S]*removeItem\(key\)/);
});

test("manual duplicate families persist and new copies start at full HP", async () => {
    const schema =
        await source("../src/persistence/encounter-schema.ts");
    const capture =
        await source("../src/persistence/encounter-capture.ts");
    const restore =
        await source("../src/persistence/encounter-restore.ts");
    const duplicate =
        await source("../src/roster/enemy-duplicate-ui.ts");

    assert.match(schema, /manualDuplicateKey/);
    assert.match(capture, /card\.dataset\.manualDuplicateKey/);
    assert.match(restore, /"manualDuplicateKey"/);
    assert.match(
        duplicate,
        /targetCurrent,[\s\S]*sourceMax\.value \|\| sourceCurrent\.value/);
});

test("reorder failures have a visible error surface", async () => {
    const reorder =
        await source("../src/initiative/combatant-drag-reorder-ui.ts");

    assert.match(reorder, /data-role='reorder-status'|dataset\.role = "reorder-status"/);
    assert.match(reorder, /reportReorderError/);
    assert.match(reorder, /bi-message bi-error/);
});


test("campaign restore terminates when catalog loading fails and ignores stale retries", async () => {
    const campaign =
        await source("../src/campaign/campaign-ui.ts");
    const restore =
        await source("../src/persistence/encounter-restore.ts");

    assert.match(
        restore,
        /campaignCatalogCanNotRestoreSelection[\s\S]*state === "error"/);
    assert.match(
        restore,
        /campaignCatalogCanNotRestoreSelection\(\s*currentState\)/);
    assert.match(
        restore,
        /campaignCatalogCanNotRestoreSelection\(\s*state\)/);
    assert.match(campaign, /campaignCatalogRequestSequence/);
    assert.match(
        campaign,
        /requestSequence[\s\S]*!== campaignCatalogRequestSequence[\s\S]*return/);
});

test("combatant reorder locks runner navigation until its async replacement finishes", async () => {
    const events =
        await source("../src/application/runner-session-events.ts");
    const runner =
        await source("../src/application/encounter-runner.ts");
    const reorder =
        await source("../src/initiative/combatant-drag-reorder-ui.ts");

    assert.match(events, /setEncounterRunnerMutationLock/);
    assert.match(events, /onEncounterRunnerMutationLock/);
    assert.match(runner, /onEncounterRunnerMutationLock/);
    assert.match(runner, /mutationLocks = new Set<string>/);
    assert.match(runner, /blocked \|\| this\.history\.length === 0/);
    assert.match(runner, /if \(next\) next\.disabled = blocked/);
    assert.match(runner, /if \(edit\) edit\.disabled = blocked/);
    assert.match(
        reorder,
        /setEncounterRunnerMutationLock\([\s\S]*"combatant-reorder",[\s\S]*true/);
    assert.match(
        reorder,
        /finally \{[\s\S]*setEncounterRunnerMutationLock\([\s\S]*"combatant-reorder",[\s\S]*false/);
});


test("invalid condition levels do not erase valid state or get stored as no level", async () => {
    const editor =
        await source("../src/conditions/condition-editor.ts");

    assert.match(
        editor,
        /if \(parsed === undefined\) return;[\s\S]*updateConditionLevel/);
    assert.match(
        editor,
        /if \(parsedLevel === undefined\) \{[\s\S]*level\.reportValidity\(\);[\s\S]*return;/);
    assert.match(
        editor,
        /if \(!input\.value\.trim\(\)\) return null;[\s\S]*\?\? undefined/);
});
