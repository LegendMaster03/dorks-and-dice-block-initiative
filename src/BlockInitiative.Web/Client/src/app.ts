import {
    publishInitiativePreview,
    requestInitiativePreview
} from "./api";
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

const appRoot: HTMLElement = root;
const shell = mountApplicationShell(appRoot);

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
let connectingHost = false;
let rosterRevision = 0;
let previewRequestSequence = 0;

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
    void connectHostedContext();
}

async function connectHostedContext(): Promise<void> {
    if (!contextUrl || connectingHost) return;

    connectingHost = true;
    previewUrl = null;
    stateUrl = null;
    hostStatus.textContent =
        "Connecting to Dorks & Dice…";
    updateReady();

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
        clearMessage();
    } catch (error) {
        showError(error);
        renderHostRetry();
    } finally {
        connectingHost = false;
        updateReady();
    }
}

function renderHostRetry(): void {
    hostStatus.replaceChildren();

    const text = document.createElement("span");
    text.textContent =
        "Dorks & Dice connection is unavailable. ";

    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn btn-sm btn-outline-secondary";
    retry.textContent = "Retry connection";
    retry.onclick = () => void connectHostedContext();

    hostStatus.append(text, retry);
}

function handleRosterChanged(): void {
    rosterRevision += 1;
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
    const connected =
        Boolean(previewUrl);

    roster.updateReady({
        connected,
        busy,
        editing: runner.isEditing
    });

    appRoot.dataset.initiativeServiceConnected =
        String(connected);
    appRoot.dataset.initiativeRosterReady =
        String(!previewButton.disabled);

    window.dispatchEvent(
        new CustomEvent(
            "block-initiative:service-readiness",
            {
                detail: {
                    connected,
                    busy,
                    ready:
                        !previewButton.disabled
                }
            }));
}

async function buildPreview(
    manualOrderOverride: string[] | null = null
): Promise<void> {
    if (!previewUrl || busy) return;

    const requestSequence =
        ++previewRequestSequence;
    const requestRosterRevision =
        rosterRevision;

    busy = true;
    updateReady();

    try {
        const request: InitiativePreviewRequest = {
            combatants: roster.collect(),
            manualOrderOverride,
            tacticalGroupMode:
                roster.currentGroupMode()
        };

        const previewResult =
            await requestInitiativePreview(
                previewUrl,
                request);

        if (requestSequence !== previewRequestSequence
            || requestRosterRevision !== rosterRevision) {
            return;
        }

        publishInitiativePreview(previewResult);
        const preview = previewResult.response;
        const effectiveRequest = previewResult.request;

        renderInitiativePreview({
            results,
            preview,
            request: effectiveRequest,
            editingRunningEncounter:
                runner.isEditing,
            groupName:
                groupId => roster.groupName(groupId),
            onApplyManualOrder:
                order => void buildPreview(order),
            onStart:
                () => void runner.start(
                    effectiveRequest,
                    preview),
            onResume:
                () => void runner.resume(
                    effectiveRequest,
                    preview)
        });

        results.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    } catch (error) {
        if (requestSequence === previewRequestSequence
            && requestRosterRevision === rosterRevision) {
            showError(error);
        }
    } finally {
        if (requestSequence === previewRequestSequence) {
            busy = false;
            updateReady();
        }
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
