# Dorks & Dice Block Initiative

Block Initiative is a separately deployable Dorks & Dice Tool for building and eventually running the house-rule block initiative system used at the table.

The production integration type is **Embedded Module**. The Dorks & Dice site owns the outer page shell, identity, campaign authority, Tool registration, and routing. Block Initiative owns the encounter workspace rendered inside the host's `#tool-root`.

## Current development slice

The current implementation establishes the initiative engine and a manual encounter setup workflow. A DM can:

- add players and enemies using only a name and initiative result;
- add Kaiju as a distinct turn block type;
- add additional encounter sides when needed;
- optionally record controller relationships and metadata;
- derive contiguous allied turn blocks without changing the original initiative rolls;
- see the cyclic top/bottom merge explained as round-one and round-two behavior;
- resolve opposing-side initiative ties explicitly without inventing a house rule.

The UI deliberately separates ordinary encounter setup from advanced mechanics. Character sheets are not required for manual use.

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
- `/health` — service health.
- `/ready` — readiness response.

## Design sources

The block initiative rules are based on `docs/block-initiative-system.md` in the `docs/hybrid-rules-design-notes` branch of the Rules Core repository. The tabletop rule remains the source of truth; implementation guidance in that document is subject to discussion as development continues.

Kaiju integration uses Loot Tavern's public **Kaiju Fighting Lite v1.05** distribution associated with *Ryoko's Guide to the Yokai Realms* as the external rules reference. See `docs/kaiju-integration.md` for the implementation boundary and source link.
