import type { TurnBlockType } from "../api";

export function friendlyAlliance(value: string): string {
    if (value === "players") return "Players";
    if (value === "enemies") return "Enemies";

    return value
        .split(/[-_ ]+/)
        .filter(Boolean)
        .map(part => (part[0]?.toUpperCase() ?? "") + part.slice(1))
        .join(" ")
        || "Other side";
}

export function createBadge(
    text: string,
    strong = false
): HTMLElement {
    const element = document.createElement("span");
    element.className = `bi-badge${strong ? " bi-kaiju" : ""}`;
    element.textContent = text;
    return element;
}

export function createBlockBadges(
    allianceId: string,
    blockType: TurnBlockType
): HTMLElement {
    const container = document.createElement("div");
    container.className = "bi-badges";
    container.append(createBadge(friendlyAlliance(allianceId)));

    if (blockType === "kaiju") {
        container.append(createBadge("Kaiju", true));
    } else if (blockType === "mixed") {
        container.append(createBadge("Standard + Kaiju", true));
    }

    return container;
}

export function formatSigned(value: number): string {
    return value >= 0 ? `+${value}` : String(value);
}

export function formatNumber(value: number): string {
    return Number.isInteger(value)
        ? String(value)
        : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
