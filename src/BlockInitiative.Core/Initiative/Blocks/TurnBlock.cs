namespace BlockInitiative.Core.Initiative;

/// <summary>
/// Core contract for one encounter turn.
///
/// The base class owns invariants shared by every block kind: stable identity,
/// alliance membership, member ordering, and merge provenance. Concrete block
/// modules define the ruleset identity for the turn.
/// </summary>
public abstract class TurnBlock
{
    protected TurnBlock(
        string id,
        string allianceId,
        IEnumerable<string> memberIds,
        IEnumerable<string>? memberOrder = null,
        IEnumerable<string>? sourceBlockIds = null)
    {
        Id = id;
        AllianceId = allianceId;
        MemberIds = memberIds.ToArray();
        MemberOrder = (memberOrder ?? MemberIds).ToArray();
        SourceBlockIds = (sourceBlockIds ?? new[] { id }).ToArray();

        ValidateOrder(MemberOrder);
    }

    public string Id { get; }

    public string AllianceId { get; }

    /// <summary>
    /// Identifies the concrete rules module represented by this turn.
    /// </summary>
    public abstract TurnBlockType BlockType { get; }

    public IReadOnlyList<string> MemberIds { get; }

    public IReadOnlyList<string> MemberOrder { get; }

    public IReadOnlyList<string> SourceBlockIds { get; }

    public bool IsMerged => SourceBlockIds.Count > 1;

    /// <summary>
    /// Returns the same concrete block kind with a different tactical member
    /// order. Underlying initiative facts and block membership are unchanged.
    /// </summary>
    public TurnBlock WithMemberOrder(IEnumerable<string> memberOrder)
    {
        var order = memberOrder.ToArray();
        ValidateOrder(order);
        return Recreate(order);
    }

    internal TurnBlock MergeWith(TurnBlock other)
    {
        if (!string.Equals(AllianceId, other.AllianceId, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                "Only turn blocks belonging to the same side can be merged.");
        }

        return TurnBlockFactory.Create(
            Id,
            AllianceId,
            TurnBlockFactory.CombineTypes(BlockType, other.BlockType),
            MemberIds.Concat(other.MemberIds),
            MemberOrder.Concat(other.MemberOrder),
            SourceBlockIds.Concat(other.SourceBlockIds));
    }

    /// <summary>
    /// Recreates this block as the same concrete module while preserving its
    /// identity, membership, and merge provenance.
    /// </summary>
    protected abstract TurnBlock Recreate(IReadOnlyList<string> memberOrder);

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
