import { previewInitiative } from "./api";
import { mountApplicationShell } from "./application/app-shell";
import { EncounterRunnerController } from "./application/encounter-runner";
import { renderInitiativePreview } from "./application/initiative-preview";
import type { InitiativePreviewRequest } from "./api";
import {
    initiativePreviewUrl,
    initiativeStateUrl,
    loadToolHostContext
} from "./host";
import type { ToolHostContext } from "./host";
import { RosterController } from "./roster/roster-controller";

const root = document.getElementById("tool-root");
if (!(root instanceof HTMLElement)) {
    throw new Error(
        "Block Initiative could not find the Dorks & Dice tool root.");
}

const shell = mountApplicationShell(root);

const setup = query<HTMLElement>("[data-role='setup']");
const hostStatus =
    query<HTMLElement>("[data-role='host-status']");
const message =
    query<HTMLElement>("[data-role='message']");
const results =
    query<HTMLElement>("[data-role='results']");
const previewButton =
    query<HTMLButtonElement>("[data-action='preview']");

let previewUrl: string | null = null;
let stateUrl: string | null = null;
let busy = false;

let roster!: RosterController;

const runner = new EncounterRunnerController({
    results,
    setup,
    previewButton,
    getStateUrl: () => stateUrl,
    groupName: groupId =>
        roster.groupName(groupId),
    showError,
    onEditingChanged: handleRosterChanged
});

roster = new RosterController({
    shell,
    onChanged: handleRosterChanged,
    showError
});
roster.initialize();

previewButton.onclick =
    () => void buildPreview();

updateReady();

const contextUrl = root.dataset.toolContextUrl;
if (!contextUrl) {
    previewUrl = initiativePreviewUrl(null);
    stateUrl = initiativeStateUrl(null);
    hostStatus.textContent =
        "Standalone development mode. "
        + "Rules Core autocomplete is available only when hosted "
        + "by Dorks & Dice.";
    updateReady();
} else {
    roster.setRulesCoreSearchEnabled(true);
    hostStatus.textContent =
        "Connecting to Dorks & Dice…";

    try {
        const context: ToolHostContext =
            await loadToolHostContext(contextUrl);
        previewUrl = initiativePreviewUrl(context);
        stateUrl = initiativeStateUrl(context);
        hostStatus.textContent = context.user
            ? `Signed in as ${context.user.displayName || context.user.id}. Rules Core monster search uses your source access.`
            : "Manual encounters do not require sign-in. "
                + "Rules Core search shows content available "
                + "to anonymous access.";
        updateReady();
    } catch (error) {
        showError(error);
    }
}

function handleRosterChanged(): void {
    results.replaceChildren();
    setup.hidden = false;
    clearMessage();

    previewButton.textContent =
        runner.isEditing
            ? "Review encounter changes"
            : "Build initiative blocks";

    updateReady();
}

function updateReady(): void {
    roster.updateReady({
        connected: Boolean(previewUrl),
        busy,
        editing: runner.isEditing
    });
}

async function buildPreview(
    manualOrderOverride: string[] | null = null
): Promise<void> {
    if (!previewUrl) return;

    busy = true;
    updateReady();

    try {
        const request: InitiativePreviewRequest = {
            combatants: roster.collect(),
            manualOrderOverride,
            tacticalGroupMode:
                roster.currentGroupMode()
        };

        const preview =
            await previewInitiative(
                previewUrl,
                request);

        renderInitiativePreview({
            results,
            preview,
            request,
            editingRunningEncounter:
                runner.isEditing,
            groupName:
                groupId => roster.groupName(groupId),
            onApplyManualOrder:
                order => void buildPreview(order),
            onStart:
                () => void runner.start(
                    request,
                    preview),
            onResume:
                () => void runner.resume(
                    request,
                    preview)
        });

        results.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    } catch (error) {
        showError(error);
    } finally {
        busy = false;
        updateReady();
    }
}

function query<T extends Element>(
    selector: string,
    scope: ParentNode = shell
): T {
    const element =
        scope.querySelector(selector);
    if (!(element instanceof Element)) {
        throw new Error(
            `Missing ${selector}`);
    }
    return element as T;
}

function clearMessage(): void {
    message.hidden = true;
    message.className = "";
    message.textContent = "";
}

function showError(error: unknown): void {
    message.hidden = false;
    message.className = "bi-message bi-error";
    message.textContent =
        error instanceof Error
            ? error.message
            : "Something went wrong.";
}
