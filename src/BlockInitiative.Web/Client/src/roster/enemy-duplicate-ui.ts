import { afterNextEnhancement, registerAfterRender, requestEnhancement } from "../render-lifecycle";

let initialized = false;

export function initializeEnemyDuplicateUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    installStyles(root.ownerDocument);
    registerAfterRender("enemy-duplicate", 70, () => enhance(root));
}

function installStyles(documentRef: Document): void {
    if (documentRef.head.querySelector("style[data-role='enemy-duplicate-ui-style']")) return;
    const style = documentRef.createElement("style");
    style.dataset.role = "enemy-duplicate-ui-style";
    style.textContent = `
.block-initiative-app .bi-enemy-add-actions{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;justify-content:flex-start}
.block-initiative-app .bi-enemy-add-actions[hidden]{display:none!important}
.block-initiative-app .bi-duplicate-actions{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap}
.block-initiative-app .bi-enemy-add-actions>.btn,.block-initiative-app .bi-duplicate-actions>.btn{width:auto!important;padding:.22rem .5rem;white-space:nowrap}
.block-initiative-app .bi-template-actions{display:none!important}
.block-initiative-app [data-action='clone-primary']{display:none!important}
`;
    documentRef.head.append(style);
}

function schedule(_root: HTMLElement): void {
    requestEnhancement();
}

function scheduleToolRoot(): void {
    requestEnhancement();
}

function enhance(root: HTMLElement): void {
    const method = root.querySelector<HTMLSelectElement>("[data-role='enemy-method']");
    const grouped = method?.value !== "individual";

    for (const group of root.querySelectorAll<HTMLElement>(".bi-tactical-group")) {
        const clonePrimary = group.querySelector<HTMLButtonElement>("[data-action='clone-primary']");
        if (clonePrimary && !clonePrimary.hidden) clonePrimary.hidden = true;

        const body = group.querySelector<HTMLElement>(":scope > .bi-group-body");
        const addDifferent = body?.querySelector<HTMLButtonElement>("[data-action='add-member']");
        if (!body || !addDifferent) continue;

        let actions = body.querySelector<HTMLElement>(":scope > .bi-enemy-add-actions");
        let duplicateActions: HTMLElement;
        if (!actions) {
            actions = document.createElement("div");
            actions.className = "bi-enemy-add-actions";
            duplicateActions = document.createElement("div");
            duplicateActions.className = "bi-duplicate-actions";
            duplicateActions.dataset.role = "duplicate-actions";
            actions.append(addDifferent, duplicateActions);
            body.append(actions);
        } else {
            duplicateActions = actions.querySelector<HTMLElement>("[data-role='duplicate-actions']") ?? document.createElement("div");
            if (!duplicateActions.parentElement) {
                duplicateActions.className = "bi-duplicate-actions";
                duplicateActions.dataset.role = "duplicate-actions";
                actions.append(duplicateActions);
            }
        }

        const shouldHideActions = !grouped;
        if (actions.hidden !== shouldHideActions) actions.hidden = shouldHideActions;
        if (grouped) renderDuplicateButtons(group, duplicateActions);

        for (const card of group.querySelectorAll<HTMLElement>("[data-role='group-members'] .bi-entry[data-id]")) {
            const templateActions = card.querySelector<HTMLElement>("[data-role='template-actions']");
            if (templateActions && !templateActions.hidden) templateActions.hidden = true;
        }
    }
}

type DuplicateCandidate = {
    key: string;
    baseName: string;
    source: HTMLElement;
};

function renderDuplicateButtons(group: HTMLElement, container: HTMLElement): void {
    const candidates = duplicateCandidates(group);
    const signature = candidates.map(candidate => `${candidate.key}:${candidate.baseName}`).join("|");
    if (container.dataset.signature === signature) return;
    container.dataset.signature = signature;
    container.replaceChildren();

    for (const candidate of candidates) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-sm btn-outline-secondary";
        button.textContent = `+ Another ${candidate.baseName}`;
        button.title = `Add another ${candidate.baseName} to this tactical group.`;
        button.onclick = () => duplicateEnemy(group, candidate.source);
        container.append(button);
    }
}

function duplicateCandidates(group: HTMLElement): DuplicateCandidate[] {
    const result: DuplicateCandidate[] = [];
    const seen = new Set<string>();

    for (const card of group.querySelectorAll<HTMLElement>("[data-role='group-members'] .bi-entry[data-id]")) {
        const name = card.querySelector<HTMLInputElement>("[data-field='name']")?.value.trim() ?? "";
        if (!name) continue;

        const templateId = card.dataset.templateId?.trim();
        const manualKey = card.dataset.manualDuplicateKey?.trim();
        const originalClone = card.querySelector<HTMLButtonElement>("[data-action='clone-monster']");
        const templateBase = originalClone?.textContent?.trim().replace(/^\+ Another\s+/, "") ?? "";
        const baseName = card.dataset.manualDuplicateBase?.trim() || templateBase || name;
        const key = templateId ? `template:${templateId}` : manualKey ? `manual:${manualKey}` : `card:${card.dataset.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ key, baseName, source: card });
    }

    return result;
}

function duplicateEnemy(group: HTMLElement, source: HTMLElement): void {
    const templateClone = source.querySelector<HTMLButtonElement>("[data-action='clone-monster']");
    if (source.dataset.templateId && templateClone?.onclick) {
        templateClone.click();
        scheduleToolRoot();
        return;
    }

    duplicateManualEnemy(group, source);
}

function duplicateManualEnemy(group: HTMLElement, source: HTMLElement): void {
    const nameInput = source.querySelector<HTMLInputElement>("[data-field='name']");
    const addDifferent = group.querySelector<HTMLButtonElement>("[data-action='add-member']");
    if (!nameInput || !addDifferent || !nameInput.value.trim()) return;

    let key = source.dataset.manualDuplicateKey;
    let baseName = source.dataset.manualDuplicateBase;
    if (!key || !baseName) {
        key = crypto.randomUUID();
        baseName = nameInput.value.trim();
        source.dataset.manualDuplicateKey = key;
        source.dataset.manualDuplicateBase = baseName;
        source.dataset.manualDuplicateIndex = "1";
        setInputValue(nameInput, `${baseName} 1`);
    }

    const membersBefore = new Set(
        Array.from(group.querySelectorAll<HTMLElement>("[data-role='group-members'] .bi-entry[data-id]"))
            .map(card => card.dataset.id)
            .filter((id): id is string => Boolean(id))
    );

    const usedIndexes = Array.from(group.querySelectorAll<HTMLElement>("[data-role='group-members'] .bi-entry[data-id]"))
        .filter(card => card.dataset.manualDuplicateKey === key)
        .map(card => Number(card.dataset.manualDuplicateIndex ?? 0))
        .filter(Number.isFinite);
    const nextIndex = Math.max(0, ...usedIndexes) + 1;

    addDifferent.click();

    const target = Array.from(group.querySelectorAll<HTMLElement>("[data-role='group-members'] .bi-entry[data-id]"))
        .find(card => Boolean(card.dataset.id) && !membersBefore.has(card.dataset.id!));
    if (!target) return;

    target.dataset.manualDuplicateKey = key;
    target.dataset.manualDuplicateBase = baseName;
    target.dataset.manualDuplicateIndex = String(nextIndex);

    const targetName = target.querySelector<HTMLInputElement>("[data-field='name']");
    if (targetName) setInputValue(targetName, `${baseName} ${nextIndex}`);

    const sourceModifier = source.querySelector<HTMLInputElement>("[data-field='modifier']");
    const targetModifier = target.querySelector<HTMLInputElement>("[data-field='modifier']");
    if (sourceModifier && targetModifier) setInputValue(targetModifier, sourceModifier.value);

    copyHealthWhenReady(source, target);
    scheduleToolRoot();
}

function copyHealthWhenReady(source: HTMLElement, target: HTMLElement): void {
    const copy = (): boolean => {
        const sourceCurrent = inputByLabel(source, "Current HP");
        const sourceMax = inputByLabel(source, "Max HP");
        const targetCurrent = inputByLabel(target, "Current HP");
        const targetMax = inputByLabel(target, "Max HP");
        if (!sourceCurrent || !sourceMax || !targetCurrent || !targetMax) return false;
        setInputValue(targetMax, sourceMax.value);
        setInputValue(
            targetCurrent,
            sourceMax.value || sourceCurrent.value);
        return true;
    };

    if (copy()) return;
    afterNextEnhancement(() => { copy(); });
}

function inputByLabel(scope: HTMLElement, labelText: string): HTMLInputElement | null {
    for (const label of scope.querySelectorAll<HTMLLabelElement>("label")) {
        if (label.textContent?.trim() !== labelText) continue;
        const field = label.closest<HTMLElement>(".bi-field");
        const input = field?.querySelector<HTMLInputElement>("input[type='number']");
        if (input) return input;
    }
    return null;
}

function setInputValue(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
}
