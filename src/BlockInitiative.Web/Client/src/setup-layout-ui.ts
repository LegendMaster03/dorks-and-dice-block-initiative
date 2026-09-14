let initialized = false;

export function initializeSetupLayoutUi(): void {
    if (initialized) return;
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement)) return;
    initialized = true;

    const kaijuList = root.querySelector<HTMLElement>("[data-role='kaiju-list']");
    const addGroupButton = root.querySelector<HTMLButtonElement>("[data-action='add-group']");
    const controls = addGroupButton?.closest<HTMLElement>(".bi-row");
    const parent = controls?.parentElement;

    if (!kaijuList || !controls || !parent || kaijuList.parentElement !== parent) return;

    // Keep every roster block above the controls that create more blocks.
    // Kaiju cards are rendered into their own list, so the list itself belongs
    // before the tactical-group controls just like the tactical-group list.
    parent.insertBefore(kaijuList, controls);
}
