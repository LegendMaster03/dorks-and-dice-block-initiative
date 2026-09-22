import type {
    InitiativePreviewRequest,
    InitiativePreviewResponse,
    InitiativeTurnStateResponse
} from "../api";

export type RunnerSessionReplacement = {
    request: InitiativePreviewRequest;
    preview: InitiativePreviewResponse;
    state: InitiativeTurnStateResponse;
};

const eventName =
    "block-initiative:runner-session-replace";

export function replaceEncounterRunnerSession(
    detail: RunnerSessionReplacement
): void {
    window.dispatchEvent(
        new CustomEvent<RunnerSessionReplacement>(
            eventName,
            { detail }));
}

export function onEncounterRunnerSessionReplacement(
    handler: (
        detail: RunnerSessionReplacement
    ) => void
): () => void {
    const listener = (event: Event) => {
        const detail =
            (event as CustomEvent<
                RunnerSessionReplacement
            >).detail;
        if (detail) handler(detail);
    };

    window.addEventListener(
        eventName,
        listener);

    return () =>
        window.removeEventListener(
            eventName,
            listener);
}


export type RunnerMutationLock = {
    source: string;
    locked: boolean;
};

const mutationEventName =
    "block-initiative:runner-mutation-lock";

export function setEncounterRunnerMutationLock(
    source: string,
    locked: boolean
): void {
    if (!source.trim()) return;

    window.dispatchEvent(
        new CustomEvent<RunnerMutationLock>(
            mutationEventName,
            {
                detail: {
                    source,
                    locked
                }
            }));
}

export function onEncounterRunnerMutationLock(
    handler: (
        detail: RunnerMutationLock
    ) => void
): () => void {
    const listener = (event: Event) => {
        const detail =
            (event as CustomEvent<
                RunnerMutationLock
            >).detail;
        if (detail?.source) handler(detail);
    };

    window.addEventListener(
        mutationEventName,
        listener);

    return () =>
        window.removeEventListener(
            mutationEventName,
            listener);
}
