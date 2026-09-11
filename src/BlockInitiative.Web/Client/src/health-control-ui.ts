export function initializeHealthControlUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement)) return;

    installStyles(root);
    const observer = new MutationObserver(() => enhance(root));
    observer.observe(root, { childList: true, subtree: true });
    enhance(root);
}

function installStyles(root: HTMLElement): void {
    if (root.querySelector("style[data-role='health-control-ui-style']")) return;
    const style = document.createElement("style");
    style.dataset.role = "health-control-ui-style";
    style.textContent = `
.block-initiative-app .bi-hp-controls{display:flex;gap:.75rem;align-items:end;flex-wrap:wrap;margin-top:.45rem}
.block-initiative-app .bi-hp-fraction,.block-initiative-app .bi-hp-adjust{display:flex;gap:.35rem;align-items:end}
.block-initiative-app .bi-hp-fraction>.bi-field{min-width:5.5rem;max-width:7rem}
.block-initiative-app .bi-hp-slash{font-size:1.35rem;line-height:2.1rem;font-weight:600;opacity:.72}
.block-initiative-app .bi-hp-adjust>.bi-field{min-width:5.5rem;max-width:7rem}
.block-initiative-app .bi-hp-adjust .btn{min-width:2.4rem;font-size:1.05rem;font-weight:700}
`;
    root.prepend(style);
}

function enhance(root: HTMLElement): void {
    for (const row of root.querySelectorAll<HTMLElement>(".bi-health-row")) enhanceHealthRow(row);
}

function enhanceHealthRow(row: HTMLElement): void {
    if (row.dataset.compactHealthReady === "true") return;
    const controls = row.querySelector<HTMLElement>(".bi-combat-controls");
    if (!controls) return;

    const fields = Array.from(controls.querySelectorAll<HTMLElement>(":scope > .bi-field"));
    const current = fields.find(field => field.querySelector("label")?.textContent?.trim() === "Current HP");
    const max = fields.find(field => field.querySelector("label")?.textContent?.trim() === "Max HP");
    const amount = fields.find(field => field !== current && field !== max);
    const buttons = Array.from(controls.querySelectorAll<HTMLButtonElement>(":scope > button"));
    const damage = buttons.find(button => button.textContent?.trim() === "Damage");
    const heal = buttons.find(button => button.textContent?.trim() === "Heal");
    if (!current || !max || !amount || !damage || !heal) return;

    row.dataset.compactHealthReady = "true";
    const currentLabel = current.querySelector("label");
    const maxLabel = max.querySelector("label");
    const amountLabel = amount.querySelector("label");
    if (currentLabel) currentLabel.textContent = "Current";
    if (maxLabel) maxLabel.textContent = "Max";
    if (amountLabel) amountLabel.textContent = "Adjust";

    const wrapper = document.createElement("div");
    wrapper.className = "bi-hp-controls";

    const fraction = document.createElement("div");
    fraction.className = "bi-hp-fraction";
    const slash = document.createElement("span");
    slash.className = "bi-hp-slash";
    slash.textContent = "/";
    fraction.append(current, slash, max);

    const adjust = document.createElement("div");
    adjust.className = "bi-hp-adjust";
    damage.textContent = "−";
    damage.title = "Subtract the adjustment from current HP";
    heal.textContent = "+";
    heal.title = "Add the adjustment to current HP";
    adjust.append(amount, damage, heal);

    wrapper.append(fraction, adjust);
    controls.replaceWith(wrapper);
}
