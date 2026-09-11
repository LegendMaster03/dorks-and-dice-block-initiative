export function initializeTrackerLayoutUi(): void {
    const root = document.getElementById("tool-root");
    if (!(root instanceof HTMLElement)) return;

    installStyles(root.ownerDocument);
    const observer = new MutationObserver(() => schedule(root));
    observer.observe(root, { childList: true, subtree: true });
    schedule(root);
}

let scheduled = false;

function schedule(root: HTMLElement): void {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
        scheduled = false;
        enhance(root);
    });
}

function enhance(root: HTMLElement): void {
    root.classList.add("bi-dense-tracker");

    const players = root.querySelector<HTMLElement>("[data-role='players']");
    if (players) ensureRosterHeader(players, "players");

    for (const list of root.querySelectorAll<HTMLElement>("[data-role='group-members']")) {
        ensureRosterHeader(list, "enemies");
    }

    for (const card of root.querySelectorAll<HTMLElement>(".bi-entry[data-id]")) {
        const type = card.querySelector<HTMLSelectElement>("[data-field='block-type']")?.value;
        if (type !== "standard") continue;

        card.classList.add("bi-roster-entry");
        card.classList.toggle("bi-player-entry", card.dataset.alliance === "players");
        card.classList.toggle("bi-enemy-entry", card.dataset.alliance === "enemies");

        const remove = card.querySelector<HTMLButtonElement>("[data-action='remove']");
        if (remove) {
            remove.title = "Remove combatant";
            remove.setAttribute("aria-label", "Remove combatant");
        }
    }
}

function ensureRosterHeader(list: HTMLElement, kind: "players" | "enemies"): void {
    const existing = list.querySelector<HTMLElement>(":scope > .bi-roster-header");
    if (existing) return;

    const header = document.createElement("div");
    header.className = `bi-roster-header ${kind === "players" ? "bi-player-roster-header" : "bi-enemy-roster-header"}`;
    header.dataset.rosterHeader = kind;

    if (kind === "players") {
        header.innerHTML = "<span>Name</span><span>Mod</span><span>Initiative</span><span></span>";
    } else {
        header.innerHTML = "<span>Name</span><span>Mod</span><span>Initiative</span><span>HP / Adjust</span><span></span>";
    }

    list.prepend(header);
}

function installStyles(documentRef: Document): void {
    if (documentRef.head.querySelector("style[data-role='tracker-layout-ui-style']")) return;

    const style = documentRef.createElement("style");
    style.dataset.role = "tracker-layout-ui-style";
    style.textContent = `
.block-initiative-app.bi-dense-tracker .bi-sides{grid-template-columns:1fr!important}
.block-initiative-app.bi-dense-tracker .bi-side-body{gap:.45rem}
.block-initiative-app.bi-dense-tracker .bi-enemy-options{grid-template-columns:minmax(18rem,28rem) minmax(16rem,1fr);align-items:center;padding:.55rem .65rem}
.block-initiative-app.bi-dense-tracker .bi-enemy-options select{max-width:28rem}

.block-initiative-app.bi-dense-tracker .bi-roster-header{
  display:grid;gap:.45rem;align-items:end;justify-content:start;padding:0 .15rem .2rem;
  font-size:.76rem;font-weight:700;letter-spacing:.02em;opacity:.68;text-transform:uppercase
}
.block-initiative-app.bi-dense-tracker .bi-player-roster-header{grid-template-columns:minmax(16rem,36rem) 5rem 13rem auto}
.block-initiative-app.bi-dense-tracker .bi-enemy-roster-header{grid-template-columns:minmax(16rem,32rem) 5rem 13rem 22rem auto}

.block-initiative-app.bi-dense-tracker .bi-roster-entry{
  display:grid;gap:.45rem;align-items:center;justify-content:start;padding:.42rem .15rem!important;
  border:0!important;border-bottom:1px solid var(--bi-border)!important;border-radius:0!important
}
.block-initiative-app.bi-dense-tracker .bi-player-entry{grid-template-columns:minmax(16rem,36rem) 5rem 13rem auto}
.block-initiative-app.bi-dense-tracker .bi-enemy-entry{grid-template-columns:minmax(16rem,32rem) 5rem 13rem 22rem auto}
.block-initiative-app.bi-dense-tracker .bi-roster-entry>.bi-entry-main{display:contents!important}
.block-initiative-app.bi-dense-tracker .bi-roster-entry [data-role='name-field']{grid-column:1;grid-row:1}
.block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-initiative-modifier{grid-column:2;grid-row:1}
.block-initiative-app.bi-dense-tracker .bi-roster-entry [data-role='initiative-wrap']{grid-column:3;grid-row:1}
.block-initiative-app.bi-dense-tracker .bi-enemy-entry>[data-combat-setup='standard']{grid-column:4;grid-row:1}
.block-initiative-app.bi-dense-tracker .bi-enemy-entry>.bi-entry-main>button[data-action='remove']{grid-column:5;grid-row:1}
.block-initiative-app.bi-dense-tracker .bi-player-entry>.bi-entry-main>button[data-action='remove']{grid-column:4;grid-row:1}
.block-initiative-app.bi-dense-tracker .bi-roster-entry>.bi-entry-main>button[data-action='remove']{
  justify-self:start;width:auto!important;min-width:0;padding:.25rem .5rem;white-space:nowrap
}

.block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-entry-main>.bi-field>label,
.block-initiative-app.bi-dense-tracker .bi-roster-entry [data-role='initiative-wrap']>label,
.block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-hp-controls label{
  position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;
  overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important
}
.block-initiative-app.bi-dense-tracker .bi-roster-entry input{padding:.34rem .45rem}
.block-initiative-app.bi-dense-tracker .bi-roster-entry [data-role='name-field'] input{width:100%}
.block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-initiative-modifier input{width:5rem;max-width:5rem}
.block-initiative-app.bi-dense-tracker .bi-roster-entry [data-role='initiative-wrap']{
  display:grid!important;grid-template-columns:5.5rem auto;gap:.3rem;align-items:center;min-width:0
}
.block-initiative-app.bi-dense-tracker .bi-roster-entry [data-role='initiative-wrap']>input{grid-column:1;width:5.5rem;max-width:5.5rem}
.block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-roll-line{grid-column:2;margin:0!important;gap:.3rem;flex-wrap:nowrap!important;min-width:0}
.block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-roll-line .btn{padding:.25rem .45rem;white-space:nowrap}
.block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-roll-audit{font-size:.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:5rem}
.block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-roll-audit:empty{display:none}

.block-initiative-app.bi-dense-tracker .bi-roster-entry>[data-role='badges'],
.block-initiative-app.bi-dense-tracker .bi-roster-entry>.bi-monster-meta{display:none!important}
.block-initiative-app.bi-dense-tracker .bi-roster-entry>.bi-template-actions{grid-column:1/-1;grid-row:2;margin:.05rem 0 0}
.block-initiative-app.bi-dense-tracker .bi-roster-entry>.bi-template-actions .btn{padding:.18rem .42rem}

.block-initiative-app.bi-dense-tracker .bi-roster-entry>[data-combat-setup='standard']{
  border:0!important;margin:0!important;padding:0!important;min-width:0;width:22rem
}
.block-initiative-app.bi-dense-tracker .bi-roster-entry>[data-combat-setup='standard']>strong,
.block-initiative-app.bi-dense-tracker .bi-roster-entry>[data-combat-setup='standard']>.bi-note{display:none!important}
.block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-hp-controls{
  display:flex!important;flex-wrap:nowrap!important;gap:.35rem!important;align-items:center!important;margin:0!important;width:max-content
}
.block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-hp-fraction,
.block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-hp-adjust{display:flex;flex-wrap:nowrap;gap:.25rem;align-items:center}
.block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-hp-fraction>.bi-field,
.block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-hp-adjust>.bi-field{min-width:4.1rem!important;max-width:4.1rem!important;flex:0 0 4.1rem!important}
.block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-hp-fraction input,
.block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-hp-adjust input{width:4.1rem!important;max-width:4.1rem!important}
.block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-hp-slash{line-height:1;font-size:1.1rem;padding:0 .05rem}
.block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-hp-adjust .btn{width:2rem!important;min-width:2rem!important;height:2rem!important;padding:0!important}

.block-initiative-app.bi-dense-tracker .bi-tactical-group{border:0!important;border-top:1px solid var(--bi-border)!important;border-radius:0!important}
.block-initiative-app.bi-dense-tracker .bi-group-head{padding:.45rem .15rem!important;background:transparent!important;border-bottom:0!important;align-items:center;gap:.75rem}
.block-initiative-app.bi-dense-tracker .bi-group-body{padding:.1rem .15rem .45rem!important;gap:.3rem!important}
.block-initiative-app.bi-dense-tracker .bi-group-name{font-size:1rem;max-width:22rem}
.block-initiative-app.bi-dense-tracker .bi-group-head .bi-badges{display:flex;align-items:center;justify-content:flex-start;gap:.35rem;flex-wrap:wrap}
.block-initiative-app.bi-dense-tracker .bi-group-head .btn{padding:.24rem .48rem;white-space:nowrap}
.block-initiative-app.bi-dense-tracker .bi-shared-roll-control{display:flex!important;align-items:center;gap:.35rem;min-width:0!important;max-width:none!important}
.block-initiative-app.bi-dense-tracker .bi-shared-roll-control label{margin:0;white-space:nowrap}
.block-initiative-app.bi-dense-tracker .bi-shared-roll-control input{width:4.5rem!important;max-width:4.5rem!important;padding:.3rem .4rem}
.block-initiative-app.bi-dense-tracker .bi-shared-result{min-width:6.5rem}
.block-initiative-app.bi-dense-tracker .bi-group-body>[data-action='add-member']{justify-self:start;width:auto!important;padding:.22rem .5rem}
.block-initiative-app.bi-dense-tracker .bi-enemy-create-buttons .btn{padding:.25rem .5rem}

@media(max-width:1180px){
  .block-initiative-app.bi-dense-tracker .bi-enemy-roster-header{display:none}
  .block-initiative-app.bi-dense-tracker .bi-enemy-entry{grid-template-columns:minmax(14rem,1fr) 5rem 13rem auto}
  .block-initiative-app.bi-dense-tracker .bi-enemy-entry>[data-combat-setup='standard']{grid-column:1/4;grid-row:2;width:max-content}
  .block-initiative-app.bi-dense-tracker .bi-enemy-entry>.bi-entry-main>button[data-action='remove']{grid-column:4;grid-row:1}
}
@media(max-width:900px){
  .block-initiative-app.bi-dense-tracker .bi-enemy-options{grid-template-columns:1fr}
  .block-initiative-app.bi-dense-tracker .bi-player-roster-header{display:none}
  .block-initiative-app.bi-dense-tracker .bi-player-entry{grid-template-columns:minmax(12rem,1fr) 5rem 13rem auto}
}
@media(max-width:650px){
  .block-initiative-app.bi-dense-tracker .bi-roster-header{display:none}
  .block-initiative-app.bi-dense-tracker .bi-player-entry,
  .block-initiative-app.bi-dense-tracker .bi-enemy-entry{grid-template-columns:minmax(9rem,1fr) auto;align-items:end}
  .block-initiative-app.bi-dense-tracker .bi-roster-entry [data-role='name-field']{grid-column:1;grid-row:1}
  .block-initiative-app.bi-dense-tracker .bi-roster-entry>.bi-entry-main>button[data-action='remove']{grid-column:2;grid-row:1}
  .block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-initiative-modifier{grid-column:1;grid-row:2;width:5rem}
  .block-initiative-app.bi-dense-tracker .bi-roster-entry [data-role='initiative-wrap']{grid-column:2;grid-row:2}
  .block-initiative-app.bi-dense-tracker .bi-enemy-entry>[data-combat-setup='standard']{grid-column:1/-1;grid-row:3}
  .block-initiative-app.bi-dense-tracker .bi-roster-entry .bi-entry-main>.bi-field>label,
  .block-initiative-app.bi-dense-tracker .bi-roster-entry [data-role='initiative-wrap']>label{position:static!important;width:auto!important;height:auto!important;margin:0!important;overflow:visible!important;clip:auto!important;white-space:normal!important}
}
`;
    documentRef.head.append(style);
}
