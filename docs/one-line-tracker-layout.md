# One-line tracker row behavior

Standard encounter setup is optimized for fast DM entry rather than card-style editing.

- Standard player and enemy combatants use one primary row on desktop.
- Name receives the largest width; initiative modifier, initiative, HP, adjustment, and actions use compact fixed-purpose widths.
- Standard enemy HP is shown as `Current / Max`, followed by one adjustment value and `−` / `+` actions.
- Players retain an optional Roll action beside initiative, but manual player initiative is the expected default workflow.
- Individual enemy mode has no visible manual tactical-group concept.
- Tactical groups can roll each member separately as `d20 + modifier` and average the adjusted totals.
- A tactical group can alternatively use **Single roll**, which applies one d20 plus the group's highest initiative modifier to every member before normal grouped placement is calculated.
- Individual placement keeps each non-player creature separate.
- Empty tactical groups report `not rolled` rather than treating blank initiatives as zero.
- Legacy encounter saves that used the retired shared-roll selector are migrated to the current tactical-group representation during restore.

At narrower viewport widths, enemy HP may move to a subsequent line to preserve usable input sizes.