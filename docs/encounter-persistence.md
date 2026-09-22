# Encounter persistence

Block Initiative keeps the active encounter in durable browser storage so an accidental reload, tab close, browser restart, or host-page refresh does not silently discard combat state.

## Lifecycle

- Encounter changes are saved automatically in the current browser profile.
- There is no automatic expiration or reload-time reset.
- The tool restores the saved encounter when it starts again on the same origin.
- The user must choose **Reset encounter** to clear the saved state and return to a blank encounter.
- Reset is intentionally confirmed before the stored encounter is removed.

This persistence is local browser persistence. It is not account synchronization and does not make the main Dorks & Dice site the owner of encounter state. Cross-device or shared campaign encounter storage can be added later as a separate host-backed capability.

## Persisted state

An encounter save is a complete encounter snapshot. The browser snapshot retains the encounter roster and stable combatant IDs, every Standard and Kaiju block, player/enemy/other-side grouping, tactical-group mode, campaign association, initiative preview/manual ordering, current round and active block, per-combatant Acted markers, ordinary HP, complete Kaiju combat state including single-turn Finishing Blow damage and the original defeat round used for Death Rattle timing, tracked condition names/notes and available rule links, and projected Rules Core monster information already handed to the tool.

Legacy saves that used the retired shared-roll tactical-group selector remain supported. During restoration, the saved group roll is projected into the current tactical-group representation so the encounter can resume without changing its effective initiative placement.

Block type is not a persistence filter. A Kaiju block is part of the encounter and is saved/restored with the same completeness requirement as a Standard block.

When a running encounter is restored, Block Initiative rebuilds the roster and initiative preview, starts the encounter, and advances through the deterministic turn-state API until it reaches the saved round and active turn. This keeps the existing application and server initiative engine authoritative rather than introducing a second client-only initiative implementation.

## Boundaries

The storage key is versioned. Unknown or malformed saved data is not silently deleted; the reset control remains the explicit destructive action. Restore failures likewise leave the saved snapshot in place so the user can retry or intentionally reset it.

The implementation uses the explicit Block Initiative render/event lifecycle. It does not add a MutationObserver for application-owned DOM.
