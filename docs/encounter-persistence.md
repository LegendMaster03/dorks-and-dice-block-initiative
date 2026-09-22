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

An encounter save is a complete encounter snapshot. The browser snapshot retains the encounter roster and stable combatant IDs, every Standard and Kaiju block, player/enemy/other-side grouping, tactical-group mode, Block/Standard initiative mode, campaign association, initiative preview/manual ordering, combatant-reorder baseline and undo history, current round and active block, per-combatant Acted history by round, ordinary HP, complete Kaiju combat state including Finishing Blow damage keyed by turn and the original defeat round used for Death Rattle timing, tracked condition names/levels/notes plus durable Rules Core identity and links, and projected Rules Core monster information already handed to the tool.

Legacy saves that used the retired shared-roll tactical-group selector remain supported. During restoration, the saved group roll is projected into the current tactical-group representation so the encounter can resume without changing its effective initiative placement.

Block type is not a persistence filter. A Kaiju block is part of the encounter and is saved/restored with the same completeness requirement as a Standard block.

When a running encounter is restored, Block Initiative rebuilds the roster and initiative preview, starts the encounter, and advances through the deterministic turn-state API until it reaches the saved round and active turn. This keeps the existing application and server initiative engine authoritative rather than introducing a second client-only initiative implementation.

## Boundaries

The current storage schema is version 3. Version 1 and version 2 automatic and named saves are normalized into the version 3 model on read, including inferred initiative mode, single-round Acted markers, legacy condition links, and safe defaults for newer runtime fields. Current writes use version 3 storage keys while version 1 and version 2 keys remain readable for migration.

Stored data is normalized before restoration. Malformed roster, preview, block, or turn-state structures are not passed through to the encounter runner. Unknown or malformed saved data is not silently deleted; the reset control remains the explicit destructive action. Restore failures likewise leave the saved snapshot in place so the user can retry or intentionally reset it.

The implementation uses the explicit Block Initiative render/event lifecycle. It does not add a MutationObserver for application-owned DOM.
