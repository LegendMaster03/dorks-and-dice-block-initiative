# Kaiju block integration

## Canonical rules source

Kaiju support is based on Loot Tavern's official public release of **Kaiju Fighting Lite v1.05**, the standalone public reference for the Kaiju Fighting rules introduced in *Ryoko's Guide to the Yokai Realms*.

Official release page:

https://www.patreon.com/posts/ryokos-kaiju-to-141132181

The repository links to the creator-hosted public release rather than redistributing the PDF.

## Kaiju is a block type

A Kaiju is not represented merely by assigning a special alliance or by attaching extra metadata to an ordinary enemy block.

```text
Alliance / side
    players
    enemies
    neutral / arbitrary other sides

Turn block type
    standard
    kaiju
    future special block types
```

A Kaiju can therefore belong to the `enemies` alliance while occupying a `kaiju` turn block. It must not collapse into an adjacent standard enemy block solely because the combatants share an alliance.

## Damage model

Standard enemies can use ordinary current/max HP tracking in the encounter dashboard.

Kaiju deliberately do **not** use that ordinary HP tracker. The public Kaiju Fighting rules instead require separate tracking for:

- the Kaiju's **Chaos Threshold**;
- each **Vulnerable Area**, with its own HP pool;
- whether each Vulnerable Area is currently targetable;
- whether each Vulnerable Area is exploited;
- the current Behaviour or table-facing phase;
- **Rampage** state;
- **Death Throes**;
- the stat block's **Finishing Blow** value and damage dealt during the current turn;
- the post-defeat **Death Rattle** reminder.

Damage to the Kaiju outside a Vulnerable Area reduces the Chaos Threshold. Reaching 0 normally activates Rampage. A Vulnerable Area is normally exploited when its HP reaches 0, although the DM can override this for exceptional rulings such as calamitous damage or creature-specific rules. When all Vulnerable Areas are exploited, the Kaiju enters Death Throes. A Finishing Blow succeeds only during Death Throes and only when the configured Finishing Blow damage is reached in a single turn.

The tracker preserves raw values separately from derived state. DM overrides can force Rampage, Death Throes, exploitation, or defeat state without rewriting the underlying Chaos Threshold or Vulnerable Area HP values.

## Behaviour versus phase

The Kaiju Fighting rules describe **Behaviours** that can activate from different triggers and are not universally an ordered phase ladder. The UI therefore uses **Behaviour / phase** as a free table-facing field rather than assuming every Kaiju follows phase 1, phase 2, phase 3.

## Initiative relationship

Kaiju blocks still participate in the same cyclic initiative order as other blocks. The base initiative engine determines their position from initiative facts. Block construction preserves the distinction between standard and Kaiju blocks even when adjacent combatants are allied.

Kaiju combat-state derivation is implemented separately from ordinary initiative traversal so Kaiju rules do not complicate normal encounters.

## Persistence

Health and Kaiju combat values are currently encounter-session state in the browser. They survive block advancement during the active page session but are not yet persisted across refreshes. Persistence remains a separate design decision so this feature does not accidentally create a second source of truth for player character sheets or lock the project into a database model prematurely.

## UX direction

Normal encounter setup remains simple. Standard enemy HP appears only for non-player standard combatants. Kaiju controls appear only when a combatant is explicitly marked as Kaiju. During encounter running, ordinary enemy HP and Kaiju state remain visible even when another block is active so the DM can record damage whenever it occurs.
