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
