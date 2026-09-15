# Block Initiative architecture

## Purpose

Block Initiative is a separately deployable Dorks & Dice Tool for encounter initiative tracking. The main Dorks & Dice site owns account identity, global roles, campaign membership/authority, site-mode resolution, Tool registration, and Tool routing.

The Tool is hosted as an Embedded Module, but the frontend is treated as a complete application rather than a small script. The site owns the outer page shell; Block Initiative owns the encounter workspace mounted inside `#tool-root`.

## Initial project boundaries

```text
Dorks & Dice Tool Host
        |
        v
TypeScript encounter application
        |
        +---- host/campaign adapter
        |
        v
Block Initiative HTTP service
        |
        v
BlockInitiative.Core
```

`BlockInitiative.Core` is reserved for deterministic initiative rules, state transitions, and invariants. It must not depend on ASP.NET Core, persistence, the Dorks & Dice host, or Rules Core.

`BlockInitiative.Web` owns HTTP hosting, static frontend delivery, host integration adapters, and future application APIs. Integration with persistence, Rules Core, campaigns, or other services belongs behind explicit boundaries rather than inside the Core project.

The TypeScript client owns the interactive encounter workspace. Complex browser-side state is expected; the Embedded Module choice is a hosting decision and does not limit the frontend to a single-file widget.

## Campaign integration

Campaign support is an optional host integration, not a prerequisite for initiative tracking. Standalone and anonymous hosted sessions retain the manual roster workflow.

The main site remains authoritative for campaign membership, roles, participants, and campaign-character associations. Block Initiative consumes the Tool Host's stable read-only campaign projection and does not access the site's campaign persistence directly.

The distinction between campaign concepts remains intact:

- membership and roles represent authenticated campaign authority;
- participants represent people at the table, including guests without accounts;
- campaign-linked characters represent character records that can seed player combatants.

The initial integration is deliberately additive. Selecting a campaign exposes context to the encounter workspace and allows active linked characters to be added to the player roster. Existing manual combatants are retained, and participants are not automatically converted into characters or combatants.

Imported combatant cards retain stable campaign/character identifiers as metadata. That creates a future synchronization and persistence boundary without making display names authoritative or introducing persistence into `BlockInitiative.Core`.

## Frontend render lifecycle

Block Initiative owns the DOM inside `#tool-root`, so application-owned mutations are coordinated explicitly rather than rediscovered with `MutationObserver`.

`render-lifecycle.ts` provides one coalesced enhancement queue. Feature modules register idempotent after-render hooks with numeric ordering, and state or UI events request an enhancement pass through the shared coordinator. Requests made while a pass is already scheduled are coalesced. Requests made synchronously from inside an executing hook are ignored so a hook can not recursively schedule itself because of its own DOM writes.

The current hook order is intentionally structural:

1. other-side structure;
2. combatant primary fields;
3. combat-state setup/dashboard creation;
4. initiative-roll controls;
5. compact health controls;
6. Kaiju layout;
7. duplicate-enemy controls;
8. dense tracker layout;
9. condition tracking;
10. condition placement into combat-state rows;
11. Rules Core link decoration.

The runtime installs stable event handlers once and requests a pass after application input/change/click events. Preview and turn-state API events also request passes. Asynchronous stateful work, such as Kaiju evaluation, explicitly requests a pass when it replaces application-owned DOM.

Enhancement functions must be idempotent: running a pass again with unchanged application state must not add duplicate controls, reinstall handlers, or rewrite equivalent DOM. State maps and application request/response objects remain authoritative; DOM is presentation, not state storage.

No `MutationObserver` is currently required by Block Initiative. If a future integration has a genuinely external DOM boundary, observer ownership must be centralized and guarded against reacting to Block Initiative's own mutations rather than added to an individual feature module.

The runtime bootstrap is deferred by one browser task because `api.ts` is evaluated as a dependency before `app.ts` mounts the initial workspace. This preserves the currently deployed Embedded Module host contract while avoiding DOM observation as a mounting signal.

## Raw facts and derived state

The design document distinguishes underlying initiative facts from derived block/round state. The implementation preserves that distinction. Raw initiative values must not be rewritten merely because a controller, block order, or DM override changes how a turn is presented.

## Alliances and block types

Alliance and turn-block type are separate concepts.

An alliance identifies which combatants are allied for initiative grouping and encounter logic. A block type identifies the rules that govern a derived turn block. Standard player/enemy blocks use the ordinary block rules. Kaiju use a dedicated Kaiju block type even when their alliance is `enemies`.

This distinction prevents an adjacent Kaiju and ordinary enemy from collapsing into one ordinary enemy block solely because they share an alliance. It also leaves the model open to future special block types without encoding those mechanics as fake alliances.

Kaiju-specific design is documented in [`kaiju-integration.md`](kaiju-integration.md).

## Encounter UX boundary

The normal manual workflow should expose only the information needed to establish an encounter: combatant name, side, and initiative result. Common sides are represented as separate Player and Enemy entry areas rather than requiring the DM to interpret an alliance field on every row.

Options that change calculation behavior, such as controller initiative and special block type, belong under advanced options. Raw metadata that is retained but does not currently change block construction, such as initiative modifier and tactical-group label, must be identified as metadata rather than presented as active mechanics.

Unresolved rules cases should appear only when encountered. Opposing-side initiative ties are therefore adjudicated in the result view instead of requiring the DM to maintain a manual row order during normal setup. The result view should also explain how to execute the derived order, including the round-one cyclic wraparound and the merged round-two block.

## Persistence

No persistence technology is selected yet. Encounter storage requirements need to be established before choosing PostgreSQL, another service, or a different persistence model.

Campaign selection and roster import do not constitute encounter persistence. The selected campaign and linked-character IDs are retained as integration metadata so a future persistence layer can associate encounters with campaigns without coupling storage decisions to the initiative engine.

## Real-time synchronization

The current Tool Host does not support WebSocket upgrades and does not provide a dependable indefinite-stream/SSE contract. Multi-device encounter synchronization therefore remains a separate design decision. The initial architecture must not assume that a live socket transport is available through the Tool Host.

## Rules Core

Block Initiative is expected to consume rules information rather than own the broader hybrid-rules corpus. The integration contract with Rules Core will be designed when the tracker requires concrete rules data. Block construction itself remains an initiative concern and should not become coupled to Rules Core storage internals.
