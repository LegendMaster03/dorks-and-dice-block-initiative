export function initializeHealthControlUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement)) return;

    installStyles(root.ownerDocument);
    const observer = new MutationObserver(() => enhance(root));
    observer.observe(root, { childList: true, subtree: true });
    enhance(root);
}

function installStyles(documentRef: Document): void {
    if (documentRef.head.querySelector("style[data-role='health-control-ui-style']")) return;
    const style = documentRef.createElement("style");
    style.dataset.role = "health-control-ui-style";
    style.textContent = `
.block-initiative-app .bi-hp-controls{display:inline-flex;gap:.3rem;align-items:center;flex-wrap:nowrap;margin:0;width:max-content;max-width:100%}
.block-initiative-app .bi-hp-fraction,.block-initiative-app .bi-hp-adjust{display:inline-flex;gap:.2rem;align-items:center;flex:0 0 auto}
.block-initiative-app .bi-hp-fraction>.bi-field{min-width:3.5rem;max-width:3.5rem;flex:0 0 3.5rem}
.block-initiative-app .bi-hp-adjust>.bi-field{min-width:3.25rem;max-width:3.25rem;flex:0 0 3.25rem}
.block-initiative-app .bi-hp-fraction input{width:3.5rem;max-width:3.5rem}
.block-initiative-app .bi-hp-adjust input{width:3.25rem;max-width:3.25rem;text-align:center}
.block-initiative-app .bi-hp-slash{font-size:1rem;line-height:1;font-weight:600;opacity:.72;padding:0 .05rem}
.block-initiative-app .bi-hp-adjust .btn{min-width:1.9rem;width:1.9rem;height:1.9rem;padding:0;font-size:1rem;font-weight:700;line-height:1}
.block-initiative-app [data-combat-setup='standard']>.bi-combat-grid{display:block}
.block-initiative-app .bi-combat-grid .bi-field input[type='number'],
.block-initiative-app .bi-combat-controls .bi-field input[type='number']{max-width:4rem}
.block-initiative-app .bi-combat-grid{justify-content:start}
`;
    documentRef.head.append(style);
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

    panel.dataset.compactHealthReady = "true";
    const controls = buildCompactControls(current, max);
    grid.replaceChildren(controls);
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
    const compact = buildCompactControls(current, max);
    controls.replaceWith(compact);
}

function buildCompactControls(current: HTMLElement, max: HTMLElement): HTMLElement {
    renameLabel(current, "Current HP");
    renameLabel(max, "Max HP");

    const wrapper = document.createElement("div");
    wrapper.className = "bi-hp-controls";
    wrapper.setAttribute("aria-label", "Hit points and HP adjustment");

    const fraction = document.createElement("div");
    fraction.className = "bi-hp-fraction";
    const slash = document.createElement("span");
    slash.className = "bi-hp-slash";
    slash.textContent = "/";
    slash.setAttribute("aria-hidden", "true");
    fraction.append(current, slash, max);

    const amount = document.createElement("div");
    amount.className = "bi-field";
    const amountLabel = document.createElement("label");
    amountLabel.textContent = "HP adjustment";
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
    subtract.title = "Subtract the adjustment from current HP";
    subtract.setAttribute("aria-label", "Subtract HP adjustment");

    const add = document.createElement("button");
    add.type = "button";
    add.className = "btn btn-sm btn-outline-secondary";
    add.textContent = "+";
    add.title = "Add the adjustment to current HP";
    add.setAttribute("aria-label", "Add HP adjustment");

    subtract.onclick = () => applyAdjustment(current, max, amountInput, -1);
    add.onclick = () => applyAdjustment(current, max, amountInput, 1);

    const adjust = document.createElement("div");
    adjust.className = "bi-hp-adjust";
    adjust.append(amount, subtract, add);

    wrapper.append(fraction, adjust);
    return wrapper;
}

function applyAdjustment(currentField: HTMLElement, maxField: HTMLElement, amountInput: HTMLInputElement, direction: -1 | 1): void {
    const currentInput = currentField.querySelector<HTMLInputElement>("input[type='number']");
    const maxInput = maxField.querySelector<HTMLInputElement>("input[type='number']");
    if (!currentInput) return;

    const amount = Math.max(0, Number(amountInput.value) || 0);
    const current = Number(currentInput.value);
    const fallbackMax = Number(maxInput?.value ?? "");
    const base = Number.isFinite(current) ? current : Number.isFinite(fallbackMax) ? fallbackMax : 0;
    let next = direction < 0 ? Math.max(0, base - amount) : base + amount;

    if (direction > 0 && Number.isFinite(fallbackMax) && (maxInput?.value ?? "").trim() !== "") {
        next = Math.min(next, fallbackMax);
    }

    currentInput.value = String(next);
    currentInput.dispatchEvent(new Event("change", { bubbles: true }));
}

function findField(fields: HTMLElement[], labelText: string): HTMLElement | undefined {
    return fields.find(field => field.querySelector("label")?.textContent?.trim() === labelText);
}

function renameLabel(field: HTMLElement, text: string): void {
    const label = field.querySelector("label");
    if (label && label.textContent !== text) label.textContent = text;
}
