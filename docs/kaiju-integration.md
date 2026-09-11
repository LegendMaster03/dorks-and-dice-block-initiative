# Kaiju block integration

## Canonical rules source

Kaiju support is based on Loot Tavern's official public release of **Kaiju Fighting Lite v1.05**, the standalone public reference for the Kaiju Fighting rules introduced in *Ryoko's Guide to the Yokai Realms*.

Official release page:

https://www.patreon.com/posts/ryokos-kaiju-to-141132181

The repository should link to the creator-hosted public release rather than treating a copied PDF as project-owned content.

## Kaiju is a block type

A Kaiju is not represented merely by assigning a special alliance or by attaching extra metadata to an ordinary enemy block.

Block Initiative needs two separate concepts:

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

This keeps the initiative topology accurate while giving Kaiju turns a dedicated place to expose and operate Kaiju Fighting state.

## Kaiju block responsibilities

The Kaiju block is where Kaiju-specific encounter state and prompts belong. The free rules include concepts the tracker will eventually need to represent, including:

- Chaos Threshold;
- behaviour changes and Rampage triggers;
- Vulnerable Areas and whether each area is currently targetable or exploited;
- Death Throes;
- Finishing Blow tracking;
- creatures mounted on or scaling the Kaiju;
- GM adjudication for unusual or calamitous effects.

These mechanics should be tracked and surfaced by the tool, but the DM remains authoritative and must be able to override state when table rulings require it.

## Initiative relationship

Kaiju blocks still participate in the same cyclic initiative order as other blocks. The base initiative engine determines their position from initiative facts. Block construction then preserves the distinction between standard and Kaiju blocks even when adjacent combatants are allied.

The detailed Kaiju block state machine should be implemented separately from ordinary standard-block turn state. That prevents Kaiju mechanics from complicating normal encounters and prevents ordinary enemy-block assumptions from constraining Kaiju encounters.

## UX direction

Normal encounter setup should remain simple. Kaiju controls should appear only when a combatant/block is explicitly marked as Kaiju. The default setup path should not ask every DM to fill in Chaos Threshold, Vulnerable Areas, or behaviour data for ordinary creatures.
