# Rules Core native API integration

Block Initiative uses the Rules Core **public, ruleset-scoped, read-only** consumer API through the existing Site Tool gateway. The initial ruleset is `first-party-001`. Requests never fall back to `/api/rules` or `/api/private/rulesets`.

## Contracts

- `GET /api/rulesets` establishes whether the chosen ruleset is publicly readable. An empty list means no approved ruleset is available; manual encounter entry continues to work.
- `GET /api/rulesets/first-party-001/rules?category=monster&q=...&limit=...&offset=0` searches native monsters.
- Conditions search `condition` and `leveled-condition` independently, then merge results.
- `GET /api/rulesets/first-party-001/rules/{native-rule-id}` reads a monster. The stat block is the nested `rule.definition.definition`, not the response envelope and not a resolved `document`.
- New monster template IDs and rules references are `native:<ruleset-id>:<native-rule-id>`. Tracked conditions store the native ruleset and rule IDs separately from their encounter-local condition IDs.

The native API has no `browserLink`, source revisions, packages, edition labels, or campaign-effective projections. The UI must not fabricate them. Older encounter references and browser links are retained as historical metadata; they are not assumed to identify the same native rule. Already saved encounter combat stats remain usable without re-querying Rules Core.

## Deployment dependency

The public API only publishes a ruleset if its catalog snapshot passes Rules Core's package-wide distribution gate. Native promotion and successful private Wiki access do not satisfy this requirement. A deployment without public approval displays manual-entry fallbacks, rather than attempting to bypass the gate with private Wiki tickets. The API migration alone does not authorize production deployment or publication.

## Verification

The frontend native API contract tests cover monster and leveled-condition search, nested native stat-block projection, absent public approval, invalid/mismatched rule details, and query validation. Full embedded-Site acceptance still requires a deployed approved ruleset and a working Tool Host gateway.
