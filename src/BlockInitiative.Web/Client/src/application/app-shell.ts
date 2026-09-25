/**
 * Owns the static application shell and base styles.
 *
 * Feature modules enhance this stable structure after mount. Application
 * orchestration should not carry the shell's markup or presentation details.
 */
export function mountApplicationShell(root: HTMLElement): HTMLElement {
    root.replaceChildren();
    root.classList.add("block-initiative-app");

    const style = document.createElement("style");
    style.textContent = `
    .block-initiative-app{--bi-border:rgba(127,127,127,.28);--bi-soft:rgba(127,127,127,.08)}
    .block-initiative-app .btn-outline-primary{--bs-btn-color:var(--bs-link-color,#0d6efd);--bs-btn-border-color:var(--bs-link-color,#0d6efd)}
    .block-initiative-app .btn-outline-secondary{--bs-btn-color:var(--bs-secondary-color,#6c757d);--bs-btn-border-color:var(--bs-secondary-color,#6c757d)}
    .block-initiative-app .bi-grid,.block-initiative-app .bi-list{display:grid;gap:.75rem}
    .block-initiative-app .bi-steps,.block-initiative-app .bi-sides{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}
    .block-initiative-app .bi-steps{grid-template-columns:repeat(3,minmax(0,1fr))}
    .block-initiative-app .bi-step,.block-initiative-app .bi-side,.block-initiative-app .bi-entry,.block-initiative-app .bi-block,.block-initiative-app .bi-active,.block-initiative-app .bi-tactical-group{border:1px solid var(--bi-border);border-radius:.65rem}
    .block-initiative-app .bi-step,.block-initiative-app .bi-entry,.block-initiative-app .bi-active{padding:.75rem}
    .block-initiative-app .bi-side,.block-initiative-app .bi-tactical-group{overflow:visible}
    .block-initiative-app .bi-side-head,.block-initiative-app .bi-block-head,.block-initiative-app .bi-group-head{display:flex;justify-content:space-between;gap:.6rem;align-items:start;padding:.7rem;background:var(--bi-soft);border-bottom:1px solid var(--bi-border)}
    .block-initiative-app .bi-side-body,.block-initiative-app .bi-block-body,.block-initiative-app .bi-group-body{padding:.7rem}.block-initiative-app .bi-side-body,.block-initiative-app .bi-group-body{display:grid;gap:.55rem}
    .block-initiative-app .bi-entry-main{display:grid;grid-template-columns:minmax(11rem,1.7fr) minmax(6rem,.6fr) auto;gap:.5rem;align-items:end}.block-initiative-app .bi-entry-main.custom{grid-template-columns:1.3fr 1fr .6fr auto}
    .block-initiative-app .bi-field{display:grid;gap:.2rem;position:relative}.block-initiative-app .bi-field label{font-size:.82rem;font-weight:600;opacity:.8}.block-initiative-app input,.block-initiative-app select{width:100%;min-width:0;padding:.4rem .5rem}
    .block-initiative-app .bi-row,.block-initiative-app .bi-actions,.block-initiative-app .bi-badges,.block-initiative-app .bi-sequence{display:flex;flex-wrap:wrap;gap:.45rem;align-items:center}.block-initiative-app .bi-row{justify-content:space-between}.block-initiative-app .bi-actions{justify-content:flex-end}
    .block-initiative-app .bi-badge,.block-initiative-app .bi-seq{border:1px solid currentColor;border-radius:999px;padding:.15rem .5rem;font-size:.8rem}.block-initiative-app .bi-seq.active{border-width:2px;font-weight:700}.block-initiative-app .bi-kaiju{font-weight:700}
    .block-initiative-app .bi-muted{color:var(--bs-secondary-color,currentColor);opacity:1}.block-initiative-app .bi-message{border-left:4px solid currentColor;padding:.65rem .8rem}.block-initiative-app .bi-warning{background:rgba(180,130,0,.08)}.block-initiative-app .bi-success{background:rgba(0,130,70,.08)}.block-initiative-app .bi-error{background:rgba(180,0,0,.08)}.block-initiative-app [data-role='hex-crawl-handoff']{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:.75rem}.block-initiative-app [data-role='hex-crawl-handoff']>div{display:grid;gap:.2rem}
    .block-initiative-app .bi-blocks{display:grid;gap:.6rem}.block-initiative-app .bi-member{display:flex;justify-content:space-between;gap:.5rem;padding:.3rem 0;border-bottom:1px solid var(--bi-border)}.block-initiative-app .bi-member:last-child{border-bottom:0}
    .block-initiative-app .bi-primary{border-top:1px solid var(--bi-border);margin-top:.8rem;padding-top:.8rem}.block-initiative-app details{margin-top:.55rem}.block-initiative-app summary{cursor:pointer}.block-initiative-app .bi-advanced{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.55rem;margin-top:.55rem}
    .block-initiative-app .bi-active{border-width:2px}.block-initiative-app .bi-active h4{margin-bottom:.2rem}.block-initiative-app .bi-runner-member{padding:.5rem;border:1px solid var(--bi-border);border-radius:.45rem}
    .block-initiative-app .bi-enemy-options{display:grid;grid-template-columns:minmax(12rem,1fr) 2fr;gap:.7rem;align-items:end;padding:.65rem;border:1px solid var(--bi-border);border-radius:.55rem;background:var(--bi-soft)}
    .block-initiative-app .bi-groups{display:grid;gap:.7rem}.block-initiative-app .bi-group-name{font-weight:700;border:0;background:transparent;padding:.1rem 0;max-width:18rem}.block-initiative-app .bi-group-name:focus{background:var(--bs-body-bg,white);border:1px solid var(--bi-border);padding:.25rem}
    .block-initiative-app .bi-monster-meta{font-size:.82rem;opacity:.78;margin-top:.4rem}.block-initiative-app .bi-template-actions{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.45rem}
    .block-initiative-app .bi-autocomplete{position:absolute;z-index:20;top:100%;left:0;right:0;border:1px solid var(--bi-border);border-radius:.45rem;background:var(--bs-body-bg,#fff);box-shadow:0 .35rem 1rem rgba(0,0,0,.15);overflow:hidden;margin-top:.15rem}
    .block-initiative-app .bi-autocomplete button{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--bi-border);background:transparent;padding:.5rem .6rem}.block-initiative-app .bi-autocomplete button:last-child{border-bottom:0}.block-initiative-app .bi-autocomplete button:hover,.block-initiative-app .bi-autocomplete button:focus{background:var(--bi-soft)}
    .block-initiative-app .bi-autocomplete strong,.block-initiative-app .bi-autocomplete small{display:block}.block-initiative-app .bi-autocomplete small{opacity:.72}
    .block-initiative-app .bi-group-roll{min-width:8rem;max-width:11rem}.block-initiative-app .bi-group-summary{font-size:.85rem;opacity:.8}
    .block-initiative-app .bi-running-edit-note{margin:.1rem 0 .2rem}
    .block-initiative-app .bi-guide-body{display:grid;gap:.7rem;margin-top:.6rem}
    @media(max-width:900px){.block-initiative-app .bi-steps,.block-initiative-app .bi-sides{grid-template-columns:1fr}.block-initiative-app .bi-enemy-options{grid-template-columns:1fr}}
    @media(max-width:800px){.block-initiative-app .bi-entry-main,.block-initiative-app .bi-entry-main.custom,.block-initiative-app .bi-advanced{grid-template-columns:1fr 1fr}}
    @media(max-width:500px){.block-initiative-app .bi-entry-main,.block-initiative-app .bi-entry-main.custom,.block-initiative-app .bi-advanced{grid-template-columns:1fr}}
    `;
    root.append(style);

    const shell = document.createElement("section");
    shell.className = "bi-grid";
    shell.innerHTML = `
    <header class="bi-grid">
      <div>
        <h2 class="h4 mb-1">Block Initiative</h2>
        <p class="mb-1">Build the encounter roster, derive turn blocks, then run combat from one screen.</p>
        <p class="bi-muted mb-0" data-role="host-status"></p>
      </div>
      <details data-role="initiative-guide">
        <summary>How this tool works</summary>
        <div class="bi-guide-body">
          <div class="bi-steps">
            <div class="bi-step"><strong>1. Build the roster</strong><div class="bi-muted">Players are simple. Non-player sides can use grouped initiative and Rules Core monster data.</div></div>
            <div class="bi-step"><strong>2. Build blocks</strong><div class="bi-muted">Initiative placement and side determine turn blocks. Adjacent members of one side always share a turn block.</div></div>
            <div class="bi-step"><strong>3. Run combat</strong><div class="bi-muted">Track the active block, health, Kaiju state, and creatures joining mid-fight.</div></div>
          </div>
          <div data-role="block-rule-copy">
            <strong>Block rule</strong>
            <p class="bi-muted mb-0">Initiative is sorted normally. Consecutive combatants from the same side form one turn block, even when their member block types differ. Players in the same player block may act in any order. If the first and last blocks belong to the same side, the lower block skips its separate round-one activation and joins the higher block across the round boundary.</p>
          </div>
        </div>
      </details>
    </header>
    <section class="bi-message bi-warning" data-role="hex-crawl-handoff" hidden></section>
    <section class="card card-body bi-grid" data-role="setup">
      <div><h3 class="h5 mb-1">Set up the encounter</h3><div class="bi-muted">Only name and initiative are required for manual entries. Rules Core can fill monster data when available.</div></div>
      <div class="bi-sides">
        <section class="bi-side">
          <div class="bi-side-head"><div><strong>Players</strong><div class="bi-muted">Player characters and allies</div></div><button class="btn btn-sm btn-outline-primary" data-action="add-player">+ Player</button></div>
          <div class="bi-side-body" data-role="players"></div>
        </section>
        <section class="bi-side">
          <div class="bi-side-head"><div><strong>Enemies</strong><div class="bi-muted">The default non-player side. Add other sides below when the encounter needs them.</div></div><button class="btn btn-sm btn-outline-secondary" data-action="add-kaiju">+ Kaiju</button></div>
          <div class="bi-side-body">
            <div class="bi-enemy-options">
              <div class="bi-field"><label>Non-player initiative method</label><select data-role="enemy-method"><option value="average">Tactical groups</option><option value="individual">Individual placement</option></select></div>
              <div class="bi-muted" data-role="enemy-method-help"></div>
            </div>
            <div class="bi-groups" data-role="enemy-groups"></div>
            <div class="bi-row"><button class="btn btn-sm btn-outline-secondary" data-action="add-group">+ Tactical group</button><span class="bi-muted">Groups are roster units; actual turn blocks are always derived from side and initiative placement.</span></div>
            <div class="bi-list" data-role="kaiju-list"></div>
          </div>
        </section>
      </div>
      <details><summary>Other sides</summary><div class="bi-row mt-2"><span class="bi-muted">Add another side, then add Standard or Kaiju blocks within it.</span><button class="btn btn-sm btn-outline-secondary" data-action="add-other">+ Side</button></div><div class="bi-list mt-2" data-role="others"></div></details>
      <div class="bi-row bi-primary"><div><strong data-role="setup-status">Enter at least two combatants.</strong><div class="bi-muted">You can edit and rebuild before or during combat.</div></div><button class="btn btn-primary" data-action="preview">Build initiative blocks</button></div>
    </section>
    <section data-role="message" hidden></section>
    <section class="bi-grid" data-role="results"></section>`;
    root.append(shell);
    return shell;
}

function indent(value: string, spaces: number): string {
    const prefix = " ".repeat(spaces);
    return value.split("\n").map(line => line ? prefix + line : line).join("\n");
}
