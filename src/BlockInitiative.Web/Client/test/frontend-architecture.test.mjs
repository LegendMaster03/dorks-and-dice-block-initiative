import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { chooseHealthEditor } from "../.test-dist/encounter-card-model.js";

test("card-owned HP editor survives later enhancement passes without pre-rebuild rescue", async () => {
    const firstEditor = { id: "first-hp-editor" };
    const replacementEditor = { id: "replacement-hp-editor" };

    assert.equal(chooseHealthEditor(firstEditor, null), firstEditor, "first pass should take the editor from the health row");
    assert.equal(chooseHealthEditor(null, firstEditor), firstEditor, "later passes should preserve the card-owned editor");
    assert.equal(chooseHealthEditor(replacementEditor, firstEditor), replacementEditor, "a newly rendered health editor should replace stale ownership");

    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const polishSource = await readFile(path.resolve(testDirectory, "../src/encounter-runner-polish-ui.ts"), "utf8");
    const quickStatsSource = await readFile(path.resolve(testDirectory, "../src/combatant-quick-stats-ui.ts"), "utf8");
    assert.doesNotMatch(polishSource, /preserve-runner-health-controls|function preserveHealthControls/);
    assert.match(quickStatsSource, /const reusableCards = collectEncounterCards\(stack\)/);
    assert.match(quickStatsSource, /renderEncounterCard\(reusableCards\.get\(combatantId\)/);
});


test("combat state mounts directly into renderer-owned card state", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const standardState = await readFile(
        path.resolve(testDirectory, "../src/combat/standard-combat-state.ts"),
        "utf8");
    const kaijuState = await readFile(
        path.resolve(testDirectory, "../src/combat/kaiju-combat-state.ts"),
        "utf8");
    const quickStats = await readFile(
        path.resolve(testDirectory, "../src/combatant-quick-stats-ui.ts"),
        "utf8");

    assert.match(standardState, /mountEncounterCardState\(card, "health", healthRow\)/);
    assert.match(kaijuState, /mountEncounterCardState\(card, "kaiju", panel\)/);
    assert.doesNotMatch(standardState, /data-combat-dashboard/);
    assert.doesNotMatch(kaijuState, /data-combat-dashboard/);
    assert.doesNotMatch(quickStats, /function integrateCombatState|integrateCombatState\(/);
});

test("setup initiative modifier is restored to the primary Mod column after combat-stats enhancement", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.resolve(testDirectory, "../src/combatant-field-ui.ts"), "utf8");

    assert.match(source, /registerAfterRender\("combatant-fields",\s*20/);
    assert.match(source, /registerAfterRender\("combatant-field-placement",\s*130/);
    assert.match(source, /const details = blockTypeInput\?\.closest\("details"\)/);
    assert.match(source, /modifierField\.parentElement !== main/);
    assert.match(source, /initiativeWrap\.before\(modifierField\)/);
    assert.doesNotMatch(source, /primaryFieldsReady === "true"\) continue/);
});

test("setup AC is shown between initiative and HP without moving the combat-stats source field", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.resolve(testDirectory, "../src/encounter-setup-polish-ui.ts"), "utf8");

    assert.match(source, /registerAfterRender\("encounter-setup-polish",\s*135/);
    assert.match(source, /data-quick-stat='armor-class'/);
    assert.match(source, /sourceWrap\.hidden = true/);
    assert.match(source, /initiativeWrap\.after\(field\)/);
    assert.match(source, /setup-ac-header/);
    assert.match(source, /grid-template-columns:minmax\(16rem,34rem\) 5rem 13rem 4\.5rem 6rem auto/);
    assert.match(source, /\[data-combat-setup='standard'\]\{grid-column:5;grid-row:1\}/);
});

test("encounter AC metric is visually larger than the generic secondary metric", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.resolve(testDirectory, "../src/encounter-card-layout-ui.ts"), "utf8");

    assert.match(source, /bi-card-secondary-stat>strong\{font-size:1\.05rem/);
    assert.match(source, /bi-card-secondary-stat\[data-stat='ac'\]>strong\{font-size:1\.45rem\}/);
});

test("one setup action builds blocks and continues into start or resume", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.resolve(testDirectory, "../src/encounter-setup-polish-ui.ts"), "utf8");

    assert.match(source, /\[data-action='preview'\]/);
    assert.match(source, /block-initiative:preview/);
    assert.match(source, /requiresAdjudication/);
    assert.match(source, /registerAfterRender\("encounter-start-flow",\s*170/);
    assert.match(source, /\^\(Start encounter\|Resume encounter\)\$/);
    assert.match(source, /action\.click\(\)/);
    assert.match(source, /button\.textContent = "Start encounter"/);
    assert.match(source, /button\.textContent = "Apply changes & resume"/);
});

test("encounter initiative header shows the rolled total without repeating the modifier", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const affordancesSource = await readFile(path.resolve(testDirectory, "../src/encounter-card-affordances-ui.ts"), "utf8");
    const quickStatsSource = await readFile(path.resolve(testDirectory, "../src/combatant-quick-stats-ui.ts"), "utf8");

    assert.match(affordancesSource, /bi-card-initiative-total/);
    assert.doesNotMatch(affordancesSource, /bi-card-initiative-modifier/);
    assert.match(affordancesSource, /suppressDuplicateInitiativeFact\(card\)/);
    assert.match(quickStatsSource, /appendFact\(facts,\s*"Init",\s*initiative/);
});

test("encounter runner exposes reversible advancement through stable action identifiers", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const runnerSource = await readFile(
        path.resolve(testDirectory, "../src/application/encounter-runner.ts"),
        "utf8");
    const persistenceSource = await readFile(
        path.resolve(testDirectory, "../src/encounter-persistence.ts"),
        "utf8");

    assert.match(runnerSource, /this\.history\.push\(this\.session\.state\)/);
    assert.match(runnerSource, /private undoAdvance\(\)/);
    assert.match(runnerSource, /dataset\.action = "previous-turn"/);
    assert.match(runnerSource, /dataset\.action = "next-turn"/);
    assert.match(persistenceSource, /EncounterRestoreSession/);
});

test("enemy duplication does not reschedule enhancement for every input or change event", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.resolve(testDirectory, "../src/enemy-duplicate-ui.ts"), "utf8");

    assert.doesNotMatch(source, /root\.addEventListener\(\s*["']input["']/);
    assert.doesNotMatch(source, /root\.addEventListener\(\s*["']change["']/);
});

test("application frontend does not use MutationObserver as a render lifecycle", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const sourceDirectory = path.resolve(testDirectory, "../src");
    const names = await readdir(sourceDirectory);
    const offenders = [];

    for (const name of names.filter(name => name.endsWith(".ts"))) {
        const content = await readFile(path.join(sourceDirectory, name), "utf8");
        if (content.includes("MutationObserver")) offenders.push(name);
    }

    assert.deepEqual(offenders, []);
});


test("combat state and persistence address runner state by combatant identity", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const coordinator = await readFile(
        path.resolve(testDirectory, "../src/combat-state-ui.ts"),
        "utf8");
    const capture = await readFile(
        path.resolve(testDirectory, "../src/persistence/encounter-capture.ts"),
        "utf8");
    const restore = await readFile(
        path.resolve(testDirectory, "../src/persistence/encounter-restore.ts"),
        "utf8");

    assert.match(coordinator, /findRunnerCard\(root, combatant\.id\)/);
    assert.match(capture, /runnerCard\(root, combatant\.id\)/);
    assert.match(restore, /runnerCard\(root, combatant\.id\)/);
    assert.doesNotMatch(capture, /data-combat-dashboard/);
    assert.doesNotMatch(restore, /data-combat-dashboard/);
});

test("encounter card modules delegate direct-child ordering to the card renderer", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const quickStats = await readFile(path.resolve(testDirectory, "../src/combatant-quick-stats-ui.ts"), "utf8");
    const affordances = await readFile(path.resolve(testDirectory, "../src/encounter-card-affordances-ui.ts"), "utf8");
    const polish = await readFile(path.resolve(testDirectory, "../src/encounter-runner-polish-ui.ts"), "utf8");
    const renderer = await readFile(path.resolve(testDirectory, "../src/encounter-card-renderer.ts"), "utf8");

    assert.match(quickStats, /renderEncounterCard\(reusableCards\.get\(combatantId\)/);
    assert.match(quickStats, /mountEncounterCardSlot\(row, "quick-stats", panel\)/);
    assert.match(affordances, /mountEncounterCardSlot\(card, "initiative", display\)/);
    assert.match(affordances, /mountEncounterCardSlot\(card, "context", wrapper\)/);
    assert.match(renderer, /mountEncounterCardSlot\(card, "metrics", layout\.metricLine\)/);
    assert.match(polish, /renderEncounterCardMetrics\(card, \{ speed, armorClass \}\)/);
    assert.doesNotMatch(polish, /mountEncounterCardSlot\(|function normalizeHeaderOrder/);
});


test("runner conditions are composed directly into card context without dashboard relays", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const tracking = await readFile(path.resolve(testDirectory, "../src/condition-tracking-ui.ts"), "utf8");
    const affordances = await readFile(path.resolve(testDirectory, "../src/encounter-card-affordances-ui.ts"), "utf8");
    const quickStats = await readFile(path.resolve(testDirectory, "../src/combatant-quick-stats-ui.ts"), "utf8");
    const runtime = await readFile(path.resolve(testDirectory, "../src/frontend-runtime.ts"), "utf8");

    assert.match(tracking, /export function ensureRunnerConditionEditor/);
    assert.match(affordances, /ensureRunnerConditionEditor\(root, combatantId\)/);
    assert.doesNotMatch(quickStats, /function integrateConditions|integrateConditions\(root, runner\)/);
    assert.doesNotMatch(runtime, /initializeConditionLayoutUi/);
});


test("runner card structure does not rebuild for round or active-turn changes alone", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.resolve(testDirectory, "../src/combatant-quick-stats-ui.ts"), "utf8");

    const signatureBlock = source.match(/const signature = JSON\.stringify\(\{[\s\S]*?\}\);/)?.[0] ?? "";
    assert.match(signatureBlock, /blocks:/);
    assert.match(signatureBlock, /combatants:/);
    assert.match(signatureBlock, /groupName\(root, combatant\.tacticalGroupId\)/);
    assert.doesNotMatch(signatureBlock, /round:/);
    assert.doesNotMatch(signatureBlock, /activeBlockId:/);
});



test("retired runner dashboard relays are absent from active frontend modules", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const tracking = await readFile(
        path.resolve(testDirectory, "../src/condition-tracking-ui.ts"),
        "utf8");
    const coordinator = await readFile(
        path.resolve(testDirectory, "../src/combat-state-ui.ts"),
        "utf8");
    const standardState = await readFile(
        path.resolve(testDirectory, "../src/combat/standard-combat-state.ts"),
        "utf8");
    const kaijuState = await readFile(
        path.resolve(testDirectory, "../src/combat/kaiju-combat-state.ts"),
        "utf8");

    assert.doesNotMatch(tracking, /ensureConditionDashboard|bi-condition-dashboard/);
    assert.doesNotMatch(tracking, /function enhanceRunner/);
    for (const source of [coordinator, standardState, kaijuState]) {
        assert.doesNotMatch(source, /bi-combat-dashboard|bi-health-list/);
    }
});


test("Kaiju state refresh is deferred and scoped to the affected combatant", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(
        path.resolve(testDirectory, "../src/combat/kaiju-combat-state.ts"),
        "utf8");

    assert.match(source, /function requestKaijuCardRefresh/);
    assert.match(source, /queueMicrotask\(\(\) => \{/);
    assert.match(source, /findRunnerCard\(root, combatantId\)/);
    assert.match(source, /requestKaijuCardRefresh\(root, id\)/);
    assert.match(source, /canEvaluateKaiju\(state\)/);

    assert.doesNotMatch(
        source,
        /querySelectorAll<HTMLElement>\("\[data-card-state='kaiju'\]"\)/);
});

test("condition tracking does not retain obsolete runner turn-state bookkeeping", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.resolve(testDirectory, "../src/condition-tracking-ui.ts"), "utf8");

    assert.doesNotMatch(source, /TurnStateDetail|lastTurnState/);
    assert.doesNotMatch(source, /block-initiative:state/);
    assert.match(source, /runnerConditionEditors/);
});


test("combat runner synchronization delegates to Standard and Kaiju modules", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const coordinator = await readFile(
        path.resolve(testDirectory, "../src/combat-state-ui.ts"),
        "utf8");
    const standardState = await readFile(
        path.resolve(testDirectory, "../src/combat/standard-combat-state.ts"),
        "utf8");
    const kaijuState = await readFile(
        path.resolve(testDirectory, "../src/combat/kaiju-combat-state.ts"),
        "utf8");

    assert.match(coordinator, /function syncRunnerCombatState/);
    assert.match(coordinator, /syncStandardCombatState\(card, combatant, isActive\)/);
    assert.match(coordinator, /syncKaijuCombatState\(root, card, combatant, isActive\)/);
    assert.match(standardState, /export function syncStandardCombatState/);
    assert.match(kaijuState, /export function syncKaijuCombatState/);
    assert.doesNotMatch(coordinator, /function renderHealthRow|function renderKaiju/);
});


test("application orchestrator delegates preview and runner lifecycles to modules", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const app = await readFile(
        path.resolve(testDirectory, "../src/app.ts"),
        "utf8");
    const preview = await readFile(
        path.resolve(testDirectory, "../src/application/initiative-preview.ts"),
        "utf8");
    const runner = await readFile(
        path.resolve(testDirectory, "../src/application/encounter-runner.ts"),
        "utf8");

    assert.match(app, /renderInitiativePreview\(/);
    assert.match(app, /new EncounterRunnerController\(/);
    assert.doesNotMatch(app, /function renderPreview\(/);
    assert.doesNotMatch(app, /function renderRunnerState\(/);
    assert.match(preview, /export function renderInitiativePreview/);
    assert.match(runner, /export class EncounterRunnerController/);
});
