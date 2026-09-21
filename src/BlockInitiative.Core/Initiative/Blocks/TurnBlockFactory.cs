namespace BlockInitiative.Core.Initiative;

/// <summary>
/// Single construction boundary for concrete turn-block modules.
///
/// Adding a new block module should require a concrete TurnBlock subclass and
/// one factory mapping rather than type-conditionals spread through the engine.
/// </summary>
internal static class TurnBlockFactory
{
    internal static TurnBlock Create(
        string id,
        string allianceId,
        TurnBlockType blockType,
        IEnumerable<string> memberIds,
        IEnumerable<string>? memberOrder = null,
        IEnumerable<string>? sourceBlockIds = null)
        => blockType switch
        {
            TurnBlockType.Standard => new StandardTurnBlock(
                id, allianceId, memberIds, memberOrder, sourceBlockIds),
            TurnBlockType.Kaiju => new KaijuTurnBlock(
                id, allianceId, memberIds, memberOrder, sourceBlockIds),
            TurnBlockType.Mixed => new MixedTurnBlock(
                id, allianceId, memberIds, memberOrder, sourceBlockIds),
            _ => throw new ArgumentOutOfRangeException(
                nameof(blockType), blockType, "Unknown turn block type.")
        };

    internal static TurnBlockType CombineTypes(TurnBlockType first, TurnBlockType second)
        => first == second ? first : TurnBlockType.Mixed;
}
