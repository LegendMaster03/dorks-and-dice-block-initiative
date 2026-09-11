# One-line tracker row behavior

Standard encounter setup is optimized for fast DM entry rather than card-style editing.

- Standard player and enemy combatants use one primary row on desktop.
- Name receives the largest width; initiative modifier, initiative, HP, adjustment, and actions use compact fixed-purpose widths.
- Standard enemy HP is shown as `Current / Max`, followed by one adjustment value and `−` / `+` actions.
- Players retain an optional Roll action beside initiative, but manual player initiative is the expected default workflow.
- Individual enemy mode has no visible manual tactical-group concept.
- Average tactical-group mode gives each member its own `d20 + modifier` roll, then averages the adjusted totals.
- Shared tactical-group mode has one group d20 Roll action. Member initiative totals are calculated from that group roll plus each member modifier and are read-only while the mode is active.
- Empty tactical groups report `not rolled` rather than treating blank initiatives as zero.

At narrower viewport widths, enemy HP may move to a subsequent line to preserve usable input sizes.