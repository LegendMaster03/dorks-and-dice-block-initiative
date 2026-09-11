namespace BlockInitiative.Core.Initiative;

/// <summary>
/// A contiguous run in initiative order governed by one block ruleset.
/// MemberOrder is deliberately separate from the combatants' initiative totals
/// so tactical reordering does not falsify the underlying rolls.
/// </summary>
public sealed class TurnBlock
{
    internal TurnBlock(
        string id,
        string allianceId,
        TurnBlockType blockType,
        IEnumerable<string> memberIds,
        IEnumerable<string>? memberOrder = null,
        IEnumerable<string>? sourceBlockIds = null)
    {
        Id = id;
        AllianceId = allianceId;
        BlockType = blockType;
        MemberIds = memberIds.ToArray();
        MemberOrder = (memberOrder ?? MemberIds).ToArray();
        SourceBlockIds = (sourceBlockIds ?? new[] { id }).ToArray();

        ValidateOrder(MemberOrder);
    }

    public string Id { get; }

    public string AllianceId { get; }

    public TurnBlockType BlockType { get; }

    public IReadOnlyList<string> MemberIds { get; }

    public IReadOnlyList<string> MemberOrder { get; }

    public IReadOnlyList<string> SourceBlockIds { get; }

    public bool IsMerged => SourceBlockIds.Count > 1;

    public TurnBlock WithMemberOrder(IEnumerable<string> memberOrder)
    {
        var order = memberOrder.ToArray();
        ValidateOrder(order);

        return new TurnBlock(Id, AllianceId, BlockType, MemberIds, order, SourceBlockIds);
    }

    internal TurnBlock MergeWith(TurnBlock other)
    {
        if (!string.Equals(AllianceId, other.AllianceId, StringComparison.Ordinal)
            || BlockType != other.BlockType)
        {
            throw new InvalidOperationException(
                "Only turn blocks with the same alliance and block type can be merged.");
        }

        return new TurnBlock(
            Id,
            AllianceId,
            BlockType,
            MemberIds.Concat(other.MemberIds),
            MemberOrder.Concat(other.MemberOrder),
            SourceBlockIds.Concat(other.SourceBlockIds));
    }

    private void ValidateOrder(IReadOnlyList<string> order)
    {
        if (order.Count != MemberIds.Count
            || order.Distinct(StringComparer.Ordinal).Count() != MemberIds.Count
            || !order.ToHashSet(StringComparer.Ordinal).SetEquals(MemberIds))
        {
            throw new ArgumentException(
                "A block member order must contain every block member exactly once.",
                nameof(order));
        }
    }
}
