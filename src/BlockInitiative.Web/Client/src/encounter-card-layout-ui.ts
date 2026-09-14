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
@media(max-width:1180px){
  .block-initiative-app .bi-runner-members{grid-template-columns:1fr}
}
`;
    documentRef.head.append(style);
}
