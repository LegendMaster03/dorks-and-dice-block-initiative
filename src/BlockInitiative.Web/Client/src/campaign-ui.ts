import { charactersMissingFromEncounter } from "./campaign-roster";
import {
    loadToolHostCampaignContext,
    loadToolHostCampaigns,
    loadToolHostContext
} from "./host";
import type {
    ToolHostCampaignContext,
    ToolHostCampaignSummary,
    ToolHostContext
} from "./host";
import { requestEnhancement } from "./render-lifecycle";

let initialized = false;

export function initializeCampaignUi(): void {
    if (initialized) return;

    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement)) return;
    const appRoot: HTMLElement = root;
    initialized = true;

    const contextUrl = appRoot.dataset.toolContextUrl;
    if (!contextUrl) return;

    const setup = appRoot.querySelector<HTMLElement>("[data-role='setup']");
    const sides = setup?.querySelector<HTMLElement>(".bi-sides");
    if (!setup || !sides) return;

    installStyles(appRoot);

    const panel = document.createElement("section");
    panel.className = "bi-campaign-panel";
    panel.hidden = true;
    panel.innerHTML = `
<div class="bi-campaign-copy">
  <strong>Campaign</strong>
  <div class="bi-muted">Optional. Load active characters from a Dorks & Dice campaign while keeping manual encounter setup available.</div>
</div>
<div class="bi-campaign-controls">
  <div class="bi-field">
    <label for="bi-campaign-select">Campaign context</label>
    <select id="bi-campaign-select" data-role="campaign-select" disabled>
      <option value="">Manual encounter</option>
    </select>
  </div>
  <button class="btn btn-outline-primary" type="button" data-action="import-campaign-characters" disabled>Add campaign characters</button>
</div>
<div class="bi-muted bi-campaign-status" data-role="campaign-status">Checking signed-in campaign access…</div>`;
    setup.insertBefore(panel, sides);

    const select = required<HTMLSelectElement>(panel, "[data-role='campaign-select']");
    const importButton = required<HTMLButtonElement>(panel, "[data-action='import-campaign-characters']");
    const status = required<HTMLElement>(panel, "[data-role='campaign-status']");

    let hostContext: ToolHostContext | null = null;
    let campaignContext: ToolHostCampaignContext | null = null;
    let campaignSummaries: ToolHostCampaignSummary[] = [];
    let campaignRequestSequence = 0;

    select.addEventListener("change", () => {
        void selectCampaign(select.value);
    });
    importButton.addEventListener("click", () => {
        if (!campaignContext) return;
        const added = importCampaignCharacters(appRoot, campaignContext);
        status.textContent = added === 0
            ? "All active campaign-linked characters are already represented in this encounter."
            : `Added ${added} campaign character${added === 1 ? "" : "s"} to the player roster.`;
    });

    void initializeHostedCampaigns();

    async function initializeHostedCampaigns(): Promise<void> {
        try {
            hostContext = await loadToolHostContext(contextUrl!);
            if (!hostContext.user) {
                panel.remove();
                return;
            }

            panel.hidden = false;
            campaignSummaries = await loadToolHostCampaigns(hostContext);
            populateCampaignOptions(select, campaignSummaries);
            select.disabled = false;
            status.textContent = campaignSummaries.length === 0
                ? "This account has no active campaigns. Manual encounter setup remains available."
                : `${campaignSummaries.length} active campaign${campaignSummaries.length === 1 ? " is" : "s are"} available.`;
        } catch (error) {
            if (panel.hidden) return;
            status.textContent = campaignErrorMessage(error);
            select.disabled = true;
        }
    }

    async function selectCampaign(campaignId: string): Promise<void> {
        const requestSequence = ++campaignRequestSequence;

        if (!campaignId) {
            campaignContext = null;
            importButton.disabled = true;
            delete appRoot.dataset.campaignId;
            dispatchCampaignChange(appRoot, null);
            status.textContent = "Manual encounter selected. Campaign data will not be added automatically.";
            return;
        }

        if (!hostContext?.user) return;
        select.disabled = true;
        importButton.disabled = true;
        status.textContent = "Loading campaign roster…";

        try {
            const loaded = await loadToolHostCampaignContext(hostContext, campaignId);
            if (requestSequence !== campaignRequestSequence || select.value !== campaignId) return;

            campaignContext = loaded;
            appRoot.dataset.campaignId = loaded.campaignId;
            importButton.disabled = loaded.characters.length === 0;
            dispatchCampaignChange(appRoot, loaded);

            const roles = loaded.requestingUserRoles.length > 0
                ? loaded.requestingUserRoles.join(", ")
                : "member";
            const characterLabel = `${loaded.characters.length} linked character${loaded.characters.length === 1 ? "" : "s"}`;
            const participantLabel = `${loaded.participants.length} active participant${loaded.participants.length === 1 ? "" : "s"}`;
            status.textContent = `${loaded.name}: ${characterLabel}; ${participantLabel}. Your campaign role${loaded.requestingUserRoles.length === 1 ? "" : "s"}: ${roles}.`;
        } catch (error) {
            if (requestSequence !== campaignRequestSequence) return;
            campaignContext = null;
            delete appRoot.dataset.campaignId;
            dispatchCampaignChange(appRoot, null);
            status.textContent = campaignErrorMessage(error);
        } finally {
            if (requestSequence === campaignRequestSequence) {
                select.disabled = false;
            }
        }
    }
}

function populateCampaignOptions(
    select: HTMLSelectElement,
    campaigns: readonly ToolHostCampaignSummary[]
): void {
    const manual = select.options[0] ?? new Option("Manual encounter", "");
    select.replaceChildren(manual);

    for (const campaign of campaigns) {
        const option = document.createElement("option");
        option.value = campaign.id;
        option.textContent = `${campaign.name} (${campaign.role})`;
        select.append(option);
    }
}

function importCampaignCharacters(
    root: HTMLElement,
    campaign: ToolHostCampaignContext
): number {
    const playerContainer = root.querySelector<HTMLElement>("[data-role='players']");
    const addPlayerButton = root.querySelector<HTMLButtonElement>("[data-action='add-player']");
    if (!playerContainer || !addPlayerButton) return 0;

    const existing = playerCards(playerContainer).map(card => ({
        campaignCharacterId: card.dataset.campaignCharacterId ?? null,
        name: nameInput(card)?.value ?? ""
    }));
    const missing = charactersMissingFromEncounter(existing, campaign.characters);
    let added = 0;

    for (const character of missing) {
        let card = firstBlankPlayerCard(playerContainer);
        if (!card) {
            addPlayerButton.click();
            card = playerCards(playerContainer).at(-1) ?? null;
        }
        if (!card) continue;

        const input = nameInput(card);
        if (!input) continue;

        card.dataset.campaignCharacterId = character.characterId;
        card.dataset.campaignId = campaign.campaignId;
        input.value = character.name;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        added++;
    }

    if (added > 0) requestEnhancement();
    return added;
}

function playerCards(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(".bi-entry"));
}

function firstBlankPlayerCard(container: HTMLElement): HTMLElement | null {
    return playerCards(container).find(card => {
        const input = nameInput(card);
        return !card.dataset.campaignCharacterId && Boolean(input) && !input!.value.trim();
    }) ?? null;
}

function nameInput(card: HTMLElement): HTMLInputElement | null {
    return card.querySelector<HTMLInputElement>("input[data-field='name']");
}

function dispatchCampaignChange(
    root: HTMLElement,
    context: ToolHostCampaignContext | null
): void {
    root.dispatchEvent(new CustomEvent("block-initiative:campaign-change", {
        detail: context
    }));
}

function campaignErrorMessage(error: unknown): string {
    const detail = error instanceof Error ? error.message : String(error);
    return `Campaign data is unavailable (${detail}). Manual encounter setup is still available.`;
}

function required<T extends Element>(scope: ParentNode, selector: string): T {
    const element = scope.querySelector(selector);
    if (!(element instanceof Element)) throw new Error(`Missing ${selector}`);
    return element as T;
}

function installStyles(root: HTMLElement): void {
    if (root.querySelector("style[data-bi-campaign-styles]")) return;

    const style = document.createElement("style");
    style.dataset.biCampaignStyles = "true";
    style.textContent = `
.block-initiative-app .bi-campaign-panel{display:grid;grid-template-columns:minmax(12rem,.75fr) minmax(18rem,1.25fr);gap:.75rem 1rem;align-items:end;padding:.75rem;border:1px solid var(--bi-border);border-radius:.65rem;background:var(--bi-soft)}
.block-initiative-app .bi-campaign-panel[hidden]{display:none!important}
.block-initiative-app .bi-campaign-copy{align-self:start}.block-initiative-app .bi-campaign-controls{display:grid;grid-template-columns:minmax(12rem,1fr) auto;gap:.6rem;align-items:end}.block-initiative-app .bi-campaign-status{grid-column:1/-1}
@media(max-width:800px){.block-initiative-app .bi-campaign-panel,.block-initiative-app .bi-campaign-controls{grid-template-columns:1fr}}
`;
    root.prepend(style);
}
