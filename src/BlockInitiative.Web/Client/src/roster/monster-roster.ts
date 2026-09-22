import {
    loadMonsterTemplate,
    searchRulesCoreMonsters
} from "../integrations/rules-core/monsters";
import type {
    MonsterSearchMatch,
    MonsterTemplate
} from "../integrations/rules-core/monsters";
import { formatSigned } from "../application/presentation";

export type MonsterRosterCallbacks = {
    addEnemyToGroup: (
        group: HTMLElement,
        template: MonsterTemplate,
        focus: boolean
    ) => HTMLElement;
    updateGroupSummary: (group: HTMLElement) => void;
    refreshControllers: () => void;
    changed: () => void;
    showError: (error: unknown) => void;
};

export class MonsterRosterService {
    private readonly templates = new Map<string, MonsterTemplate>();
    private searchSequence = 0;
    private searchEnabled = false;

    public constructor(
        private readonly callbacks: MonsterRosterCallbacks
    ) {
    }

    public setSearchEnabled(enabled: boolean): void {
        this.searchEnabled = enabled;
    }

    public attachAutocomplete(card: HTMLElement): void {
        const input = field<HTMLInputElement>(card, "name");
        const box = query<HTMLElement>(
            "[data-role='monster-results']",
            card);
        let timer: number | null = null;

        input.addEventListener("input", () => {
            const template =
                this.templates.get(card.dataset.id ?? "");
            if (template
                && input.value.trim()
                    !== this.renderedMonsterName(card, template)) {
                this.removeCard(card);
                this.clearMonsterMetadata(card);
            }

            if (timer !== null) window.clearTimeout(timer);

            box.hidden = true;
            box.replaceChildren();

            const queryText = input.value.trim();
            if (!this.searchEnabled || queryText.length < 2) {
                return;
            }

            const sequence = ++this.searchSequence;
            timer = window.setTimeout(
                () => void this.renderMonsterMatches(
                    card,
                    queryText,
                    sequence),
                180);
        });

        input.addEventListener("blur", () => {
            window.setTimeout(() => {
                box.hidden = true;
            }, 160);
        });
    }

    public applyTemplate(
        card: HTMLElement,
        template: MonsterTemplate,
        cloning: boolean
    ): void {
        const id = card.dataset.id ?? "";
        this.templates.set(id, template);
        card.dataset.templateId = template.match.id;
        card.dataset.autoName = "true";

        const group =
            card.closest<HTMLElement>(".bi-tactical-group");

        if (!cloning) {
            field<HTMLInputElement>(card, "name").value =
                template.name;
        }

        if (template.initiativeModifier !== null) {
            field<HTMLInputElement>(
                card,
                "modifier").value =
                String(template.initiativeModifier);
        }

        field<HTMLInputElement>(
            card,
            "rules-reference").value =
            template.match.conceptKey
                ? `rule:${template.match.conceptKey}`
                : `source:${template.match.sourceEntityId}`;

        const meta = query<HTMLElement>(
            "[data-role='monster-meta']",
            card);
        const facts = [
            template.maxHp !== null
                ? `HP ${template.maxHp}`
                : null,
            template.armorClass
                ? `AC ${template.armorClass}`
                : null,
            template.touchArmorClass
                ? `Touch ${template.touchArmorClass}`
                : null,
            template.flatFootedArmorClass
                ? `Flat-Footed ${template.flatFootedArmorClass}`
                : null,
            template.initiativeModifier !== null
                ? `Init ${formatSigned(template.initiativeModifier)}`
                : null,
            template.challengeRating
                ? `CR ${template.challengeRating}`
                : null,
            template.match.sourceCode,
            template.match.editionDisplayName
        ].filter((value): value is string => Boolean(value));

        meta.textContent =
            `Rules Core: ${facts.join(" · ")}`;
        meta.hidden = false;

        const actions = query<HTMLElement>(
            "[data-role='template-actions']",
            card);
        const clone = query<HTMLButtonElement>(
            "[data-action='clone-monster']",
            card);
        clone.textContent = `+ Another ${template.name}`;
        clone.onclick = () => {
            const parentGroup =
                card.closest<HTMLElement>(".bi-tactical-group");
            if (parentGroup) {
                this.cloneIntoGroup(parentGroup, template);
            }
        };
        actions.hidden = !group;

        if (group) {
            this.assignInstanceNames(
                group,
                template.match.id,
                template.name);
            this.callbacks.updateGroupSummary(group);
        }

        this.hydrateEnemyHealth(card, template.maxHp);
        this.callbacks.refreshControllers();
        this.callbacks.changed();
    }

    public clonePrimaryMonster(group: HTMLElement): void {
        const members = Array.from(
            group.querySelectorAll<HTMLElement>(
                ".bi-entry[data-id]"));
        const templates = members
            .map(card =>
                this.templates.get(card.dataset.id ?? ""))
            .filter(
                (value): value is MonsterTemplate =>
                    Boolean(value));

        if (!templates.length) return;

        const templateId = templates[0].match.id;
        if (!templates.every(
            template => template.match.id === templateId)) {
            return;
        }

        this.cloneIntoGroup(group, templates[0]);
    }

    public commonTemplate(
        members: readonly HTMLElement[]
    ): MonsterTemplate | null {
        const templates = members
            .map(card =>
                this.templates.get(card.dataset.id ?? ""))
            .filter(
                (value): value is MonsterTemplate =>
                    Boolean(value));

        if (templates.length !== members.length
            || templates.length === 0) {
            return null;
        }

        const id = templates[0].match.id;
        return templates.every(
            template => template.match.id === id)
            ? templates[0]
            : null;
    }

    public removeCard(card: HTMLElement): void {
        this.templates.delete(card.dataset.id ?? "");
    }

    private async renderMonsterMatches(
        card: HTMLElement,
        queryText: string,
        sequence: number
    ): Promise<void> {
        const box = query<HTMLElement>(
            "[data-role='monster-results']",
            card);

        try {
            const matches =
                await searchRulesCoreMonsters(queryText);

            if (sequence !== this.searchSequence
                || field<HTMLInputElement>(
                    card,
                    "name").value.trim()
                    !== queryText) {
                return;
            }

            box.replaceChildren();
            if (!matches.length) {
                const empty = document.createElement("div");
                empty.className = "p-2 bi-muted";
                empty.textContent =
                    "No Rules Core monster matches. "
                    + "You can keep the manual name.";
                box.append(empty);
            } else {
                for (const match of matches) {
                    box.append(
                        this.monsterMatchButton(
                            card,
                            match));
                }
            }

            box.hidden = false;
        } catch (error) {
            if (sequence !== this.searchSequence) return;

            box.replaceChildren();
            const warning = document.createElement("div");
            warning.className = "p-2 bi-muted";
            warning.textContent =
                error instanceof Error
                    ? error.message
                    : "Rules Core search is unavailable.";
            box.append(warning);
            box.hidden = false;
        }
    }

    private monsterMatchButton(
        card: HTMLElement,
        match: MonsterSearchMatch
    ): HTMLButtonElement {
        const button = document.createElement("button");
        button.type = "button";

        const title = document.createElement("strong");
        title.textContent = match.displayName;

        const detail = document.createElement("small");
        detail.textContent =
            `${match.sourceCode} · ${match.editionDisplayName}`
            + (
                match.kind === "resolved"
                    ? " · resolved rules"
                    : " · source"
            );

        button.append(title, detail);
        button.onmousedown =
            event => event.preventDefault();

        button.onclick = async () => {
            button.disabled = true;
            try {
                const template =
                    await loadMonsterTemplate(match);
                this.applyTemplate(
                    card,
                    template,
                    false);
                query<HTMLElement>(
                    "[data-role='monster-results']",
                    card).hidden = true;
            } catch (error) {
                this.callbacks.showError(error);
            } finally {
                button.disabled = false;
            }
        };

        return button;
    }

    private cloneIntoGroup(
        group: HTMLElement,
        template: MonsterTemplate
    ): void {
        if (!group.classList.contains(
            "bi-other-side-block")) {
            this.callbacks.addEnemyToGroup(
                group,
                template,
                false);
            return;
        }

        const before = new Set(
            Array.from(
                group.querySelectorAll<HTMLElement>(
                    ".bi-entry[data-id]"))
                .map(card => card.dataset.id));

        group.querySelector<HTMLButtonElement>(
            "[data-side-action='add-member']")
            ?.click();

        const target = Array.from(
            group.querySelectorAll<HTMLElement>(
                ".bi-entry[data-id]"))
            .find(card =>
                Boolean(card.dataset.id)
                && !before.has(card.dataset.id));

        if (target) {
            this.applyTemplate(
                target,
                template,
                true);
        }
    }

    private clearMonsterMetadata(card: HTMLElement): void {
        delete card.dataset.templateId;
        delete card.dataset.instanceNumber;

        field<HTMLInputElement>(
            card,
            "rules-reference").value = "";

        const meta = query<HTMLElement>(
            "[data-role='monster-meta']",
            card);
        meta.hidden = true;
        meta.textContent = "";

        query<HTMLElement>(
            "[data-role='template-actions']",
            card).hidden = true;

        const group =
            card.closest<HTMLElement>(".bi-tactical-group");
        if (group) {
            this.callbacks.updateGroupSummary(group);
        }
    }

    private assignInstanceNames(
        group: HTMLElement,
        templateId: string,
        baseName: string
    ): void {
        const matching = Array.from(
            group.querySelectorAll<HTMLElement>(".bi-entry"))
            .filter(card =>
                card.dataset.templateId === templateId);

        if (matching.length < 2) return;

        let next = Math.max(
            0,
            ...matching.map(card =>
                Number(card.dataset.instanceNumber ?? 0))) + 1;

        for (const card of matching) {
            if (!card.dataset.instanceNumber) {
                card.dataset.instanceNumber =
                    String(next++);
            }
        }

        const sorted = [...matching].sort(
            (left, right) =>
                Number(left.dataset.instanceNumber)
                - Number(right.dataset.instanceNumber));

        if (sorted.length >= 2
            && Number(sorted[0].dataset.instanceNumber) > 1) {
            sorted[0].dataset.instanceNumber = "1";
        }

        for (const card of sorted) {
            if (card.dataset.autoName === "true") {
                field<HTMLInputElement>(
                    card,
                    "name").value =
                    `${baseName} ${card.dataset.instanceNumber}`;
            }
        }
    }

    private renderedMonsterName(
        card: HTMLElement,
        template: MonsterTemplate
    ): string {
        return card.dataset.instanceNumber
            ? `${template.name} ${card.dataset.instanceNumber}`
            : template.name;
    }

    private hydrateEnemyHealth(
        card: HTMLElement,
        maxHp: number | null
    ): void {
        if (maxHp === null) return;

        let attempts = 0;
        const apply = () => {
            const panel =
                card.querySelector<HTMLElement>(
                    "[data-combat-setup='standard']");

            if (!panel) {
                if (attempts++ < 8) {
                    window.setTimeout(apply, 0);
                }
                return;
            }

            setLabeledNumber(panel, "Max HP", maxHp);
            setLabeledNumber(panel, "Current HP", maxHp);
        };

        window.setTimeout(apply, 0);
    }
}

function setLabeledNumber(
    scope: HTMLElement,
    labelText: string,
    value: number
): void {
    for (const wrapper of scope.querySelectorAll<HTMLElement>(
        ".bi-field"
    )) {
        const label =
            wrapper.querySelector("label")
                ?.textContent?.trim();
        const input =
            wrapper.querySelector<HTMLInputElement>(
                "input[type='number']");

        if (label !== labelText || !input) continue;

        input.value = String(value);
        input.dispatchEvent(
            new Event("input", { bubbles: true }));
        input.dispatchEvent(
            new Event("change", { bubbles: true }));
        return;
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

function field<T extends HTMLElement>(
    card: HTMLElement,
    name: string
): T {
    const element =
        card.querySelector(`[data-field='${name}']`);
    if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing ${name}`);
    }
    return element as T;
}
