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

## Raw facts and derived state

The design document distinguishes underlying initiative facts from derived block/round state. The implementation should preserve that distinction. The exact domain types and state machine are intentionally not created in this scaffold so unresolved edge cases are not silently encoded as rules.

## Persistence

No persistence technology is selected by the scaffold. Encounter storage requirements need to be established before choosing PostgreSQL, another service, or a different persistence model.

## Real-time synchronization

The current Tool Host does not support WebSocket upgrades and does not provide a dependable indefinite-stream/SSE contract. Multi-device encounter synchronization therefore remains a separate design decision. The initial architecture must not assume that a live socket transport is available through the Tool Host.

## Rules Core

Block Initiative is expected to consume rules information rather than own the broader hybrid-rules corpus. The integration contract with Rules Core will be designed when the tracker requires concrete rules data. Block construction itself remains an initiative concern and should not become coupled to Rules Core storage internals.
