import { loadToolHostContext } from "./host";

const root = document.getElementById("tool-root");
if (!(root instanceof HTMLElement)) {
    throw new Error("Block Initiative could not find the Dorks & Dice tool root.");
}

root.replaceChildren();

const container = document.createElement("section");
container.className = "container-fluid px-0";

const card = document.createElement("div");
card.className = "card card-body";

const heading = document.createElement("h2");
heading.className = "h4";
heading.textContent = "Block Initiative";

const description = document.createElement("p");
description.className = "mb-2";
description.textContent = "The Block Initiative application scaffold is running. Encounter behavior has not been implemented yet.";

const status = document.createElement("p");
status.className = "mb-0 text-body-secondary";
status.setAttribute("role", "status");

card.append(heading, description, status);
container.append(card);
root.append(container);

const contextUrl = root.dataset.toolContextUrl;
if (!contextUrl) {
    status.textContent = "Standalone development mode.";
} else {
    status.textContent = "Loading Dorks & Dice host context…";

    try {
        const context = await loadToolHostContext(contextUrl);
        status.textContent = context.user
            ? `Connected to Dorks & Dice as ${context.user.displayName || context.user.id}.`
            : "Connected to Dorks & Dice without an authenticated user.";
    } catch (error) {
        console.error("Block Initiative host-context check failed.", error);
        status.textContent = "Dorks & Dice host context could not be loaded.";
    }
}
