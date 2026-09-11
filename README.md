# Dorks & Dice Block Initiative

Block Initiative is the Dorks & Dice encounter initiative tracker. It is a separately deployable Tool that integrates with the main site as an **Embedded Module** while retaining its own application and service boundaries.

The initial repository scaffold deliberately establishes hosting and development boundaries only. Initiative calculation, encounter persistence, Rules Core integration, campaign/character loading, synchronization, and DM override behavior will be implemented from the Block Initiative design specification rather than inferred during scaffolding.

## Initial stack

- .NET 10 / ASP.NET Core service host
- TypeScript 7 frontend
- Vite 8 frontend build
- Docker
- xUnit unit and hosting-contract tests

No database is selected or required by the initial scaffold.

## Projects

- `BlockInitiative.Core` — deterministic initiative domain/state logic and invariants.
- `BlockInitiative.Web` — HTTP host, Embedded Module entry point, standalone development shell, and future backend APIs.
- `BlockInitiative.Core.Tests` — domain and architectural boundary tests.
- `BlockInitiative.IntegrationTests` — HTTP and hosting-contract tests.
- `src/BlockInitiative.Web/Client` — TypeScript application mounted by the Dorks & Dice Tool Host.

## Development

Requirements:

- .NET 10 SDK
- Node.js 24
- Docker for container validation

The web project builds the TypeScript client automatically when `BuildClient` is enabled. On a fresh checkout it installs the pinned frontend dependencies before building them.

```bash
dotnet restore dorks-and-dice-block-initiative.slnx
dotnet test dorks-and-dice-block-initiative.slnx --configuration Release
dotnet run --project src/BlockInitiative.Web
```

The standalone development shell is served from the application root and mounts the same generated `/app.js` module used by the main site.

## Tool hosting

The production integration target is an Embedded Module. The initial host exposes:

- `/health` — liveness endpoint.
- `/ready` — readiness endpoint.
- `/app.js` — generated ES-module frontend entry point.
- `/` — standalone development shell.
- `/api` — service metadata.

The main Dorks & Dice site remains the production identity, authorization, site-mode, and campaign authority. The Block Initiative backend must use the existing Tool Host ticket/introspection contract when authenticated backend APIs are added; it must not create a second production identity store or infer identity from browser-controlled headers.

See `docs/architecture.md` and `docs/tool-hosting.md` for the scaffold boundaries.

## Design source

Implementation planning is currently based on `docs/block-initiative-system.md` from the Rules Core design-notes branch:

https://github.com/LegendMaster03/dorks-and-dice-rules-core/blob/docs/hybrid-rules-design-notes/docs/block-initiative-system.md

The tabletop rule is the source of truth. Implementation guidance in that document remains subject to design discussion.
