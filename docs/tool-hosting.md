# Dorks & Dice Tool Host integration

Block Initiative uses the existing `dorks-and-dice-site` Tool system as an **Embedded Module**.

## Frontend hosting

The main site owns the page shell and imports the Tool's generated ES module through the configured Tool module route. The module mounts into `#tool-root` and reads the host-context endpoint from `data-tool-context-url`.

The frontend may contain an arbitrarily rich TypeScript application. Embedded hosting does not require initiative logic or encounter state to live in the main site repository.

The Tool also exposes a standalone development shell at `/` that mounts the same `/app.js` entry point without requiring the Dorks & Dice site.

## Host context

When embedded, the browser can request the supplied Tool Host context endpoint. That contract supplies the Tool slug, current site mode, Tool Host API base URL, and the current user summary when authenticated.

Campaign-aware UI queries the authenticated Tool Host API rather than reaching into the main site's storage.

### Campaign roster integration

Campaign integration is optional. Anonymous hosted sessions and standalone development continue to support the full manual encounter workflow.

For a signed-in hosted user, Block Initiative uses:

```text
GET /tool-host/{slug}/api/campaigns
GET /tool-host/{slug}/api/campaigns/{campaignId}/context
```

The first endpoint supplies the active campaigns visible to the current account. The second supplies the site's stable campaign projection: all roles held by the requesting account, active table participants, and active campaign-linked characters.

Block Initiative treats those concepts separately:

- campaign membership and roles describe authority;
- participants describe people at the table and may not have accounts or characters;
- linked characters are the records that can be added directly to the player combatant roster.

Selecting a campaign does not replace manual encounter data. The **Add campaign characters** action adds missing active linked characters to the player roster while preserving existing manually entered combatants. Imported cards retain their campaign and character IDs as integration metadata so later persistence or character synchronization can use stable identities instead of display-name matching.

The selected campaign ID is also exposed on `#tool-root` as `data-campaign-id`, and Block Initiative dispatches `block-initiative:campaign-change` when the selected campaign context changes. These are frontend integration boundaries, not authorization boundaries.

Encounter persistence is not implemented by this integration slice. Campaign selection and roster loading do not imply that the encounter is saved to the campaign.

## Authenticated backend APIs

Authenticated backend operations must go through the main site's Tool gateway:

```text
/tool-host/{slug}/api/upstream/{tool-backend-path}
```

The host authenticates the browser and injects a short-lived, one-time Tool authentication ticket. The backend must redeem that ticket through the fixed introspection contract before treating the request as authenticated.

Browser Cookie and Authorization headers are not forwarded. Arbitrary identity headers must not be trusted. Block Initiative must not mount the main site's Identity storage or create a parallel production account system.

## Transport constraints

The current Tool Host does not support:

- Tool-owned cookie sessions;
- WebSocket upgrades;
- redirect rewriting/following for Tool traffic; or
- a dependable indefinite SSE/streaming contract.

Normal HTTP request/response APIs are the initial integration contract.
