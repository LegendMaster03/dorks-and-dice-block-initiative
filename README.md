# Dorks & Dice Block Initiative

Block Initiative is a separately deployable Dorks & Dice Tool for building and running the house-rule block initiative system used at the table.

The production integration type is **Embedded Module**. The Dorks & Dice site owns the outer page shell, identity, campaign authority, Tool registration, and routing. Block Initiative owns the encounter workspace rendered inside the host's `#tool-root`.

## Current development slice

The current implementation establishes the initiative engine and a manual encounter workflow. A DM can:

- add players and enemies using only a name and initiative result;
- add Kaiju as a distinct turn block type;
- add additional encounter sides when needed;
- optionally record controller relationships and metadata;
- derive contiguous allied turn blocks without changing the original initiative rolls;
- resolve opposing-side initiative ties explicitly without inventing a house rule;
- start the encounter after reviewing the derived blocks;
- track the current round and active block with a single **Next block** action;
- automatically apply the special round-one cyclic merge through the Core turn-state engine.

The UI deliberately separates ordinary encounter setup from advanced mechanics. Character sheets are not required for manual use. The current running position is browser-session state and is not persisted yet.

Kaiju-specific turn-state mechanics such as Chaos Threshold, Vulnerable Areas, behaviours, Death Throes, and Finishing Blow are not yet implemented. The `kaiju` block type exists so those mechanics can attach to a real special block instead of being folded into a standard enemy block.

## Stack

- .NET 10 / ASP.NET Core
- TypeScript 7
- Vite 8
- Docker
- xUnit

No persistence technology has been selected yet.

## Projects

- `src/BlockInitiative.Core` — deterministic initiative rules and turn-state logic.
- `src/BlockInitiative.Web` — HTTP service, embedded frontend, host integration, and API endpoints.
- `tests/BlockInitiative.Core.Tests` — rules/state unit tests.
- `tests/BlockInitiative.IntegrationTests` — hosting and HTTP contract tests.

## Development endpoints

- `/` — standalone development shell.
- `/app.js` — Embedded Module frontend entry point.
- `/api/initiative/preview` — derive initiative order and turn blocks from manual encounter input.
- `/api/initiative/state` — reconstruct authoritative running encounter state for a given advance count.
- `/health` — service health.
- `/ready` — readiness response.

## Design sources

The block initiative rules are based on `docs/block-initiative-system.md` in the `docs/hybrid-rules-design-notes` branch of the Rules Core repository. The tabletop rule remains the source of truth; implementation guidance in that document is subject to discussion as development continues.

Kaiju integration uses Loot Tavern's public **Kaiju Fighting Lite v1.05** distribution associated with *Ryoko's Guide to the Yokai Realms* as the external rules reference. See `docs/kaiju-integration.md` for the implementation boundary and source link.
