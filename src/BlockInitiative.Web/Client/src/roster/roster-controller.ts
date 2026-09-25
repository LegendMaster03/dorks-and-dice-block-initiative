import {
    createBadge,
    formatNumber,
    friendlyAlliance
} from "../application/presentation";
import type {
    InitiativeCombatantInput,
    TacticalGroupInitiativeMode,
    TurnBlockType
} from "../api";
import type { MonsterTemplate } from "../integrations/rules-core/monsters";
import type { HexCrawlHandoffCombatant } from "../integrations/hex-crawl-handoff";
import {
    applyNumberLimits,
    describeNumberRange,
    INITIATIVE_LIMITS,
    isBoundedNumber,
    parseBoundedNumber
} from "../numeric-input-limits";
import { controllerRelationshipError } from "./controller-relationships";
import { MonsterRosterService } from "./monster-roster";
import { TacticalGroupRosterService } from "./tactical-group-roster";

type CombatantBlockType = Exclude<TurnBlockType, "mixed">;

export type RosterReadinessContext = {
    connected: boolean;
    busy: boolean;
    editing: boolean;
};

export type RosterControllerOptions = {
    shell: HTMLElement;
    onChanged: () => void;
    showError: (error: unknown) => void;
};

export class RosterController {
    private readonly players: HTMLElement;
    private readonly kaijuList: HTMLElement;
    private readonly others: HTMLElement;
    private readonly status: HTMLElement;
    private readonly previewButton: HTMLButtonElement;
    private readonly monsters: MonsterRosterService;
    private readonly groups: TacticalGroupRosterService;

    public constructor(
        private readonly options: RosterControllerOptions
    ) {
        this.players =
            this.query("[data-role='players']");
        this.kaijuList =
            this.query("[data-role='kaiju-list']");
        this.others =
            this.query("[data-role='others']");
        this.status =
            this.query("[data-role='setup-status']");
        this.previewButton =
            this.query("[data-action='preview']");

        this.monsters = new MonsterRosterService({
            addEnemyToGroup:
                (group, template, focus) =>
                    this.addEnemyToGroup(
                        group,
                        template,
                        focus),
            updateGroupSummary:
                group => this.groups.updateGroupSummary(group),
            refreshControllers:
                () => this.refreshControllers(),
            changed:
                () => this.changed(),
            showError: options.showError
        });

        this.groups = new TacticalGroupRosterService(
            options.shell,
            {
                addEnemyToGroup:
                    (group, template, focus) =>
                        this.addEnemyToGroup(
                            group,
                            template,
                            focus),
                removeMonsterCard:
                    card => this.monsters.removeCard(card),
                refreshControllers:
                    () => this.refreshControllers(),
                changed:
                    () => this.changed(),
                clonePrimaryMonster:
                    group => this.monsters
                        .clonePrimaryMonster(group),
                commonTemplate:
                    members => this.monsters
                        .commonTemplate(members)
            });
    }

    public initialize(): void {
        this.query<HTMLButtonElement>(
            "[data-action='add-player']").onclick =
            () => this.addCombatant("players");

        this.query<HTMLButtonElement>(
            "[data-action='add-kaiju']").onclick =
            () => this.addKaiju();

        this.query<HTMLButtonElement>(
            "[data-action='add-other']").onclick =
            () => this.addCombatant("other");

        this.addCombatant(
            "players",
            "standard",
            false);
        this.groups.initialize();
    }

    public importHandoffCombatants(
        combatants: readonly HexCrawlHandoffCombatant[]
    ): void {
        for (const imported of combatants) {
            for (let copy = 0; copy < imported.quantity; copy++) {
                const card = this.emptyCard(imported.side)
                    ?? (imported.side === "players"
                        ? this.addCombatant("players", "standard", false)
                        : this.addEnemyToGroup(
                            this.query<HTMLElement>(".bi-tactical-group"),
                            null,
                            false));

                this.field<HTMLInputElement>(card, "name").value =
                    imported.quantity > 1
                        ? `${imported.name} ${copy + 1}`
                        : imported.name;
                if (imported.initiativeModifier !== null) {
                    this.field<HTMLInputElement>(card, "modifier").value =
                        String(imported.initiativeModifier);
                }
                if (imported.rulesCoreConceptKey) {
                    this.field<HTMLInputElement>(card, "rules-reference").value =
                        `rule:${imported.rulesCoreConceptKey}`;
                }
                card.dataset.autoName = "false";
                this.updateBadges(card);
            }
        }

        this.refreshControllers();
        this.changed();
    }

    private emptyCard(side: "players" | "enemies"): HTMLElement | null {
        return this.cards().find(card =>
            card.dataset.alliance === side
            && !this.field<HTMLInputElement>(card, "name").value.trim())
            ?? null;
    }

    public setRulesCoreSearchEnabled(
        enabled: boolean
    ): void {
        this.monsters.setSearchEnabled(enabled);
    }

    public currentGroupMode():
        TacticalGroupInitiativeMode {
        return this.groups.currentMode();
    }

    public groupName(groupId: string): string {
        return this.groups.groupName(groupId);
    }

    public updateReady(
        context: RosterReadinessContext
    ): void {
        const all = this.cards();
        const mode = this.currentGroupMode();
        let ready = all.length >= 2;

        for (const card of all) {
            const name =
                this.field<HTMLInputElement>(
                    card,
                    "name").value.trim();

            if (!name || !this.alliance(card)) {
                ready = false;
            }

            const group =
                card.closest<HTMLElement>(
                    ".bi-tactical-group");
            const usesShared =
                mode === "shared"
                && Boolean(group)
                && card.dataset.alliance === "enemies"
                && this.type(card) === "standard";
            const shared =
                group?.querySelector<HTMLInputElement>(
                    "[data-role='shared-roll']");
            const initiative =
                usesShared && shared
                    ? shared.value.trim()
                    : this.field<HTMLInputElement>(
                        card,
                        "initiative").value.trim();

            if (!initiative
                || !isBoundedNumber(initiative, INITIATIVE_LIMITS)) {
                ready = false;
            }
        }

        const controllerError =
            controllerRelationshipError(
                all.map(card => ({
                    id: card.dataset.id ?? "",
                    name:
                        this.field<HTMLInputElement>(
                            card,
                            "name").value.trim(),
                    controllerId:
                        this.field<HTMLSelectElement>(
                            card,
                            "controller").value
                        || null
                })));
        if (controllerError) ready = false;

        this.status.textContent =
            !context.connected
                ? "Connecting to the initiative service…"
                : all.length < 2
                    ? "Add at least two combatants."
                    : controllerError
                        ?? (!ready
                            ? "Finish the name and initiative fields above."
                            : context.editing
                                ? "Ready to review changes and resume the running encounter."
                                : "Ready to build the initiative blocks.");

        this.previewButton.disabled =
            context.busy
            || !context.connected
            || !ready;
    }

    public collect(): InitiativeCombatantInput[] {
        const mode = this.currentGroupMode();

        const combatants =
            this.cards().map((card, index) => {
            const name =
                this.field<HTMLInputElement>(
                    card,
                    "name").value.trim();
            const allianceId =
                this.alliance(card);
            const group =
                card.closest<HTMLElement>(
                    ".bi-tactical-group");
            const usesShared =
                mode === "shared"
                && Boolean(group)
                && card.dataset.alliance === "enemies"
                && this.type(card) === "standard";
            const shared =
                group?.querySelector<HTMLInputElement>(
                    "[data-role='shared-roll']");
            const raw =
                usesShared && shared
                    ? shared.value.trim()
                    : this.field<HTMLInputElement>(
                        card,
                        "initiative").value.trim();
            const modifierRaw =
                this.field<HTMLInputElement>(
                    card,
                    "modifier").value.trim();

            if (!name) {
                throw new Error(
                    `Combatant ${index + 1} needs a name.`);
            }
            if (!allianceId) {
                throw new Error(
                    `${name} needs a side.`);
            }
            if (!raw) {
                throw new Error(
                    `Enter initiative for ${name}.`);
            }

            const initiativeTotal =
                parseBoundedNumber(raw, INITIATIVE_LIMITS);
            const initiativeModifier =
                modifierRaw
                    ? parseBoundedNumber(
                        modifierRaw,
                        INITIATIVE_LIMITS)
                    : null;

            if (initiativeTotal === null) {
                throw new Error(
                    `${name}'s initiative must be between ${describeNumberRange(INITIATIVE_LIMITS)}.`);
            }
            if (modifierRaw && initiativeModifier === null) {
                throw new Error(
                    `${name}'s initiative modifier must be between ${describeNumberRange(INITIATIVE_LIMITS)}.`);
            }

            return {
                id: card.dataset.id!,
                name,
                allianceId,
                initiativeTotal,
                initiativeModifier,
                controllerId:
                    this.field<HTMLSelectElement>(
                        card,
                        "controller").value
                    || null,
                tacticalGroupId:
                    this.tacticalGroupId(card),
                blockType: this.type(card)
            };
        });

        const controllerError =
            controllerRelationshipError(
                combatants);
        if (controllerError) {
            throw new Error(controllerError);
        }

        return combatants;
    }

    private addEnemyToGroup(
        group: HTMLElement,
        template: MonsterTemplate | null,
        focus = true
    ): HTMLElement {
        const card = this.addCombatant(
            "enemies",
            "standard",
            focus,
            this.query<HTMLElement>(
                "[data-role='group-members']",
                group));

        card.dataset.groupId =
            group.dataset.groupId ?? "";

        if (template) {
            this.monsters.applyTemplate(
                card,
                template,
                true);
        }

        this.groups.updateGroupModeUi(group);
        this.groups.updateGroupSummary(group);
        return card;
    }

    private addKaiju(): void {
        const card = this.addCombatant(
            "enemies",
            "kaiju",
            true,
            this.kaijuList);
        card.dataset.groupId = "";
    }

    private addCombatant(
        allianceId: string,
        blockType: CombatantBlockType = "standard",
        focus = true,
        target?: HTMLElement
    ): HTMLElement {
        const custom =
            allianceId !== "players"
            && allianceId !== "enemies";
        const destination =
            target
            ?? (
                allianceId === "players"
                    ? this.players
                    : allianceId === "enemies"
                        ? this.kaijuList
                        : this.others
            );

        const card = document.createElement("article");
        card.className = "bi-entry";
        card.dataset.id = crypto.randomUUID();
        card.dataset.alliance = allianceId;
        card.dataset.custom = String(custom);
        card.dataset.autoName = "false";
        card.innerHTML =
            `<div class="bi-entry-main ${custom ? "custom" : ""}"><div class="bi-field" data-role="name-field"><label>Name</label><input data-field="name" autocomplete="off" placeholder="${blockType === "kaiju" ? "Kaiju name" : allianceId === "players" ? "Player name" : "Start typing a monster name"}"><div class="bi-autocomplete" data-role="monster-results" hidden></div></div>${custom ? '<div class="bi-field"><label>Side</label><input data-field="custom-side" placeholder="e.g. neutral guards"></div>' : ""}<div class="bi-field" data-role="initiative-wrap"><label>Initiative</label><input data-field="initiative" type="number" step="any" placeholder="e.g. 17"></div><button class="btn btn-sm btn-outline-danger" data-action="remove">Remove</button></div><div class="bi-badges mt-2" data-role="badges"></div><div class="bi-monster-meta" data-role="monster-meta" hidden></div><div class="bi-template-actions" data-role="template-actions" hidden><button class="btn btn-sm btn-outline-secondary" data-action="clone-monster"></button></div><details><summary>Advanced options</summary><div class="bi-advanced"><div class="bi-field"><label>Special block type</label><select data-field="block-type"><option value="standard">Standard block</option><option value="kaiju">Kaiju block</option></select></div><div class="bi-field"><label>Acts with controller</label><select data-field="controller"><option value="">No controller</option></select></div><div class="bi-field"><label>Initiative modifier</label><input data-field="modifier" type="number" step="any" placeholder="Optional"></div><div class="bi-field"><label>Rules Core reference</label><input data-field="rules-reference" readonly placeholder="Manual entry"></div></div></details>`;

        applyNumberLimits(
            this.field<HTMLInputElement>(card, "initiative"),
            INITIATIVE_LIMITS);
        applyNumberLimits(
            this.field<HTMLInputElement>(card, "modifier"),
            INITIATIVE_LIMITS);

        this.field<HTMLSelectElement>(
            card,
            "block-type").value = blockType;

        this.query<HTMLButtonElement>(
            "[data-action='remove']",
            card).onclick = () => {
                const group =
                    card.closest<HTMLElement>(
                        ".bi-tactical-group");
                this.monsters.removeCard(card);
                card.remove();

                if (group) {
                    this.groups.updateGroupSummary(group);
                }

                this.refreshControllers();
                this.changed();
            };

        card.querySelectorAll<
            HTMLInputElement | HTMLSelectElement>(
                "input,select")
            .forEach(element =>
                element.addEventListener(
                    "input",
                    () => {
                        if (element.dataset.field === "name") {
                            card.dataset.autoName = "false";
                            this.refreshControllers();
                        }

                        this.updateBadges(card);
                        const group =
                            card.closest<HTMLElement>(
                                ".bi-tactical-group");
                        if (group) {
                            this.groups.updateGroupSummary(group);
                        }

                        this.changed();
                    }));

        this.field<HTMLSelectElement>(
            card,
            "block-type")
            .addEventListener("change", () => {
                const group =
                    card.closest<HTMLElement>(
                        ".bi-tactical-group");

                if (group
                    && card.dataset.alliance === "enemies"
                    && this.type(card) === "kaiju") {
                    card.dataset.groupId = "";
                    this.kaijuList.append(card);
                    this.groups.updateGroupSummary(group);
                }

                this.updateBadges(card);
                this.changed();
            });

        if (allianceId !== "players"
            && blockType === "standard") {
            this.monsters.attachAutocomplete(card);
        }

        destination.append(card);
        this.updateBadges(card);
        this.refreshControllers();
        this.changed();

        if (focus) {
            this.field<HTMLInputElement>(
                card,
                "name").focus();
        }

        return card;
    }

    private cards(): HTMLElement[] {
        return Array.from(
            this.options.shell
                .querySelectorAll<HTMLElement>(
                    ".bi-entry[data-id]"));
    }

    private alliance(card: HTMLElement): string {
        return card.dataset.custom === "true"
            ? this.field<HTMLInputElement>(
                card,
                "custom-side").value.trim()
            : card.dataset.alliance ?? "";
    }

    private type(card: HTMLElement):
        CombatantBlockType {
        return this.field<HTMLSelectElement>(
            card,
            "block-type").value === "kaiju"
            ? "kaiju"
            : "standard";
    }

    private tacticalGroupId(
        card: HTMLElement
    ): string | null {
        if (this.alliance(card) === "players"
            || this.type(card) !== "standard"
            || this.currentGroupMode() === "individual") {
            return null;
        }

        return card
            .closest<HTMLElement>(
                ".bi-tactical-group")
            ?.dataset.groupId
            || null;
    }

    private updateBadges(card: HTMLElement): void {
        const box = this.query<HTMLElement>(
            "[data-role='badges']",
            card);

        box.replaceChildren(
            createBadge(
                friendlyAlliance(
                    this.alliance(card)
                    || card.dataset.alliance
                    || "Other side")));

        if (this.type(card) === "kaiju") {
            box.append(
                createBadge("Kaiju", true));
        }

        const group =
            card.closest<HTMLElement>(
                ".bi-tactical-group");
        if (group) {
            box.append(
                createBadge(
                    group.querySelector<HTMLInputElement>(
                        "[data-role='group-name']")
                        ?.value
                    || "Group"));
        }
    }

    private refreshControllers(): void {
        const all = this.cards().map(card => ({
            id: card.dataset.id!,
            name:
                this.field<HTMLInputElement>(
                    card,
                    "name").value.trim()
        }));

        for (const card of this.cards()) {
            const select =
                this.field<HTMLSelectElement>(
                    card,
                    "controller");
            const previous = select.value;

            select.replaceChildren(
                new Option("No controller", ""));

            for (const candidate of all) {
                if (candidate.id
                    === card.dataset.id) {
                    continue;
                }

                select.add(
                    new Option(
                        candidate.name || "(unnamed)",
                        candidate.id));
            }

            if ([...select.options].some(
                option =>
                    option.value === previous)) {
                select.value = previous;
            }
        }
    }

    private changed(): void {
        this.options.onChanged();
    }

    private query<T extends Element>(
        selector: string,
        scope: ParentNode = this.options.shell
    ): T {
        const element =
            scope.querySelector(selector);
        if (!(element instanceof Element)) {
            throw new Error(
                `Missing ${selector}`);
        }
        return element as T;
    }

    private field<T extends HTMLElement>(
        card: HTMLElement,
        name: string
    ): T {
        const element =
            card.querySelector(
                `[data-field='${name}']`);
        if (!(element instanceof HTMLElement)) {
            throw new Error(
                `Missing ${name}`);
        }
        return element as T;
    }
}
