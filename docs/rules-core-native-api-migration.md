# Rules Core live authenticated native API integration

Block Initiative uses the Rules Core **read-only, Site-authenticated, ruleset-scoped** consumer API through the existing Site Tool gateway. The initial ruleset ID is `first-party-001`. Requests never fall back to the retired `/api/rules` or the Wiki-only `/api/private/rulesets` endpoints.

## Contracts

- `GET /api/consumer/v1/rulesets` establishes the loaded ruleset. A user-scoped Site ticket is required. The current catalog fingerprint is returned for version tracking, not as an authorization requirement.
- `GET /api/consumer/v1/rulesets/first-party-001/rules?category=monster&q=...&limit=...&offset=0` searches native monsters.
- Conditions search `condition` and `leveled-condition` independently, then merge results.
- `GET /api/consumer/v1/rulesets/first-party-001/rules/{native-rule-id}` reads a monster. The stat block is nested `rule.definition.definition`.
- New monster template IDs and rules references are `native:<ruleset-id>:<native-rule-id>`. Tracked conditions store native identity separately from encounter-local IDs.
- Restored native template IDs use the same validated detail reader as new selections. Historical source and resolved-rule IDs are preserved but are not requested from removed legacy APIs.
- Native monster Initiative proficiency multipliers use the initial bestiary's CR proficiency scale. Other unsupported combat stats are left blank rather than guessed.

The native API does not provide legacy source revisions, editions, package labels, or browser links; the UI must not synthesize them.

## Authorization and deployment

The existing Site registration gateway authenticates the user and proxies a user-scoped ticket to Rules Core. The authenticated consumer endpoints independently validate that ticket and Site mode. Anonymous requests are denied. Public anonymous catalog publishing remains governed by a **separate** rights/distribution policy; an actively developing native ruleset is not subject to fingerprint approval for signed-in consumer access.

Deploy Rules Core before this Block Initiative migration. Verify the Site gateway using a signed-in account, a native monster lookup, conditions, save/reload, and a content-only update that changes the fingerprint. A green repository test does not substitute for live Site gateway acceptance.
