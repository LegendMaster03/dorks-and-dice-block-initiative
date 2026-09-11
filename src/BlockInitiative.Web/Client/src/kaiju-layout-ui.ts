const initializedDocuments = new WeakSet<Document>();
let scheduled = false;

export function initializeKaijuLayoutUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement)) return;

    installStyles(root.ownerDocument);
    installDismissHandlers(root.ownerDocument);

    const observer = new MutationObserver(() => schedule(root));
    observer.observe(root, { childList: true, subtree: true });
    schedule(root);
}

function schedule(root: HTMLElement): void {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
        scheduled = false;
        enhance(root);
    });
}

function enhance(root: HTMLElement): void {
    for (const card of root.querySelectorAll<HTMLElement>(".bi-entry[data-id]")) {
        const blockType = card.querySelector<HTMLSelectElement>("[data-field='block-type']")?.value;
        if (blockType !== "kaiju") continue;

        card.classList.add("bi-kaiju-entry");
        const badges = card.querySelector<HTMLElement>("[data-role='badges']");
        if (badges) badges.hidden = true;

        const panel = card.querySelector<HTMLElement>("[data-combat-setup='kaiju']");
        if (panel) enhanceKaijuSetup(panel);
    }
}

function enhanceKaijuSetup(panel: HTMLElement): void {
    panel.classList.add("bi-kaiju-setup-compact");

    if (panel.dataset.kaijuCompactReady !== "true") {
        const basics = panel.querySelector<HTMLElement>("[data-role='kaiju-basics']");
        const currentChaos = findField(panel, "Current Chaos");
        const chaosThreshold = findField(panel, "Chaos Threshold");
        const finishingBlow = findField(panel, "Finishing Blow");
        const phaseInput = panel.querySelector<HTMLInputElement>("[data-field='behaviour-phase']");
        const phaseField = phaseInput?.closest<HTMLElement>(".bi-field");

        if (basics && currentChaos && chaosThreshold && finishingBlow && phaseField) {
            panel.dataset.kaijuCompactReady = "true";
            basics.classList.remove("three");
            basics.classList.add("bi-kaiju-state-strip");

            const chaos = buildPoolEditor(
                currentChaos,
                chaosThreshold,
                "Chaos",
                "Edit or adjust Chaos current / threshold"
            );
            chaos.classList.add("bi-kaiju-chaos");

            finishingBlow.classList.add("bi-kaiju-finishing-blow");
            renameLabel(finishingBlow, "Finishing Blow target");

            phaseField.classList.add("bi-kaiju-phase");
            renameLabel(phaseField, "Behaviour / phase");

            basics.replaceChildren(chaos, finishingBlow, phaseField);
        }

        const addArea = panel.querySelector<HTMLButtonElement>("[data-action='add-area']");
        if (addArea) {
            addArea.textContent = "+ Vulnerable area";
            addArea.title = "Add vulnerable area";
        }

        const overrides = panel.querySelector<HTMLElement>("[data-role='overrides']");
        overrides?.classList.add("bi-kaiju-overrides");

        const overrideDetails = overrides?.closest<HTMLDetailsElement>("details");
        if (overrideDetails) overrideDetails.open = false;
    }

    const areaList = panel.querySelector<HTMLElement>("[data-role='setup-areas']");
    if (!areaList) return;

    ensureAreaHeader(areaList);
    for (const row of areaList.querySelectorAll<HTMLElement>(":scope > .bi-area-row")) {
        enhanceAreaRow(row);
    }
}

function ensureAreaHeader(list: HTMLElement): void {
    if (list.querySelector(":scope > .bi-kaiju-area-header")) return;

    const header = document.createElement("div");
    header.className = "bi-kaiju-area-header";
    header.innerHTML = "<span>Name</span><span>HP</span><span>Targetable</span><span>Exploited</span><span></span>";
    list.prepend(header);
}

function enhanceAreaRow(row: HTMLElement): void {
    if (row.dataset.kaijuAreaCompactReady === "true") return;

    const grid = row.querySelector<HTMLElement>(":scope > .bi-combat-grid");
    const controls = row.querySelector<HTMLElement>(":scope > .bi-combat-controls");
    if (!grid || !controls) return;

    const name = findField(grid, "Name");
    const maxHp = findField(grid, "Max HP");
    const currentHp = findField(grid, "Current HP");
    const targetable = controls.querySelector<HTMLElement>(".bi-inline-check");
    const targetableInput = targetable?.querySelector<HTMLInputElement>("input[type='checkbox']");
    const exploited = findField(controls, "Exploited");
    const remove = Array.from(controls.querySelectorAll<HTMLButtonElement>("button"))
        .find(button => button.textContent?.trim() === "Remove");
    if (!name || !maxHp || !currentHp || !targetable || !exploited || !remove) return;

    row.dataset.kaijuAreaCompactReady = "true";
    row.classList.add("bi-kaiju-area-compact");

    const hp = buildPoolEditor(currentHp, maxHp, "", "Edit or adjust vulnerable area HP");
    name.classList.add("bi-kaiju-area-name");
    targetable.classList.add("bi-kaiju-area-targetable");
    exploited.classList.add("bi-kaiju-area-exploited");
    remove.classList.add("bi-kaiju-area-remove");
    remove.title = "Remove vulnerable area";

    if (targetableInput) targetableInput.setAttribute("aria-label", "Targetable");
    for (const node of Array.from(targetable.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) node.textContent = "";
    }

    row.replaceChildren(name, hp, targetable, exploited, remove);
}

function buildPoolEditor(
    currentField: HTMLElement,
    maxField: HTMLElement,
    label: string,
    title: string
): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "bi-kaiju-pool-editor";

    if (label) {
        const caption = document.createElement("span");
        caption.className = "bi-kaiju-pool-label";
        caption.textContent = label === "Chaos" ? "Chaos (current / threshold)" : label;
        wrapper.append(caption);
    }

    const summary = document.createElement("button");
    summary.type = "button";
    summary.className = "btn btn-sm btn-outline-secondary bi-kaiju-pool-summary";
    summary.dataset.role = "kaiju-pool-summary";
    summary.setAttribute("aria-haspopup", "dialog");
    summary.setAttribute("aria-expanded", "false");
    summary.title = title;

    const popover = document.createElement("div");
    popover.className = "bi-kaiju-pool-popover";
    popover.hidden = true;
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", title);

    renameLabel(currentField, label === "Chaos" ? "Current Chaos" : "Current HP");
    renameLabel(maxField, label === "Chaos" ? "Chaos Threshold" : "Max HP");

    const direct = document.createElement("div");
    direct.className = "bi-kaiju-pool-direct";
    const slash = document.createElement("span");
    slash.className = "bi-kaiju-pool-slash";
    slash.textContent = "/";
    direct.append(currentField, slash, maxField);

    const amountField = document.createElement("div");
    amountField.className = "bi-field";
    const amountLabel = document.createElement("label");
    amountLabel.textContent = "Modify by";
    const amount = document.createElement("input");
    amount.type = "number";
    amount.min = "0";
    amount.step = "1";
    amount.placeholder = "0";
    amount.inputMode = "numeric";
    amountField.append(amountLabel, amount);

    const subtract = actionButton("−", `Subtract from ${label || "HP"}`);
    const add = actionButton("+", `Add to ${label || "HP"}`);
    const adjust = document.createElement("div");
    adjust.className = "bi-kaiju-pool-adjust";
    adjust.append(amountField, subtract, add);

    popover.append(direct, adjust);
    wrapper.append(summary, popover);

    const currentInput = currentField.querySelector<HTMLInputElement>("input[type='number']");
    const maxInput = maxField.querySelector<HTMLInputElement>("input[type='number']");
    const updateSummary = () => {
        const next = `${displayValue(currentInput?.value ?? "")} / ${displayValue(maxInput?.value ?? "")}`;
        if (summary.textContent !== next) summary.textContent = next;
    };
    updateSummary();

    currentInput?.addEventListener("input", updateSummary);
    currentInput?.addEventListener("change", updateSummary);
    maxInput?.addEventListener("input", updateSummary);
    maxInput?.addEventListener("change", updateSummary);

    summary.onclick = event => {
        event.stopPropagation();
        const open = popover.hidden;
        closeAllEditors(wrapper.ownerDocument);
        popover.hidden = !open;
        summary.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) {
            currentInput?.focus();
            currentInput?.select();
        }
    };
    popover.addEventListener("pointerdown", event => event.stopPropagation());

    subtract.onclick = () => {
        applyAdjustment(currentInput, maxInput, amount, -1);
        updateSummary();
    };
    add.onclick = () => {
        applyAdjustment(currentInput, maxInput, amount, 1);
        updateSummary();
    };

    return wrapper;
}

function actionButton(text: string, label: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-sm btn-outline-secondary";
    button.textContent = text;
    button.title = label;
    button.setAttribute("aria-label", label);
    return button;
}

function applyAdjustment(
    currentInput: HTMLInputElement | null,
    maxInput: HTMLInputElement | null,
    amountInput: HTMLInputElement,
    direction: -1 | 1
): void {
    if (!currentInput) return;

    const amount = Math.max(0, Number(amountInput.value) || 0);
    const currentValue = Number(currentInput.value);
    const maxValue = Number(maxInput?.value ?? "");
    const hasCurrent = currentInput.value.trim() !== "" && Number.isFinite(currentValue);
    const hasMax = (maxInput?.value ?? "").trim() !== "" && Number.isFinite(maxValue);
    const base = hasCurrent ? currentValue : hasMax ? maxValue : 0;

    let next = direction < 0 ? Math.max(0, base - amount) : base + amount;
    if (direction > 0 && hasMax) next = Math.min(next, maxValue);

    currentInput.value = String(next);
    currentInput.dispatchEvent(new Event("input", { bubbles: true }));
    currentInput.dispatchEvent(new Event("change", { bubbles: true }));
}

function installDismissHandlers(documentRef: Document): void {
    if (initializedDocuments.has(documentRef)) return;
    initializedDocuments.add(documentRef);

    documentRef.addEventListener("pointerdown", event => {
        const target = event.target;
        if (target instanceof Element && target.closest(".bi-kaiju-pool-editor")) return;
        closeAllEditors(documentRef);
    });

    documentRef.addEventListener("keydown", event => {
        if (event.key === "Escape") closeAllEditors(documentRef);
    });
}

function closeAllEditors(documentRef: Document): void {
    for (const popover of documentRef.querySelectorAll<HTMLElement>(".bi-kaiju-pool-popover:not([hidden])")) {
        popover.hidden = true;
        popover.closest<HTMLElement>(".bi-kaiju-pool-editor")
            ?.querySelector<HTMLElement>("[data-role='kaiju-pool-summary']")
            ?.setAttribute("aria-expanded", "false");
    }
}

function findField(scope: ParentNode, labelText: string): HTMLElement | undefined {
    return Array.from(scope.querySelectorAll<HTMLElement>(".bi-field"))
        .find(field => field.querySelector("label")?.textContent?.trim() === labelText);
}

function renameLabel(field: HTMLElement, text: string): void {
    const label = field.querySelector("label");
    if (label && label.textContent !== text) label.textContent = text;
}

function displayValue(value: string): string {
    const trimmed = value.trim();
    return trimmed === "" ? "—" : trimmed;
}

function installStyles(documentRef: Document): void {
    if (documentRef.head.querySelector("style[data-role='kaiju-layout-ui-style']")) return;

    const style = documentRef.createElement("style");
    style.dataset.role = "kaiju-layout-ui-style";
    style.textContent = `
.block-initiative-app .bi-kaiju-entry>[data-role='badges']{display:none!important}
.block-initiative-app .bi-kaiju-entry>.bi-entry-main{grid-template-columns:minmax(18rem,1fr) 6rem 12rem auto!important;column-gap:.6rem;align-items:end}
.block-initiative-app .bi-kaiju-entry>.bi-entry-main>button[data-action='remove']{width:auto!important;justify-self:start;padding:.25rem .5rem}
.block-initiative-app .bi-kaiju-entry .bi-initiative-modifier input{width:6rem;max-width:6rem}
.block-initiative-app .bi-kaiju-entry [data-role='initiative-wrap']{display:grid!important;grid-template-columns:5.5rem auto!important;grid-template-areas:'label label' 'input roll';gap:.25rem .35rem;align-items:end}
.block-initiative-app .bi-kaiju-entry [data-role='initiative-wrap']>label{grid-area:label}
.block-initiative-app .bi-kaiju-entry [data-role='initiative-wrap']>input{grid-area:input;width:5.5rem;max-width:5.5rem}
.block-initiative-app .bi-kaiju-entry [data-role='initiative-wrap']>.bi-roll-line{grid-area:roll;margin:0!important;flex-wrap:nowrap!important;align-self:end}
.block-initiative-app .bi-kaiju-entry .bi-roll-audit{display:none}

.block-initiative-app .bi-kaiju-setup-compact{display:grid;gap:.6rem}
.block-initiative-app .bi-kaiju-setup-compact>.mt-2,.block-initiative-app .bi-kaiju-setup-compact>.mt-3{margin-top:0!important}
.block-initiative-app .bi-kaiju-state-strip{display:flex!important;gap:.75rem;align-items:flex-end;flex-wrap:wrap}
.block-initiative-app .bi-kaiju-chaos{flex:0 0 auto}
.block-initiative-app .bi-kaiju-finishing-blow{flex:0 0 9rem}
.block-initiative-app .bi-kaiju-finishing-blow input{width:9rem;max-width:9rem}
.block-initiative-app .bi-kaiju-phase{flex:1 1 18rem;max-width:28rem}
.block-initiative-app .bi-kaiju-phase input{width:100%;max-width:28rem}
.block-initiative-app .bi-kaiju-overrides{grid-template-columns:repeat(3,minmax(8rem,12rem))!important;justify-content:start}
.block-initiative-app .bi-kaiju-setup-compact>details{margin-top:.15rem}

.block-initiative-app .bi-kaiju-pool-editor{position:relative;display:inline-flex;align-items:flex-end;gap:.3rem;width:max-content;max-width:100%}
.block-initiative-app .bi-kaiju-pool-label{font-size:.78rem;font-weight:700;opacity:.78;align-self:center;white-space:nowrap}
.block-initiative-app .bi-kaiju-pool-summary{min-width:5.6rem;padding:.28rem .48rem;white-space:nowrap;font-variant-numeric:tabular-nums}
.block-initiative-app .bi-kaiju-pool-popover{position:absolute;z-index:45;top:calc(100% + .3rem);left:0;display:grid;gap:.45rem;min-width:18rem;padding:.55rem;border:1px solid var(--bi-border);border-radius:.5rem;background:var(--bs-body-bg,#fff);box-shadow:0 .45rem 1.2rem rgba(0,0,0,.22)}
.block-initiative-app .bi-kaiju-pool-popover[hidden]{display:none!important}
.block-initiative-app .bi-kaiju-pool-direct{display:grid;grid-template-columns:5.5rem auto 5.5rem;gap:.3rem;align-items:end}
.block-initiative-app .bi-kaiju-pool-direct .bi-field{min-width:0}
.block-initiative-app .bi-kaiju-pool-direct input{width:5.5rem;max-width:5.5rem}
.block-initiative-app .bi-kaiju-pool-slash{padding-bottom:.45rem;font-weight:700;opacity:.7}
.block-initiative-app .bi-kaiju-pool-adjust{display:flex;gap:.3rem;align-items:end}
.block-initiative-app .bi-kaiju-pool-adjust .bi-field{width:5.5rem;flex:0 0 5.5rem}
.block-initiative-app .bi-kaiju-pool-adjust input{width:5.5rem;max-width:5.5rem;text-align:center}
.block-initiative-app .bi-kaiju-pool-adjust .btn{width:2.15rem;height:2.15rem;min-width:2.15rem;padding:0;font-weight:700}
.block-initiative-app .bi-kaiju-pool-popover label{font-size:.72rem;font-weight:600;opacity:.78;margin:0}

.block-initiative-app .bi-kaiju-area-header,.block-initiative-app .bi-kaiju-area-compact{display:grid;grid-template-columns:minmax(13rem,1fr) 6rem 5.5rem 8rem auto;gap:.5rem;align-items:center}
.block-initiative-app .bi-kaiju-area-header{padding:0 .2rem;font-size:.75rem;font-weight:700;letter-spacing:.02em;text-transform:uppercase;opacity:.68}
.block-initiative-app .bi-kaiju-area-compact{padding:.4rem .2rem!important;border:0!important;border-bottom:1px solid var(--bi-border)!important;border-radius:0!important}
.block-initiative-app .bi-kaiju-area-name label,.block-initiative-app .bi-kaiju-area-exploited label{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important}
.block-initiative-app .bi-kaiju-area-name input{width:100%}
.block-initiative-app .bi-kaiju-area-targetable{margin:0!important;justify-self:center}
.block-initiative-app .bi-kaiju-area-exploited select{width:8rem;max-width:8rem}
.block-initiative-app .bi-kaiju-area-remove{width:auto!important;justify-self:start;padding:.25rem .5rem}

@media(max-width:900px){
  .block-initiative-app .bi-kaiju-entry>.bi-entry-main{grid-template-columns:minmax(12rem,1fr) 6rem 12rem auto!important}
}
@media(max-width:760px){
  .block-initiative-app .bi-kaiju-area-header{display:none}
  .block-initiative-app .bi-kaiju-area-compact{grid-template-columns:minmax(12rem,1fr) auto auto;align-items:end}
  .block-initiative-app .bi-kaiju-area-name{grid-column:1/-1}
  .block-initiative-app .bi-kaiju-area-compact>.bi-kaiju-pool-editor{grid-column:1}
  .block-initiative-app .bi-kaiju-area-targetable{grid-column:2}
  .block-initiative-app .bi-kaiju-area-exploited{grid-column:1/3}
  .block-initiative-app .bi-kaiju-area-remove{grid-column:3;grid-row:2}
  .block-initiative-app .bi-kaiju-area-name label,.block-initiative-app .bi-kaiju-area-exploited label{position:static!important;width:auto!important;height:auto!important;margin:0!important;overflow:visible!important;clip:auto!important;white-space:normal!important}
}
@media(max-width:620px){
  .block-initiative-app .bi-kaiju-entry>.bi-entry-main{grid-template-columns:1fr auto!important}
  .block-initiative-app .bi-kaiju-entry [data-role='name-field']{grid-column:1/-1}
  .block-initiative-app .bi-kaiju-entry .bi-initiative-modifier{grid-column:1}
  .block-initiative-app .bi-kaiju-entry [data-role='initiative-wrap']{grid-column:2}
  .block-initiative-app .bi-kaiju-entry>.bi-entry-main>button[data-action='remove']{grid-column:1/-1}
  .block-initiative-app .bi-kaiju-state-strip{display:grid!important;grid-template-columns:1fr}
  .block-initiative-app .bi-kaiju-phase{max-width:none}
}
`;
    documentRef.head.append(style);
}