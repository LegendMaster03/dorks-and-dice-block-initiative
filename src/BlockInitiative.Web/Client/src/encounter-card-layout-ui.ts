let initialized = false;

export function initializeEncounterCardLayoutUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;
    installStyles(root.ownerDocument);
}

function installStyles(documentRef: Document): void {
    if (documentRef.head.querySelector("style[data-role='encounter-card-layout-ui-style']")) return;

    const style = documentRef.createElement("style");
    style.dataset.role = "encounter-card-layout-ui-style";
    style.textContent = `
.block-initiative-app .bi-runner-members{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:.75rem;
  align-items:start;
}
.block-initiative-app .bi-runner-member{
  min-width:0;
  align-self:start;
}
.block-initiative-app .bi-runner-member .bi-quick-ability{
  min-width:0;
}
.block-initiative-app .bi-integrated-kaiju>.bi-row h5{
  display:none;
}
.block-initiative-app .bi-card-secondary-statline{display:flex;justify-content:space-between;align-items:flex-end;gap:.75rem;flex:1 0 100%;width:100%;padding-top:.42rem;border-top:1px solid var(--bi-border);font-variant-numeric:tabular-nums}
.block-initiative-app .bi-card-secondary-left{min-width:0;font-size:.88rem}
.block-initiative-app .bi-card-secondary-right{display:flex;gap:.8rem;align-items:flex-end;margin-left:auto}
.block-initiative-app .bi-card-secondary-stat{display:grid;justify-items:center;line-height:1;min-width:2.6rem}
.block-initiative-app .bi-card-secondary-stat>strong{font-size:1.05rem;font-weight:800}
.block-initiative-app .bi-card-secondary-stat[data-stat='ac']>strong{font-size:1.45rem}
.block-initiative-app .bi-card-secondary-stat>span,.block-initiative-app .bi-card-secondary-health-label{font-size:.62rem;text-transform:uppercase;letter-spacing:.04em;opacity:.62;margin-top:.18rem}
.block-initiative-app .bi-card-secondary-health{display:grid;justify-items:center;line-height:1;min-width:5.6rem}
.block-initiative-app .bi-card-secondary-health>.bi-hp-editor{margin:0}
.block-initiative-app .bi-card-secondary-health .bi-hp-summary{margin:0}
.block-initiative-app .bi-card-secondary-statline + .bi-quick-stats{border-top:0;padding-top:0}
.block-initiative-app.bi-stats-hidden .bi-card-secondary-statline{display:none!important}
@media(max-width:1180px){
  .block-initiative-app .bi-runner-members{grid-template-columns:1fr}
}
@media(max-width:620px){
  .block-initiative-app .bi-card-secondary-statline{align-items:center}
  .block-initiative-app .bi-card-secondary-right{gap:.55rem}
}
`;
    documentRef.head.append(style);
}
