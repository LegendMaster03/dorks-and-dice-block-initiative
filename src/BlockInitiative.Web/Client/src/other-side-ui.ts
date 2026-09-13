import { registerAfterRender, requestEnhancement } from "./render-lifecycle";

let initialized = false;
let clickInstalled = false;

export function initializeOtherSideUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement) || initialized) return;
    initialized = true;

    installStyles(root.ownerDocument);
    installClickHandler(root);
    registerAfterRender("other-side-controls", 10, () => enhance(root));
}

function installStyles(documentRef: Document): void {
    if (documentRef.head.querySelector("style[data-role='other-side-ui-style']")) return;
    const style = documentRef.createElement("style");
    style.dataset.role = "other-side-ui-style";
    style.textContent = `
.block-initiative-app .bi-other-sides{display:grid;gap:.75rem;margin-top:.6rem}
.block-initiative-app .bi-other-side{border:1px solid var(--bi-border);border-radius:.65rem;overflow:visible}
.block-initiative-app .bi-other-side-head{display:flex;gap:.65rem;align-items:center;justify-content:space-between;padding:.6rem .7rem;background:var(--bi-soft);border-bottom:1px solid var(--bi-border)}
.block-initiative-app .bi-other-side-name{font-weight:700;max-width:20rem}
.block-initiative-app .bi-other-side-actions{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap}
.block-initiative-app .bi-other-side-blocks{display:grid;gap:.5rem;padding:.55rem .7rem}
.block-initiative-app .bi-other-side-block{border:0!important;border-top:1px solid var(--bi-border)!important;border-radius:0!important}
.block-initiative-app .bi-other-side-block:first-child{border-top:0!important}
.block-initiative-app .bi-other-side-block .bi-group-head{padding:.4rem 0!important;background:transparent!important;border-bottom:0!important}
.block-initiative-app .bi-other-side-block .bi-group-body{padding:.15rem 0 .35rem!important}
.block-initiative-app .bi-owned-side-field{display:none!important}
.block-initiative-app .bi-other-side-block[data-side-block-type='kaiju'] [data-role='group-roll-actions']{display:none!important}
`;
    documentRef.head.append(style);
}

function installClickHandler(root: HTMLElement): void {
    if (clickInstalled) return;
    clickInstalled = true;
    root.addEventListener("click", event => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const addSide = target.closest<HTMLButtonElement>("[data-action='add-other']");
        if (addSide) {
            event.preventDefault();
            event.stopImmediatePropagation();
            createSide(root, addSide);
            requestEnhancement();
            return;
        }

        const action = target.closest<HTMLButtonElement>("[data-side-action]");
        if (!action) return;
        const side = action.closest<HTMLElement>(".bi-other-side");
        if (!side) return;
        const sourceButton = root.querySelector<HTMLButtonElement>("[data-action='add-other']");
        if (!sourceButton) return;

        switch (action.dataset.sideAction) {
            case "add-standard-block":
                createBlock(root, side, sourceButton, "standard", true);
                break;
            case "add-kaiju-block":
                createBlock(root, side, sourceButton, "kaiju", true);
                break;
            case "add-member": {
                const block = action.closest<HTMLElement>(".bi-other-side-block");
                if (block) spawnMember(root, side, block, sourceButton, block.dataset.sideBlockType === "kaiju" ? "kaiju" : "standard", true);
                break;
            }
            case "remove-block": {
                const block = action.closest<HTMLElement>(".bi-other-side-block");
                if (block) removeBlock(block);
                break;
            }
            case "remove-side":
                for (const block of Array.from(side.querySelectorAll<HTMLElement>(".bi-other-side-block"))) removeBlock(block);
                side.remove();
                break;
        }
        requestEnhancement();
    }, true);
}

function schedule(_root: HTMLElement): void {
    requestEnhancement();
}

function enhance(root: HTMLElement): void {
    const addSide = root.querySelector<HTMLButtonElement>("[data-action='add-other']");
    const others = root.querySelector<HTMLElement>("[data-role='others']");
    if (!addSide || !others) return;

    if (addSide.textContent !== "+ Side") addSide.textContent = "+ Side";
    const title = "Add another initiative side with its own blocks.";
    if (addSide.title !== title) addSide.title = title;
    others.classList.add("bi-other-sides");

    const details = addSide.closest("details");
    const helper = details?.querySelector<HTMLElement>(".bi-row .bi-muted");
    if (helper && helper.textContent !== "Add another side, then add Standard or Kaiju blocks within it.") {
        helper.textContent = "Add another side, then add Standard or Kaiju blocks within it.";
    }

    // Migrate any legacy free-standing custom combatants into a single side so
    // an older in-progress setup does not keep treating every creature as a side.
    const loose = Array.from(others.children).filter((child): child is HTMLElement =>
        child instanceof HTMLElement && child.classList.contains("bi-entry"));
    if (loose.length) {
        const side = createSideShell(others, sideName(loose[0]) || "Other side");
        const sourceButton = addSide;
        const block = createBlockShell(side, "standard");
        const members = block.querySelector<HTMLElement>("[data-role='group-members']")!;
        for (const card of loose) {
            members.append(card);
            ownSideField(card, side);
        }
        wireBlock(block, root, side, sourceButton);
    }
}

function createSide(root: HTMLElement, sourceButton: HTMLButtonElement): HTMLElement {
    const others = root.querySelector<HTMLElement>("[data-role='others']");
    if (!others) throw new Error("Other-side roster is unavailable.");
    const count = others.querySelectorAll(":scope > .bi-other-side").length + 1;
    const side = createSideShell(others, `Other side ${count}`);
    createBlock(root, side, sourceButton, "standard", false);
    side.querySelector<HTMLInputElement>("[data-role='side-name']")?.focus();
    return side;
}

function createSideShell(others: HTMLElement, initialName: string): HTMLElement {
    const side = document.createElement("section");
    side.className = "bi-other-side";
    side.dataset.sideKey = crypto.randomUUID();
    side.innerHTML = `
<div class="bi-other-side-head">
  <div class="bi-field"><label>Side name</label><input class="bi-other-side-name" data-role="side-name"></div>
  <div class="bi-other-side-actions">
    <button type="button" class="btn btn-sm btn-outline-secondary" data-side-action="add-standard-block">+ Block</button>
    <button type="button" class="btn btn-sm btn-outline-secondary" data-side-action="add-kaiju-block">+ Kaiju block</button>
    <button type="button" class="btn btn-sm btn-outline-danger" data-side-action="remove-side">Remove side</button>
  </div>
</div>
<div class="bi-other-side-blocks" data-role="side-blocks"></div>`;
    const name = side.querySelector<HTMLInputElement>("[data-role='side-name']")!;
    name.value = initialName;
    name.addEventListener("input", () => updateSideIdentity(side));
    others.append(side);
    return side;
}

function createBlock(
    root: HTMLElement,
    side: HTMLElement,
    sourceButton: HTMLButtonElement,
    blockType: "standard" | "kaiju",
    focus: boolean
): HTMLElement {
    const block = createBlockShell(side, blockType);
    wireBlock(block, root, side, sourceButton);
    spawnMember(root, side, block, sourceButton, blockType, focus);
    return block;
}

function createBlockShell(side: HTMLElement, blockType: "standard" | "kaiju"): HTMLElement {
    const blocks = side.querySelector<HTMLElement>("[data-role='side-blocks']")!;
    const sameTypeCount = blocks.querySelectorAll(`:scope > .bi-other-side-block[data-side-block-type='${blockType}']`).length + 1;
    const block = document.createElement("section");
    block.className = "bi-tactical-group bi-other-side-block";
    block.dataset.groupId = crypto.randomUUID();
    block.dataset.sideBlockType = blockType;
    block.innerHTML = `
<div class="bi-group-head">
  <div><input class="bi-group-name" data-role="group-name"><div class="bi-group-summary" data-role="group-summary"></div></div>
  <div class="bi-badges"><button class="btn btn-sm btn-outline-secondary" data-action="clone-primary" hidden></button><button type="button" class="btn btn-sm btn-outline-danger" data-side-action="remove-block">Remove block</button></div>
</div>
<div class="bi-group-body"><div class="bi-list" data-role="group-members"></div><button type="button" class="btn btn-sm btn-outline-secondary" data-side-action="add-member">+ Creature</button></div>`;
    const name = block.querySelector<HTMLInputElement>("[data-role='group-name']")!;
    name.value = blockType === "kaiju" ? `Kaiju Block ${sameTypeCount}` : `Block ${sameTypeCount}`;
    blocks.append(block);
    return block;
}

function wireBlock(block: HTMLElement, root: HTMLElement, side: HTMLElement, sourceButton: HTMLButtonElement): void {
    block.querySelector<HTMLInputElement>("[data-role='group-name']")?.addEventListener("input", () => {
        for (const card of block.querySelectorAll<HTMLElement>(".bi-entry[data-id]")) {
            card.dispatchEvent(new Event("input", { bubbles: true }));
        }
    });
    updateSideIdentity(side);
    schedule(root);
}

function spawnMember(
    root: HTMLElement,
    side: HTMLElement,
    block: HTMLElement,
    sourceButton: HTMLButtonElement,
    blockType: "standard" | "kaiju",
    focus: boolean
): HTMLElement | null {
    const others = root.querySelector<HTMLElement>("[data-role='others']");
    const members = block.querySelector<HTMLElement>("[data-role='group-members']");
    if (!others || !members || !sourceButton.onclick) return null;

    const before = new Set(Array.from(others.querySelectorAll<HTMLElement>(".bi-entry[data-id]")).map(card => card.dataset.id));
    sourceButton.onclick.call(sourceButton, new PointerEvent("click"));
    const card = Array.from(others.querySelectorAll<HTMLElement>(".bi-entry[data-id]"))
        .find(candidate => Boolean(candidate.dataset.id) && !before.has(candidate.dataset.id));
    if (!card) return null;

    members.append(card);
    ownSideField(card, side);
    const type = card.querySelector<HTMLSelectElement>("[data-field='block-type']");
    if (type && type.value !== blockType) {
        type.value = blockType;
        type.dispatchEvent(new Event("change", { bubbles: true }));
    }
    card.dataset.groupId = block.dataset.groupId ?? "";
    updateSideIdentity(side);
    if (focus) card.querySelector<HTMLInputElement>("[data-field='name']")?.focus();
    schedule(root);
    return card;
}

function ownSideField(card: HTMLElement, side: HTMLElement): void {
    const input = card.querySelector<HTMLInputElement>("[data-field='custom-side']");
    if (!input) return;
    input.closest<HTMLElement>(".bi-field")?.classList.add("bi-owned-side-field");
    input.readOnly = true;
    setInput(input, side.querySelector<HTMLInputElement>("[data-role='side-name']")?.value.trim() || "Other side");
}

function updateSideIdentity(side: HTMLElement): void {
    const value = side.querySelector<HTMLInputElement>("[data-role='side-name']")?.value.trim() || "Other side";
    for (const input of side.querySelectorAll<HTMLInputElement>("[data-field='custom-side']")) {
        if (input.value !== value) setInput(input, value);
    }
}

function removeBlock(block: HTMLElement): void {
    for (const card of Array.from(block.querySelectorAll<HTMLElement>(".bi-entry[data-id]"))) {
        const remove = card.querySelector<HTMLButtonElement>("[data-action='remove']");
        if (remove) remove.click();
        else card.remove();
    }
    block.remove();
}

function sideName(card: HTMLElement): string {
    return card.querySelector<HTMLInputElement>("[data-field='custom-side']")?.value.trim() ?? "";
}

function setInput(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
}
