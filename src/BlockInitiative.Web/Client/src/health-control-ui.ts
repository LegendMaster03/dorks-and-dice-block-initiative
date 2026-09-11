const initializedDocuments = new WeakSet<Document>();

export function initializeHealthControlUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement)) return;

    installStyles(root.ownerDocument);
    installDismissHandlers(root.ownerDocument);
    const observer = new MutationObserver(() => enhance(root));
    observer.observe(root, { childList: true, subtree: true });
    enhance(root);
}

function installStyles(documentRef: Document): void {
    if (documentRef.head.querySelector("style[data-role='health-control-ui-style']")) return;
    const style = documentRef.createElement("style");
    style.dataset.role = "health-control-ui-style";
    style.textContent = `
.block-initiative-app .bi-hp-editor{position:relative;display:inline-flex;align-items:center;width:max-content;max-width:100%}
.block-initiative-app .bi-hp-summary{min-width:5.6rem;padding:.28rem .48rem;white-space:nowrap;font-variant-numeric:tabular-nums}
.block-initiative-app .bi-hp-popover{position:absolute;z-index:40;top:calc(100% + .3rem);left:0;display:grid;gap:.45rem;min-width:18rem;padding:.55rem;border:1px solid var(--bi-border);border-radius:.5rem;background:var(--bs-body-bg,#fff);box-shadow:0 .45rem 1.2rem rgba(0,0,0,.22)}
.block-initiative-app .bi-hp-popover[hidden]{display:none!important}
.block-initiative-app .bi-hp-direct{display:grid;grid-template-columns:minmax(5rem,1fr) auto minmax(5rem,1fr);gap:.3rem;align-items:end}
.block-initiative-app .bi-hp-direct .bi-field,.block-initiative-app .bi-hp-adjust .bi-field{min-width:0}
.block-initiative-app .bi-hp-direct input{width:5.5rem;max-width:5.5rem}
.block-initiative-app .bi-hp-direct-slash{align-self:end;padding:0 .05rem .45rem;font-weight:700;opacity:.7}
.block-initiative-app .bi-hp-adjust{display:flex;gap:.3rem;align-items:end}
.block-initiative-app .bi-hp-adjust .bi-field{width:5.5rem;flex:0 0 5.5rem}
.block-initiative-app .bi-hp-adjust input{width:5.5rem;max-width:5.5rem;text-align:center}
.block-initiative-app .bi-hp-adjust .btn{min-width:2.15rem;width:2.15rem;height:2.15rem;padding:0;font-size:1rem;font-weight:700;line-height:1}
.block-initiative-app .bi-hp-popover label{font-size:.72rem;font-weight:600;opacity:.78;margin:0}
.block-initiative-app [data-combat-setup='standard']>.bi-combat-grid{display:block}
.block-initiative-app .bi-combat-grid{justify-content:start}
`;
    documentRef.head.append(style);
}

function installDismissHandlers(documentRef: Document): void {
    if (initializedDocuments.has(documentRef)) return;
    initializedDocuments.add(documentRef);

    documentRef.addEventListener("pointerdown", event => {
        const target = event.target;
        if (target instanceof Node && target.parentElement?.closest(".bi-hp-editor")) return;
        closeAllEditors(documentRef);
    });

    documentRef.addEventListener("keydown", event => {
        if (event.key === "Escape") closeAllEditors(documentRef);
    });
}

function enhance(root: HTMLElement): void {
    for (const panel of root.querySelectorAll<HTMLElement>("[data-combat-setup='standard']")) enhanceSetupPanel(panel);
    for (const row of root.querySelectorAll<HTMLElement>(".bi-health-row")) enhanceHealthRow(row);
}

function enhanceSetupPanel(panel: HTMLElement): void {
    if (panel.dataset.compactHealthReady === "true") return;
    const grid = panel.querySelector<HTMLElement>(":scope > .bi-combat-grid");
    if (!grid) return;

    const fields = Array.from(grid.querySelectorAll<HTMLElement>(":scope > .bi-field"));
    const max = findField(fields, "Max HP");
    const current = findField(fields, "Current HP");
    if (!current || !max) return;

    syncFullHealthDefault(current, max);
    panel.dataset.compactHealthReady = "true";
    const editor = buildHealthEditor(current, max);
    const summary = editor.querySelector<HTMLButtonElement>("[data-role='hp-summary']");
    if (summary) summary.title = "Current HP defaults to Max HP. Click to override starting HP or adjust it.";
    grid.replaceChildren(editor);
}

function enhanceHealthRow(row: HTMLElement): void {
    if (row.dataset.compactHealthReady === "true") return;
    const controls = row.querySelector<HTMLElement>(":scope > .bi-combat-controls");
    if (!controls) return;

    const fields = Array.from(controls.querySelectorAll<HTMLElement>(":scope > .bi-field"));
    const current = findField(fields, "Current HP");
    const max = findField(fields, "Max HP");
    if (!current || !max) return;

    row.dataset.compactHealthReady = "true";
    controls.replaceWith(buildHealthEditor(current, max));
}

function syncFullHealthDefault(current: HTMLElement, max: HTMLElement): void {
    const currentInput = current.querySelector<HTMLInputElement>("input[type='number']");
    const maxInput = max.querySelector<HTMLInputElement>("input[type='number']");
    if (!currentInput || !maxInput || maxInput.dataset.fullHealthSyncReady === "true") return;

    maxInput.dataset.fullHealthSyncReady = "true";
    let syncing = false;
    let previousMax = maxInput.value;
    let currentOverridden = currentInput.value.trim() !== "" && currentInput.value !== maxInput.value;

    currentInput.addEventListener("input", () => {
        if (syncing) return;
        currentOverridden = currentInput.value.trim() !== "" && currentInput.value !== maxInput.value;
    });

    maxInput.addEventListener("input", () => {
        const shouldSync = !currentOverridden
            || currentInput.value.trim() === ""
            || currentInput.value === previousMax;
        previousMax = maxInput.value;
        if (!shouldSync) return;

        syncing = true;
        currentInput.value = maxInput.value;
        currentInput.dispatchEvent(new Event("input", { bubbles: true }));
        currentInput.dispatchEvent(new Event("change", { bubbles: true }));
        syncing = false;
        currentOverridden = false;
    });

    if (currentInput.value.trim() === "" && maxInput.value.trim() !== "") {
        syncing = true;
        currentInput.value = maxInput.value;
        currentInput.dispatchEvent(new Event("input", { bubbles: true }));
        currentInput.dispatchEvent(new Event("change", { bubbles: true }));
        syncing = false;
        currentOverridden = false;
    }
}

function buildHealthEditor(current: HTMLElement, max: HTMLElement): HTMLElement {
    renameLabel(current, "Current HP");
    renameLabel(max, "Max HP");

    const wrapper = document.createElement("div");
    wrapper.className = "bi-hp-editor";

    const summary = document.createElement("button");
    summary.type = "button";
    summary.className = "btn btn-sm btn-outline-secondary bi-hp-summary";
    summary.dataset.role = "hp-summary";
    summary.setAttribute("aria-haspopup", "dialog");
    summary.setAttribute("aria-expanded", "false");
    summary.title = "Edit or adjust hit points";

    const popover = document.createElement("div");
    popover.className = "bi-hp-popover";
    popover.dataset.role = "hp-popover";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", "Edit hit points");
    popover.hidden = true;

    const direct = document.createElement("div");
    direct.className = "bi-hp-direct";
    const slash = document.createElement("span");
    slash.className = "bi-hp-direct-slash";
    slash.textContent = "/";
    slash.setAttribute("aria-hidden", "true");
    direct.append(current, slash, max);

    const amount = document.createElement("div");
    amount.className = "bi-field";
    const amountLabel = document.createElement("label");
    amountLabel.textContent = "Modify by";
    const amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.min = "0";
    amountInput.step = "1";
    amountInput.placeholder = "0";
    amountInput.inputMode = "numeric";
    amountInput.title = "Amount to add to or subtract from current HP";
    amount.append(amountLabel, amountInput);

    const subtract = document.createElement("button");
    subtract.type = "button";
    subtract.className = "btn btn-sm btn-outline-secondary";
    subtract.textContent = "−";
    subtract.title = "Subtract the modifier from current HP";
    subtract.setAttribute("aria-label", "Subtract HP modifier");

    const add = document.createElement("button");
    add.type = "button";
    add.className = "btn btn-sm btn-outline-secondary";
    add.textContent = "+";
    add.title = "Add the modifier to current HP";
    add.setAttribute("aria-label", "Add HP modifier");

    const adjust = document.createElement("div");
    adjust.className = "bi-hp-adjust";
    adjust.append(amount, subtract, add);
    popover.append(direct, adjust);
    wrapper.append(summary, popover);

    const currentInput = current.querySelector<HTMLInputElement>("input[type='number']");
    const maxInput = max.querySelector<HTMLInputElement>("input[type='number']");
    const updateSummary = () => setSummary(summary, currentInput, maxInput);
    updateSummary();

    currentInput?.addEventListener("input", updateSummary);
    currentInput?.addEventListener("change", updateSummary);
    maxInput?.addEventListener("input", updateSummary);
    maxInput?.addEventListener("change", updateSummary);

    summary.onclick = event => {
        event.stopPropagation();
        const shouldOpen = popover.hidden;
        closeAllEditors(wrapper.ownerDocument);
        popover.hidden = !shouldOpen;
        summary.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
        if (shouldOpen) {
            currentInput?.focus();
            currentInput?.select();
        }
    };

    popover.addEventListener("pointerdown", event => event.stopPropagation());
    subtract.onclick = () => {
        applyAdjustment(current, max, amountInput, -1);
        updateSummary();
    };
    add.onclick = () => {
        applyAdjustment(current, max, amountInput, 1);
        updateSummary();
    };

    return wrapper;
}

function closeAllEditors(documentRef: Document): void {
    for (const popover of documentRef.querySelectorAll<HTMLElement>(".bi-hp-popover:not([hidden])")) {
        popover.hidden = true;
        popover.closest<HTMLElement>(".bi-hp-editor")?.querySelector<HTMLElement>("[data-role='hp-summary']")?.setAttribute("aria-expanded", "false");
    }
}

function setSummary(summary: HTMLElement, currentInput: HTMLInputElement | null, maxInput: HTMLInputElement | null): void {
    const current = displayValue(currentInput?.value ?? "");
    const max = displayValue(maxInput?.value ?? "");
    const next = `${current} / ${max}`;
    if (summary.textContent !== next) summary.textContent = next;
}

function displayValue(value: string): string {
    const trimmed = value.trim();
    return trimmed === "" ? "—" : trimmed;
}

function applyAdjustment(currentField: HTMLElement, maxField: HTMLElement, amountInput: HTMLInputElement, direction: -1 | 1): void {
    const currentInput = currentField.querySelector<HTMLInputElement>("input[type='number']");
    const maxInput = maxField.querySelector<HTMLInputElement>("input[type='number']");
    if (!currentInput) return;

    const amount = Math.max(0, Number(amountInput.value) || 0);
    const current = Number(currentInput.value);
    const fallbackMax = Number(maxInput?.value ?? "");
    const base = Number.isFinite(current) && currentInput.value.trim() !== ""
        ? current
        : Number.isFinite(fallbackMax) && (maxInput?.value ?? "").trim() !== ""
            ? fallbackMax
            : 0;
    let next = direction < 0 ? Math.max(0, base - amount) : base + amount;

    if (direction > 0 && Number.isFinite(fallbackMax) && (maxInput?.value ?? "").trim() !== "") {
        next = Math.min(next, fallbackMax);
    }

    currentInput.value = String(next);
    currentInput.dispatchEvent(new Event("input", { bubbles: true }));
    currentInput.dispatchEvent(new Event("change", { bubbles: true }));
}

function findField(fields: HTMLElement[], labelText: string): HTMLElement | undefined {
    return fields.find(field => field.querySelector("label")?.textContent?.trim() === labelText);
}

function renameLabel(field: HTMLElement, text: string): void {
    const label = field.querySelector("label");
    if (label && label.textContent !== text) label.textContent = text;
}
