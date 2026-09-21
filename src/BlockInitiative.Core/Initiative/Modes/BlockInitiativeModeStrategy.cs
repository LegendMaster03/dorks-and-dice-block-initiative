namespace BlockInitiative.Core.Initiative;

/// <summary>
/// Dorks & Dice Block Initiative mode: contiguous allied placements share a
/// turn, opposing ties require adjudication, and allied top/bottom turns may
/// merge at the round-one boundary.
/// </summary>
internal sealed class BlockInitiativeModeStrategy : InitiativeModeStrategy
{
    internal override InitiativeMode Mode => InitiativeMode.Block;

    protected override InitiativeIssueCode TieIssueCode
        => InitiativeIssueCode.OpposingTieRequiresAdjudication;

    internal override IReadOnlyList<TurnBlock> BuildTurns(
        IReadOnlyList<InitiativePlacement> orderedPlacements)
    {
        if (orderedPlacements.Count == 0)
        {
            return Array.Empty<TurnBlock>();
        }

        var blocks = new List<TurnBlock>();
        var memberIds = new List<string>();
        var allianceId = orderedPlacements[0].Combatant.AllianceId;
        var blockType = orderedPlacements[0].Combatant.BlockType;

        foreach (var placement in orderedPlacements)
        {
            if (!string.Equals(
                    allianceId,
                    placement.Combatant.AllianceId,
                    StringComparison.Ordinal))
            {
                blocks.Add(CreateTurnBlock(
                    blocks.Count,
                    allianceId,
                    blockType,
                    memberIds));
                memberIds = new List<string>();
                allianceId = placement.Combatant.AllianceId;
                blockType = placement.Combatant.BlockType;
            }
            else
            {
                blockType = TurnBlockFactory.CombineTypes(
                    blockType,
                    placement.Combatant.BlockType);
            }

            memberIds.Add(placement.Combatant.Id);
        }

        blocks.Add(CreateTurnBlock(
            blocks.Count,
            allianceId,
            blockType,
            memberIds));

        return blocks;
    }

    internal override CyclicMergePlan? BuildCyclicMergePlan(
        IReadOnlyList<TurnBlock> blocks)
    {
        if (blocks.Count < 2)
        {
            return null;
        }

        var top = blocks[0];
        var bottom = blocks[^1];
        if (!string.Equals(top.AllianceId, bottom.AllianceId, StringComparison.Ordinal))
        {
            return null;
        }

        return new CyclicMergePlan(
            top.Id,
            bottom.Id,
            top.AllianceId,
            TurnBlockFactory.CombineTypes(top.BlockType, bottom.BlockType));
    }

    protected override bool RequiresTieAdjudication(
        IReadOnlyList<InitiativePlacement> tiedPlacements,
        TacticalGroupInitiativeMode tacticalGroupMode)
        => tiedPlacements
            .Select(placement => placement.Combatant.AllianceId)
            .Distinct(StringComparer.Ordinal)
            .Skip(1)
            .Any();

    protected override string TieMessage(decimal initiative)
        => $"Initiative {initiative} is tied across opposing alliances. "
            + "The displayed input order is not an adjudicated tie result; "
            + "supply a manual order override before advancing combat.";
}
