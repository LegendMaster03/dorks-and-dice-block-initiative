namespace BlockInitiative.Core.Initiative;

/// <summary>
/// Turn containing only Kaiju combatants. Kaiju-specific turn behavior belongs
/// in this module rather than in generic initiative orchestration.
/// </summary>
public sealed class KaijuTurnBlock : TurnBlock
{
    internal KaijuTurnBlock(
        string id,
        string allianceId,
        IEnumerable<string> memberIds,
        IEnumerable<string>? memberOrder = null,
        IEnumerable<string>? sourceBlockIds = null)
        : base(id, allianceId, memberIds, memberOrder, sourceBlockIds)
    {
    }

    public override TurnBlockType BlockType => TurnBlockType.Kaiju;

    protected override TurnBlock Recreate(IReadOnlyList<string> memberOrder)
        => new KaijuTurnBlock(
            Id,
            AllianceId,
            MemberIds,
            memberOrder,
            SourceBlockIds);
}
