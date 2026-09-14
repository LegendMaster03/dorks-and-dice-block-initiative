import { registerAfterRender, requestEnhancement } from "./render-lifecycle";

type PreviewDetail = {
    response?: {
        requiresAdjudication?: boolean;
    };
};

let initialized = false;
let continueAfterPreview = false;
let previewReadyToContinue = false;

export function initializeEncounterSetupPolishUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    installStyles(root.ownerDocument);

    root.addEventListener("click", event => {
        const element = eventElement(event);
        const preview = element?.closest<HTMLButtonElement>("[data-action='preview']");
        if (!preview || !root.contains(preview)) return;
        continueAfterPreview = true;
        previewReadyToContinue = false;
    }, true);

    const cancelPendingContinuation = (event: Event) => {
        const element = eventElement(event);
        if (!element || element.closest("[data-role='results']")) return;
        continueAfterPreview = false;
        previewReadyToContinue = false;
    };
    root.addEventListener("input", cancelPendingContinuation, true);
    root.addEventListener("change", cancelPendingContinuation, true);

    window.addEventListener("block-initiative:preview", event => {
        if (!continueAfterPreview) return;
        const detail = (event as CustomEvent<PreviewDetail>).detail;
        previewReadyToContinue = !detail?.response?.requiresAdjudication;
        requestEnhancement();
    });

    // Quick stats creates the authoritative AC field at 120. Present a synced
    // setup control after that pass without moving the source field that the
    // combat-stat merge logic already owns.
    registerAfterRender("encounter-setup-polish", 135, () => enhanceSetup(root));

    // Preview rendering happens synchronously after the preview event returns.
    // A later lifecycle hook can therefore continue through the existing Start
    // or Resume action without observing application-owned DOM.
    registerAfterRender("encounter-start-flow", 170, () => continueIntoEncounter(root));
}

function enhanceSetup(root: HTMLElement): void {
    for (const card of root.querySelectorAll<HTMLElement>(".bi-entry[data-id]")) {
        ensureArmorClassField(card);
    }
    ensureArmorClassHeaders(root);
    relabelSetupAction(root);
}

function ensureArmorClassField(card: HTMLElement): void {
    const source = card.querySelector<HTMLInputElement>(
        ":scope > [data-quick-stats-setup] [data-quick-stat='armor-class']"
    );
    const sourceWrap = source?.closest<HTMLElement>(".bi-field") ?? null;
    const existing = card.querySelector<HTMLElement>(":scope > .bi-entry-main > .bi-setup-ac");
    const blockType = card.querySelector<HTMLSelectElement>("[data-field='block-type']")?.value;
    const standardNonPlayer = card.dataset.alliance !== "players" && blockType === "standard";

    if (!standardNonPlayer || !source || !sourceWrap) {
        existing?.remove();
        if (sourceWrap) sourceWrap.hidden = false;
        return;
    }

    const main = card.querySelector<HTMLElement>(":scope > .bi-entry-main");
    const initiativeWrap = main?.querySelector<HTMLElement>(":scope > [data-role='initiative-wrap']");
    if (!main || !initiativeWrap) {
        sourceWrap.hidden = false;
        return;
    }

    let field = existing;
    if (!field) {
        field = document.createElement("div");
        field.className = "bi-field bi-setup-ac";
        const label = document.createElement("label");
        label.textContent = "AC";
        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "numeric";
        input.dataset.role = "setup-armor-class";
        field.append(label, input);
    }

    const input = field.querySelector<HTMLInputElement>("[data-role='setup-armor-class']")!;
    input.placeholder = source.placeholder;
    if (input.value !== source.value) input.value = source.value;
    input.oninput = () => {
        source.value = input.value;
    };
    input.onchange = () => {
        source.value = input.value;
        source.dispatchEvent(new Event("change", { bubbles: true }));
    };

    sourceWrap.hidden = true;
    if (field.parentElement !== main || field.previousElementSibling !== initiativeWrap) {
        initiativeWrap.after(field);
    }
}

function ensureArmorClassHeaders(root: HTMLElement): void {
    for (const header of root.querySelectorAll<HTMLElement>(".bi-enemy-roster-header")) {
        if (header.querySelector(":scope > [data-role='setup-ac-header']")) continue;
        const label = document.createElement("span");
        label.dataset.role = "setup-ac-header";
        label.textContent = "AC";
        const hp = Array.from(header.children).find(child => child.textContent?.trim() === "HP") ?? null;
        hp ? header.insertBefore(label, hp) : header.append(label);
    }
}

function relabelSetupAction(root: HTMLElement): void {
    const button = root.querySelector<HTMLButtonElement>("[data-action='preview']");
    if (!button) return;
    const current = button.textContent?.trim() ?? "";
    if (current === "Review encounter changes" || current === "Apply changes & resume") {
        button.textContent = "Apply changes & resume";
        button.title = "Rebuild initiative blocks and resume the running encounter";
        return;
    }
    if (current === "Build initiative blocks" || current === "Start encounter") {
        button.textContent = "Start encounter";
        button.title = "Build initiative blocks and start encounter tracking";
    }
}

function continueIntoEncounter(root: HTMLElement): void {
    relabelSetupAction(root);
    if (!continueAfterPreview || !previewReadyToContinue) return;

    const action = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-role='results'] button.btn-primary"))
        .find(button => /^(Start encounter|Resume encounter)$/i.test(button.textContent?.trim() ?? ""));
    if (!action) return;

    continueAfterPreview = false;
    previewReadyToContinue = false;
    action.click();
}

function installStyles(documentRef: Document): void {
    if (documentRef.head.querySelector("style[data-role='encounter-setup-polish-ui-style']")) return;
    const style = documentRef.createElement("style");
    style.dataset.role = "encounter-setup-polish-ui-style";
    style.textContent = `
.block-initiative-app.bi-dense-tracker .bi-enemy-roster-header{grid-template-columns:minmax(16rem,34rem) 5rem 13rem 4.5rem 6rem auto}
.block-initiative-app.bi-dense-tracker .bi-enemy-entry{grid-template-columns:minmax(16rem,34rem) 5rem 13rem 4.5rem 6rem auto}
.block-initiative-app.bi-dense-tracker .bi-enemy-entry .bi-setup-ac{grid-column:4;grid-row:1;width:4.5rem}
.block-initiative-app.bi-dense-tracker .bi-enemy-entry .bi-setup-ac input{width:4.5rem;max-width:4.5rem}
.block-initiative-app.bi-dense-tracker .bi-enemy-entry>[data-combat-setup='standard']{grid-column:5;grid-row:1}
.block-initiative-app.bi-dense-tracker .bi-enemy-entry>.bi-entry-main>button[data-action='remove']{grid-column:6;grid-row:1}
@media(max-width:880px){
  .block-initiative-app.bi-dense-tracker .bi-enemy-entry{grid-template-columns:minmax(14rem,1fr) 5rem 13rem 4.5rem auto}
  .block-initiative-app.bi-dense-tracker .bi-enemy-entry .bi-setup-ac{grid-column:4;grid-row:1}
  .block-initiative-app.bi-dense-tracker .bi-enemy-entry>[data-combat-setup='standard']{grid-column:1/5;grid-row:2}
  .block-initiative-app.bi-dense-tracker .bi-enemy-entry>.bi-entry-main>button[data-action='remove']{grid-column:5;grid-row:1}
}
@media(max-width:650px){
  .block-initiative-app.bi-dense-tracker .bi-enemy-entry{grid-template-columns:minmax(9rem,1fr) auto}
  .block-initiative-app.bi-dense-tracker .bi-enemy-entry .bi-setup-ac{grid-column:1;grid-row:3}
  .block-initiative-app.bi-dense-tracker .bi-enemy-entry>[data-combat-setup='standard']{grid-column:1/-1;grid-row:4}
}
`;
    documentRef.head.append(style);
}

function eventElement(event: Event): Element | null {
    const target = event.target;
    return target instanceof Element
        ? target
        : target instanceof Node
            ? target.parentElement
            : null;
}
