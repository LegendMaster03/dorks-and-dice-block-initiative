import { registerAfterRender } from "./render-lifecycle";

let initialized = false;

export function initializeCombatantFieldUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    installStyles(root);
    registerAfterRender("combatant-fields", 20, () => enhance(root));
}

function installStyles(root: HTMLElement): void {
    if (root.querySelector("style[data-role='combatant-field-ui-style']")) return;

    const style = document.createElement("style");
    style.dataset.role = "combatant-field-ui-style";
    style.textContent = `
.block-initiative-app .bi-entry-main.bi-primary-fields{
  grid-template-columns:minmax(11rem,1.7fr) minmax(5.5rem,7rem) minmax(6rem,8rem) auto;
}
.block-initiative-app .bi-entry-main.bi-primary-fields.custom{
  grid-template-columns:minmax(10rem,1.4fr) minmax(8rem,1fr) minmax(5.5rem,7rem) minmax(6rem,8rem) auto;
}
.block-initiative-app .bi-entry-main.bi-primary-fields>.bi-field{min-width:0}
.block-initiative-app .bi-entry-main.bi-primary-fields .bi-initiative-modifier input,
.block-initiative-app .bi-entry-main.bi-primary-fields [data-role='initiative-wrap']>input{max-width:8rem}
.block-initiative-app details[data-role='internal-combatant-fields']{display:none!important}
@media(max-width:800px){
  .block-initiative-app .bi-entry-main.bi-primary-fields,
  .block-initiative-app .bi-entry-main.bi-primary-fields.custom{grid-template-columns:minmax(10rem,1fr) minmax(5.5rem,7rem) minmax(6rem,8rem) auto}
  .block-initiative-app .bi-entry-main.bi-primary-fields.custom [data-field='custom-side']{grid-column:1/-1}
}
@media(max-width:560px){
  .block-initiative-app .bi-entry-main.bi-primary-fields,
  .block-initiative-app .bi-entry-main.bi-primary-fields.custom{grid-template-columns:1fr 1fr}
  .block-initiative-app .bi-entry-main.bi-primary-fields [data-role='name-field'],
  .block-initiative-app .bi-entry-main.bi-primary-fields.custom [data-field='custom-side']{grid-column:1/-1}
  .block-initiative-app .bi-entry-main.bi-primary-fields>button{justify-self:start}
}
`;
    root.prepend(style);
}

function enhance(root: HTMLElement): void {
    for (const card of root.querySelectorAll<HTMLElement>(".bi-entry[data-id]")) {
        if (card.dataset.primaryFieldsReady === "true") continue;

        const main = card.querySelector<HTMLElement>(".bi-entry-main");
        const initiativeWrap = card.querySelector<HTMLElement>("[data-role='initiative-wrap']");
        const modifierInput = card.querySelector<HTMLInputElement>("[data-field='modifier']");
        const blockTypeInput = card.querySelector<HTMLSelectElement>("[data-field='block-type']");
        const controllerInput = card.querySelector<HTMLSelectElement>("[data-field='controller']");
        const rulesReferenceInput = card.querySelector<HTMLInputElement>("[data-field='rules-reference']");
        const details = modifierInput?.closest("details");

        if (!main || !initiativeWrap || !modifierInput || !blockTypeInput || !controllerInput || !rulesReferenceInput || !(details instanceof HTMLDetailsElement)) continue;

        const modifierField = modifierInput.closest<HTMLElement>(".bi-field");
        const blockTypeField = blockTypeInput.closest<HTMLElement>(".bi-field");
        const controllerField = controllerInput.closest<HTMLElement>(".bi-field");
        const rulesReferenceField = rulesReferenceInput.closest<HTMLElement>(".bi-field");
        if (!modifierField || !blockTypeField || !controllerField || !rulesReferenceField) continue;

        card.dataset.primaryFieldsReady = "true";
        main.classList.add("bi-primary-fields");

        modifierField.classList.add("bi-initiative-modifier");
        const modifierLabel = modifierField.querySelector("label");
        if (modifierLabel) modifierLabel.textContent = "Initiative modifier";
        modifierInput.placeholder = "e.g. +2";
        initiativeWrap.before(modifierField);

        blockTypeField.hidden = true;
        controllerField.hidden = true;
        rulesReferenceField.hidden = true;
        details.dataset.role = "internal-combatant-fields";
        details.hidden = true;
    }
}
