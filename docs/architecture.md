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

## Frontend module architecture

The TypeScript application follows the same core-plus-module principle as the Core project. Module boundaries are based on ownership and reasons to change, not file size alone.

```text
Client/src/
├── app.ts                         # bootstrap, host endpoints, preview dispatch
├── api.ts                         # shared initiative API contract
├── host.ts                        # Tool Host transport boundary
├── render-lifecycle.ts            # cross-cutting enhancement coordinator
├── application/
│   ├── app-shell.ts               # static shell and base presentation
│   ├── initiative-preview.ts      # preview/adjudication view
│   ├── encounter-runner.ts        # running encounter lifecycle/history
│   └── presentation.ts            # shared presentation primitives
├── campaign/
│   ├── campaign-ui.ts             # optional hosted campaign integration
│   └── campaign-roster.ts         # campaign-character deduplication rules
├── initiative/
│   ├── initiative-mode.ts         # Block vs Standard initiative mode
│   ├── initiative-roll-ui.ts      # initiative rolling/group calculations
│   ├── combatant-reorder.ts       # pure reorder operations
│   └── combatant-drag-reorder-ui.ts
├── roster/
│   ├── roster-controller.ts       # roster construction/validation/request projection
│   ├── monster-roster.ts          # Rules Core monster templates/autocomplete/cloning
│   ├── tactical-group-roster.ts   # tactical-group construction/mode presentation
│   ├── monster-combat-stats.ts    # edition-neutral monster stat projection
│   ├── combatant-field-ui.ts      # primary roster-field layout
│   ├── enemy-duplicate-ui.ts      # tactical-group duplication affordances
│   └── other-side-ui.ts           # additional-side roster structure
├── conditions/
│   ├── condition-model.ts         # tracked-condition state
│   ├── condition-editor.ts        # chips, menus, picker, Rules Core lookup
│   └── condition-tracking-ui.ts   # setup/preview/runner projection coordinator
├── combat/
│   ├── combat-state-types.ts      # shared combat state contracts
│   ├── combat-ui.ts               # shared combat UI primitives
│   ├── standard-combat-state.ts   # Standard HP implementation
│   └── kaiju-combat-state.ts      # Kaiju combat implementation
├── integrations/
│   └── rules-core/
│       ├── client.ts              # shared transport/search/link contract
│       ├── monsters.ts            # Monster adapter
│       └── conditions.ts          # Condition adapter
└── persistence/
    ├── encounter-schema.ts        # complete-save contract
    ├── encounter-storage.ts       # browser storage backend
    ├── encounter-dom.ts           # persistence DOM identity helpers
    ├── encounter-capture.ts       # complete snapshot capture
    └── encounter-restore.ts       # reconstruction/replay session
```

The root of `Client/src` is intentionally reserved for application bootstrap and cross-cutting coordination. Domain-specific code should live under the domain that owns it rather than accumulating at the root.

`app.ts` does not own roster construction, preview rendering, or runner internals. `RosterController` owns combatant roster state and request projection, while `MonsterRosterService` owns Rules Core monster lookup/template-derived behavior and `TacticalGroupRosterService` owns tactical-group construction, mode presentation, and summaries. Condition tracking separates state, editor rendering, and lifecycle projection so future condition behavior has an obvious home.

Combat-state coordination does not own Standard or Kaiju implementation details. Persistence treats capture, storage, and restore as separate responsibilities while preserving one complete-encounter contract. Rules Core entity modules share one transport boundary rather than duplicating HTTP and error-handling logic.

Inheritance is used where there is a real domain subtype relationship, such as Core turn blocks and initiative modes. Browser modules generally use composition where lifecycle ownership is the more meaningful relationship.

## Hex Crawl encounter handoff

Block Initiative accepts a versioned `hexEncounter` handoff payload from the Hex Crawl Tool. The browser client validates the payload locally before using it and removes the consumed query parameter so a reload can not duplicate imported roster entries.

The handoff carries expedition/watch/hex/location/outcome/note context and may include structured combatants. Structured combatants are imported into the setup roster when there is no saved Block Initiative encounter being restored. An existing saved encounter takes precedence over automatic roster import. Free-text encounter notes are displayed as context only; Block Initiative does not parse prose into monster identities.

This integration remains outside `BlockInitiative.Core`. Hex Crawl owns expedition state and encounter triggering; Block Initiative owns tactical roster construction, initiative, and combat execution. Rules Core remains the authority for source-backed monster details when a structured combatant reference is available.

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

The hook order is intentionally structural. Lower-priority hooks establish setup and runner structure; later hooks decorate those stable surfaces. Encounter runner cards have an additional ownership rule: `encounter-card-renderer.ts` owns their direct-child composition and named slots. Feature modules may supply initiative, context, metrics, quick stats, conditions, or combat state, but they mount those surfaces through the renderer instead of reordering one another's DOM.

Combat state and condition tracking now mount directly into their card-owned surfaces. There is no intermediate combat/condition dashboard relay or cleanup pass.

The runtime installs stable event handlers once and requests a pass after application input/change/click events. Preview and turn-state API events also request passes. Asynchronous stateful work, such as Kaiju evaluation, explicitly requests a pass when it replaces application-owned DOM.

Enhancement functions must be idempotent: running a pass again with unchanged application state must not add duplicate controls, reinstall handlers, or rewrite equivalent DOM. State maps and application request/response objects remain authoritative; DOM is presentation, not state storage.

No `MutationObserver` is currently required by Block Initiative. If a future integration has a genuinely external DOM boundary, observer ownership must be centralized and guarded against reacting to Block Initiative's own mutations rather than added to an individual feature module.

The runtime bootstrap is deferred by one browser task because `api.ts` is evaluated as a dependency before `app.ts` mounts the initial workspace. This preserves the currently deployed Embedded Module host contract while avoiding DOM observation as a mounting signal.

## Raw facts and derived state

The design document distinguishes underlying initiative facts from derived block/round state. The implementation preserves that distinction. Raw initiative values must not be rewritten merely because a controller, block order, or DM override changes how a turn is presented.

## Alliances and block modules

Alliance and turn-block type are separate concepts.

An alliance identifies which combatants are allied for initiative grouping and encounter logic. A block type identifies the rules module represented by a derived turn.

The Core models that distinction structurally:

```text
TurnBlock (abstract core)
├── StandardTurnBlock
├── KaijuTurnBlock
└── MixedTurnBlock
```

`TurnBlock` owns the invariants shared by every turn: identity, alliance, membership, tactical member order, merge provenance, and same-side merge validation. Each concrete block module lives in its own file under `Initiative/Blocks` and identifies the ruleset for that turn. `TurnBlockFactory` is the single mapping from `TurnBlockType` to a concrete module, so adding another block kind does not require scattered construction switches.

`MixedTurnBlock` is derived only when a contiguous allied turn or cyclic merge combines different block modules. It is not valid as a raw combatant type.

This is intentionally the same core-plus-module pattern used elsewhere in Dorks & Dice and in XnGine: common lifecycle and invariants remain in the core abstraction, while specialized behavior belongs to the concrete module that owns it.

Kaiju-specific design is documented in [`kaiju-integration.md`](kaiju-integration.md).


## Initiative mode modules

`InitiativeEngine` is the shared orchestration core. It validates the roster, resolves controller and tactical-group placement, orders initiative, and then delegates mode-specific behavior to an `InitiativeModeStrategy`.

```text
InitiativeModeStrategy (abstract core)
├── BlockInitiativeModeStrategy
└── StandardInitiativeModeStrategy
```

Each mode module owns only what differs between modes: tie adjudication policy, conversion of ordered placements into turns, and optional cyclic-merge planning. The engine does not branch on the mode after resolving the strategy. `InitiativeModeStrategyFactory` is the single mapping from the public `InitiativeMode` value to a concrete mode module.

This keeps new initiative modes additive: a new mode should be implemented as a module instead of adding another set of conditionals to `InitiativeEngine`.


Tactical-group calculation follows the same boundary. `TacticalGroupRules` owns group identity, while `TacticalGroupInitiativeResolver` owns average/shared-roll calculation and stable grouped sorting. The engine consumes those results as inputs to the common placement pipeline.

## Encounter UX boundary

The normal manual workflow should expose only the information needed to establish an encounter: combatant name, side, and initiative result. Common sides are represented as separate Player and Enemy entry areas rather than requiring the DM to interpret an alliance field on every row.

Options that change calculation behavior, such as controller initiative and special block type, belong under advanced options. Raw metadata that is retained but does not currently change block construction, such as initiative modifier and tactical-group label, must be identified as metadata rather than presented as active mechanics.

Unresolved rules cases should appear only when encountered. Opposing-side initiative ties are therefore adjudicated in the result view instead of requiring the DM to maintain a manual row order during normal setup. The result view should also explain how to execute the derived order, including the round-one cyclic wraparound and the merged round-two block.

## Persistence

The current persistence backend is browser-local storage. The persistence contract is broader than the backend: an encounter save represents the complete encounter, including roster structure, Standard and Kaiju combat state, conditions, initiative position, campaign metadata, and Rules Core projections already handed to the tool. Block type is never a reason to omit state from a save.

Server/account or cross-device persistence remains a future transport decision. Changing the storage backend must preserve the complete-encounter contract rather than introducing a second, reduced save format.

Campaign selection and roster import do not themselves constitute encounter persistence. The selected campaign and linked-character IDs are retained as integration metadata so a future host-backed layer can associate encounters with campaigns without coupling storage decisions to the initiative engine.

## Real-time synchronization

The current Tool Host does not support WebSocket upgrades and does not provide a dependable indefinite-stream/SSE contract. Multi-device encounter synchronization therefore remains a separate design decision. The initial architecture must not assume that a live socket transport is available through the Tool Host.

## Rules Core

Block Initiative consumes rules information through the shared `integrations/rules-core/client.ts` boundary rather than owning the broader hybrid-rules corpus. The shared client owns Tool Host transport, search normalization, error handling, and browser-link translation. Entity adapters such as `monsters.ts` and `conditions.ts` own only entity-specific projection behavior.

Block construction remains an initiative concern and is not coupled to Rules Core storage internals. Rules Core enriches encounter data when available; manual encounter entry continues to work when Rules Core data is unavailable.
