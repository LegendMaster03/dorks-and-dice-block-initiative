export function initializePlayerDisplayOverrides(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement)) return;
    const documentRef = root.ownerDocument;
    if (documentRef.head.querySelector("style[data-role='player-display-overrides']")) return;

    const style = documentRef.createElement("style");
    style.dataset.role = "player-display-overrides";
    style.textContent = `
.block-initiative-app.bi-stats-hidden [data-combat-dashboard]{display:grid!important}
.block-initiative-app.bi-stats-hidden .bi-health-row .bi-statuses,
.block-initiative-app.bi-stats-hidden .bi-health-row .bi-hp-editor,
.block-initiative-app.bi-stats-hidden .bi-health-row>.bi-combat-controls{display:none!important}
.block-initiative-app.bi-stats-hidden .bi-kaiju-panel>.bi-row .bi-muted,
.block-initiative-app.bi-stats-hidden .bi-kaiju-panel>.bi-row .bi-statuses,
.block-initiative-app.bi-stats-hidden .bi-kaiju-panel>:not(.bi-row):not(.bi-combat-condition-control){display:none!important}
.block-initiative-app.bi-stats-hidden [data-combat-dashboard]>:first-child>.bi-muted{display:none!important}
`;
    documentRef.head.append(style);
}
