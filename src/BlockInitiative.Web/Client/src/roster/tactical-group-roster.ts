import type {
    TacticalGroupInitiativeMode
} from "../api";
import type {
    MonsterTemplate
} from "../integrations/rules-core/monsters";

export type TacticalGroupRosterCallbacks = {
    addEnemyToGroup: (
        group: HTMLElement,
        template: MonsterTemplate | null,
        focus: boolean
    ) => HTMLElement;
    removeMonsterCard: (card: HTMLElement) => void;
    refreshControllers: () => void;
    changed: () => void;
    clonePrimaryMonster: (group: HTMLElement) => void;
    commonTemplate: (
        members: readonly HTMLElement[]
    ) => MonsterTemplate | null;
};

export class TacticalGroupRosterService {
    private readonly enemyGroups: HTMLElement;
    private readonly enemyMethod: HTMLSelectElement;
    private readonly enemyMethodHelp: HTMLElement;

    public constructor(
        private readonly shell: HTMLElement,
        private readonly callbacks: TacticalGroupRosterCallbacks
    ) {
        this.enemyGroups =
            query("[data-role='enemy-groups']", shell);
        this.enemyMethod =
            query("[data-role='enemy-method']", shell);
        this.enemyMethodHelp =
            query("[data-role='enemy-method-help']", shell);
    }

    public initialize(): void {
        query<HTMLButtonElement>(
            "[data-action='add-group']",
            this.shell).onclick =
            () => this.addTacticalGroup(true);

        this.enemyMethod.onchange = () => {
            this.updateEnemyMethodUi();
            this.callbacks.changed();
        };

        this.addTacticalGroup(false, true);
        this.updateEnemyMethodUi();
    }

    public currentMode():
        TacticalGroupInitiativeMode {
        return this.enemyMethod.value === "individual"
            || this.enemyMethod.value === "shared"
            ? this.enemyMethod.value
            : "average";
    }

    public groupName(groupId: string): string {
        const group = Array.from(
            this.shell.querySelectorAll<HTMLElement>(
                ".bi-tactical-group"))
            .find(candidate =>
                candidate.dataset.groupId === groupId);

        return group
            ? group.querySelector<HTMLInputElement>(
                "[data-role='group-name']")
                ?.value.trim()
                || "Group"
            : "Group";
    }

    public updateGroupModeUi(
        group: HTMLElement
    ): void {
        const mode = this.currentMode();
        const shared =
            group.querySelector<HTMLElement>(
                "[data-role='shared-roll-wrap']");

        if (shared) {
            shared.hidden = mode !== "shared";
        }

        for (const card of group
            .querySelectorAll<HTMLElement>(
                ".bi-entry[data-id]")) {
            query<HTMLElement>(
                "[data-role='initiative-wrap']",
                card).hidden =
                mode === "shared";
        }
    }

    public updateGroupSummary(
        group: HTMLElement
    ): void {
        const members = Array.from(
            group.querySelectorAll<HTMLElement>(
                ".bi-entry[data-id]"));
        const summary =
            query<HTMLElement>(
                "[data-role='group-summary']",
                group);
        const mode = this.currentMode();

        let placement: string;
        if (mode === "individual") {
            placement = "individual placement";
        } else if (mode === "shared") {
            const shared =
                group.querySelector<HTMLInputElement>(
                    "[data-role='shared-roll']");
            const raw =
                shared?.value.trim() ?? "";
            placement = raw
                ? `group initiative ${raw}`
                : "group initiative not entered";
        } else {
            const values = members
                .map(card =>
                    Number(
                        card.querySelector<HTMLInputElement>(
                            "[data-field='initiative']")
                            ?.value
                        ?? NaN))
                .filter(Number.isFinite);

            placement =
                values.length === members.length
                && values.length > 0
                    ? `group initiative ${formatNumber(
                        values.reduce(
                            (sum, value) => sum + value,
                            0
                        ) / values.length
                    )}`
                    : "not rolled";
        }

        const generic =
            group.classList.contains(
                "bi-other-side-block");
        const noun = generic
            ? members.length === 1
                ? "creature"
                : "creatures"
            : members.length === 1
                ? "enemy"
                : "enemies";

        summary.textContent =
            `${members.length} ${noun} · ${placement}`;

        const cloneButton =
            group.querySelector<HTMLButtonElement>(
                "[data-action='clone-primary']");
        const commonTemplate =
            this.callbacks.commonTemplate(members);

        if (!cloneButton) return;

        cloneButton.hidden = !commonTemplate;
        if (commonTemplate) {
            cloneButton.textContent =
                `+ Another ${commonTemplate.name}`;
        }
    }

    private addTacticalGroup(
        focus = true,
        addInitialMember = false
    ): HTMLElement {
        const group = document.createElement("section");
        group.className = "bi-tactical-group";
        group.dataset.groupId = crypto.randomUUID();
        group.innerHTML = `
<div class="bi-group-head">
  <div><input class="bi-group-name" data-role="group-name" value="Enemy Group"><div class="bi-group-summary" data-role="group-summary"></div></div>
  <div class="bi-badges"><div class="bi-field bi-group-roll" data-role="shared-roll-wrap"><label>Group initiative</label><input type="number" step="any" data-role="shared-roll" placeholder="e.g. 14"></div><button class="btn btn-sm btn-outline-secondary" data-action="clone-primary" hidden></button><button class="btn btn-sm btn-outline-danger" data-action="remove-group">Remove group</button></div>
</div>
<div class="bi-group-body"><div class="bi-list" data-role="group-members"></div><button class="btn btn-sm btn-outline-secondary" data-action="add-member">+ Different enemy</button></div>`;

        const nameInput =
            query<HTMLInputElement>(
                "[data-role='group-name']",
                group);
        nameInput.value =
            `Enemy Group ${this.enemyGroups.querySelectorAll(".bi-tactical-group").length + 1}`;
        nameInput.addEventListener(
            "input",
            () => this.callbacks.changed());

        query<HTMLInputElement>(
            "[data-role='shared-roll']",
            group)
            .addEventListener("input", () => {
                this.updateGroupSummary(group);
                this.callbacks.changed();
            });

        query<HTMLButtonElement>(
            "[data-action='add-member']",
            group).onclick =
            () => this.callbacks.addEnemyToGroup(
                group,
                null,
                true);

        query<HTMLButtonElement>(
            "[data-action='remove-group']",
            group).onclick = () => {
                for (const card of group
                    .querySelectorAll<HTMLElement>(
                        ".bi-entry[data-id]")) {
                    this.callbacks.removeMonsterCard(card);
                }

                group.remove();
                this.callbacks.refreshControllers();
                this.callbacks.changed();
            };

        query<HTMLButtonElement>(
            "[data-action='clone-primary']",
            group).onclick =
            () => this.callbacks
                .clonePrimaryMonster(group);

        this.enemyGroups.append(group);

        if (addInitialMember) {
            this.callbacks.addEnemyToGroup(
                group,
                null,
                false);
        }

        this.updateGroupModeUi(group);
        this.updateGroupSummary(group);
        this.callbacks.changed();

        if (focus) nameInput.focus();
        return group;
    }

    private updateEnemyMethodUi(): void {
        const mode = this.currentMode();

        this.enemyMethodHelp.textContent =
            mode === "average"
                ? "Grouped non-player blocks use a calculated initiative. "
                    + "Roll average rolls every member separately with its own modifier; "
                    + "Single roll uses one d20 plus the group's highest modifier."
                : mode === "shared"
                    ? "Roll once for each tactical group."
                    : "Every non-player creature uses its own roll; turn blocks are "
                        + "still derived afterward from side and placement.";

        for (const group of this.enemyGroups
            .querySelectorAll<HTMLElement>(
                ".bi-tactical-group")) {
            this.updateGroupModeUi(group);
            this.updateGroupSummary(group);
        }
    }
}

function query<T extends Element>(
    selector: string,
    scope: ParentNode
): T {
    const element = scope.querySelector(selector);
    if (!(element instanceof Element)) {
        throw new Error(`Missing ${selector}`);
    }
    return element as T;
}

function formatNumber(value: number): string {
    return Number.isInteger(value)
        ? String(value)
        : value.toFixed(2)
            .replace(/0+$/, "")
            .replace(/\.$/, "");
}
