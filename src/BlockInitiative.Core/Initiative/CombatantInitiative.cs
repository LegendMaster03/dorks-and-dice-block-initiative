namespace BlockInitiative.Core.Initiative;

/// <summary>
/// The ruleset governing a derived turn block. Alliance and block type are
/// deliberately separate: a Kaiju can belong to the enemies alliance while
/// still occupying a Kaiju block rather than a standard enemy block.
/// </summary>
public enum TurnBlockType
{
    Standard,
    Kaiju
}

/// <summary>
/// Raw initiative facts for one combatant. These values are preserved even when
/// controller relationships or DM overrides change the active turn placement.
/// </summary>
public sealed record CombatantInitiative(
    string Id,
    string Name,
    string AllianceId,
    decimal InitiativeTotal,
    decimal? InitiativeModifier = null,
    string? ControllerId = null,
    string? TacticalGroupId = null,
    TurnBlockType BlockType = TurnBlockType.Standard);

public sealed record InitiativePlacement(
    CombatantInitiative Combatant,
    decimal EffectiveInitiative,
    int SourceIndex);

public enum InitiativeIssueCode
{
    OpposingTieRequiresAdjudication
}

public sealed record InitiativeIssue(
    InitiativeIssueCode Code,
    string Message,
    IReadOnlyList<string> CombatantIds);

public sealed record CyclicMergePlan(
    string TopBlockId,
    string BottomBlockId,
    string AllianceId,
    TurnBlockType BlockType);
