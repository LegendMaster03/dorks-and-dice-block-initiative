namespace BlockInitiative.Core.Initiative;

internal sealed record TacticalGroupKey(
    string AllianceId,
    TurnBlockType BlockType,
    string TacticalGroupId);
