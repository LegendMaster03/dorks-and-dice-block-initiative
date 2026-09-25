import { applyNumberLimits, TRACKER_LIMITS } from "./numeric-input-limits";
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
        ensureArmorClassFields(card);
    }
    ensureArmorClassHeaders(root);
    relabelSetupAction(root);
}

function ensureArmorClassFields(card: HTMLElement): void {
    const sourcePanel =
        card.querySelector<HTMLElement>(
            ":scope > [data-quick-stats-setup]");
    const isPlayer = card.dataset.alliance === "players";
    let group =
        card.querySelector<HTMLElement>(
            ":scope > .bi-entry-main > .bi-setup-ac-group");

    if (!isPlayer && !sourcePanel) {
        group?.remove();
        return;
    }

    const main =
        card.querySelector<HTMLElement>(
            ":scope > .bi-entry-main");
    const initiativeWrap =
        main?.querySelector<HTMLElement>(
            ":scope > [data-role='initiative-wrap']");
    if (!main || !initiativeWrap) return;

    if (!group) {
        group = document.createElement("div");
        group.className = "bi-setup-ac-group";
        group.setAttribute("aria-label", "Armor Class");
    }

    const definitions = [
        {
            quickStat: "armor-class",
            role: "setup-armor-class",
            label: "AC",
            placeholder: "e.g. 15"
        },
        {
            quickStat: "touch-armor-class",
            role: "setup-touch-armor-class",
            label: "Touch",
            placeholder: "e.g. 12"
        },
        {
            quickStat: "flat-footed-armor-class",
            role: "setup-flat-footed-armor-class",
            label: "Flat-Footed",
            placeholder: "e.g. 13"
        }
    ] as const;

    for (const definition of definitions) {
        const source =
            sourcePanel?.querySelector<HTMLInputElement>(
                `[data-quick-stat='${definition.quickStat}']`)
            ?? null;
        const sourceWrap =
            source?.closest<HTMLElement>(".bi-field")
            ?? null;

        let field =
            group.querySelector<HTMLElement>(
                `[data-ac-kind='${definition.quickStat}']`);
        if (!field) {
            field = document.createElement("div");
            field.className = "bi-field bi-setup-ac";
            field.dataset.acKind = definition.quickStat;

            const label = document.createElement("label");
            label.textContent = definition.label;
            const input = document.createElement("input");
            input.type = "number";
            input.dataset.role = definition.role;
            applyNumberLimits(input, TRACKER_LIMITS);
            field.append(label, input);
            group.append(field);
        }

        const input =
            field.querySelector<HTMLInputElement>(
                `[data-role='${definition.role}']`)!;
        input.placeholder =
            source?.placeholder
            || definition.placeholder;
        if (source && input.value !== source.value) {
            input.value = source.value;
        }
        input.oninput = () => {
            if (source) source.value = input.value;
        };
        input.onchange = () => {
            if (!source) return;
            source.value = input.value;
            source.dispatchEvent(
                new Event("change", { bubbles: true }));
        };

        if (sourceWrap) sourceWrap.hidden = true;
    }

    if (group.parentElement !== main
        || group.previousElementSibling !== initiativeWrap) {
        initiativeWrap.after(group);
    }
}
function ensureArmorClassHeaders(root: HTMLElement): void {
    for (const header of root.querySelectorAll<HTMLElement>(
        ".bi-player-roster-header,.bi-enemy-roster-header"
    )) {
        if (header.querySelector(":scope > [data-role='setup-ac-header']")) continue;

        const label = document.createElement("span");
        label.dataset.role = "setup-ac-header";
        label.textContent = "AC / Touch / Flat-Footed";

        const hp = Array.from(header.children)
            .find(child => child.textContent?.trim() === "HP")
            ?? null;
        const action = header.lastElementChild;
        if (hp) header.insertBefore(label, hp);
        else if (action) header.insertBefore(label, action);
        else header.append(label);
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
.block-initiative-app .bi-setup-ac-group{display:grid;grid-template-columns:4.25rem 4.25rem 5.5rem;gap:.3rem;align-items:end;min-width:14.6rem}
.block-initiative-app .bi-setup-ac-group .bi-setup-ac input{min-width:0}
.block-initiative-app.bi-dense-tracker .bi-player-roster-header{grid-template-columns:minmax(16rem,36rem) 5rem 13rem 14.6rem auto}
.block-initiative-app.bi-dense-tracker .bi-enemy-roster-header{grid-template-columns:minmax(16rem,34rem) 5rem 13rem 14.6rem 6rem auto}
.block-initiative-app.bi-dense-tracker .bi-player-entry{grid-template-columns:minmax(16rem,36rem) 5rem 13rem 14.6rem auto}
.block-initiative-app.bi-dense-tracker .bi-enemy-entry{grid-template-columns:minmax(16rem,34rem) 5rem 13rem 14.6rem 6rem auto}
.block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-setup-ac-group{grid-column:4;grid-row:1}
.block-initiative-app.bi-dense-tracker .bi-enemy-entry>[data-combat-setup='standard']{grid-column:5;grid-row:1}
.block-initiative-app.bi-dense-tracker .bi-player-entry>.bi-entry-main>button[data-action='remove']{grid-column:5;grid-row:1}
.block-initiative-app.bi-dense-tracker .bi-enemy-entry>.bi-entry-main>button[data-action='remove']{grid-column:6;grid-row:1}
@media(max-width:1020px){
  .block-initiative-app.bi-dense-tracker .bi-player-entry,
  .block-initiative-app.bi-dense-tracker .bi-enemy-entry{grid-template-columns:minmax(14rem,1fr) 5rem 13rem 14.6rem auto}
  .block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-setup-ac-group{grid-column:4;grid-row:1}
  .block-initiative-app.bi-dense-tracker .bi-enemy-entry>[data-combat-setup='standard']{grid-column:1/5;grid-row:2}
  .block-initiative-app.bi-dense-tracker .bi-player-entry>.bi-entry-main>button[data-action='remove'],
  .block-initiative-app.bi-dense-tracker .bi-enemy-entry>.bi-entry-main>button[data-action='remove']{grid-column:5;grid-row:1}
}
@media(max-width:720px){
  .block-initiative-app.bi-dense-tracker .bi-player-entry,
  .block-initiative-app.bi-dense-tracker .bi-enemy-entry{grid-template-columns:minmax(9rem,1fr) auto}
  .block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-setup-ac-group{grid-column:1/-1;grid-row:3}
  .block-initiative-app.bi-dense-tracker .bi-enemy-entry>[data-combat-setup='standard']{grid-column:1/-1;grid-row:4}
  .block-initiative-app .bi-setup-ac-group{grid-template-columns:repeat(3,minmax(4rem,1fr));min-width:0;width:100%}
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
