# Dorks & Dice Tool Host integration

Block Initiative uses the existing `dorks-and-dice-site` Tool system as an **Embedded Module**.

## Frontend hosting

The main site owns the page shell and imports the Tool's generated ES module through the configured Tool module route. The module mounts into `#tool-root` and reads the host-context endpoint from `data-tool-context-url`.

The frontend may contain an arbitrarily rich TypeScript application. Embedded hosting does not require initiative logic or encounter state to live in the main site repository.

The Tool also exposes a standalone development shell at `/` that mounts the same `/app.js` entry point without requiring the Dorks & Dice site.

## Host context

When embedded, the browser can request the supplied Tool Host context endpoint. That contract supplies the Tool slug, current site mode, Tool Host API base URL, and the current user summary when authenticated.

Future campaign-aware UI should query the authenticated Tool Host API rather than reaching into the main site's storage.

## Authenticated backend APIs

When Block Initiative gains authenticated backend operations, the browser must call them through the main site's authenticated Tool gateway:

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
