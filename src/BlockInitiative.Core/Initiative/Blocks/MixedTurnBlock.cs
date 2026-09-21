namespace BlockInitiative.Core.Initiative;

/// <summary>
/// Derived turn containing more than one block rules module. Mixed blocks are
/// created by initiative grouping or cyclic merging and are never a raw
/// combatant type.
/// </summary>
public sealed class MixedTurnBlock : TurnBlock
{
    internal MixedTurnBlock(
        string id,
        string allianceId,
        IEnumerable<string> memberIds,
        IEnumerable<string>? memberOrder = null,
        IEnumerable<string>? sourceBlockIds = null)
        : base(id, allianceId, memberIds, memberOrder, sourceBlockIds)
    {
    }

    public override TurnBlockType BlockType => TurnBlockType.Mixed;

    protected override TurnBlock Recreate(IReadOnlyList<string> memberOrder)
        => new MixedTurnBlock(
            Id,
            AllianceId,
            MemberIds,
            memberOrder,
            SourceBlockIds);
}
