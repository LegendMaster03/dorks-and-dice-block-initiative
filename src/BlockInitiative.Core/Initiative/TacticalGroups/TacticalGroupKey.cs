namespace BlockInitiative.Core.Initiative;

/// <summary>
/// Identifies a tactical group within its alliance and block rules module.
/// Group names alone are not sufficient to merge unrelated combatants.
/// </summary>
internal sealed record TacticalGroupKey(
    string AllianceId,
    TurnBlockType BlockType,
    string TacticalGroupId);
