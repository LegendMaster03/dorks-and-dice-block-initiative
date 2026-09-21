namespace BlockInitiative.Core.Initiative;

/// <summary>
/// Ordinary Block Initiative turn using the standard combatant rules.
/// </summary>
public sealed class StandardTurnBlock : TurnBlock
{
    internal StandardTurnBlock(
        string id,
        string allianceId,
        IEnumerable<string> memberIds,
        IEnumerable<string>? memberOrder = null,
        IEnumerable<string>? sourceBlockIds = null)
        : base(id, allianceId, memberIds, memberOrder, sourceBlockIds)
    {
    }

    public override TurnBlockType BlockType => TurnBlockType.Standard;

    protected override TurnBlock Recreate(IReadOnlyList<string> memberOrder)
        => new StandardTurnBlock(
            Id,
            AllianceId,
            MemberIds,
            memberOrder,
            SourceBlockIds);
}
