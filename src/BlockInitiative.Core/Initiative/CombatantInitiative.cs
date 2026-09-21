namespace BlockInitiative.Core.Initiative;

/// <summary>
/// Raw initiative facts for one combatant. These values are preserved even when
/// controller relationships, tactical-group placement, or DM overrides change
/// the active turn placement.
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
    OpposingTieRequiresAdjudication,
    TieRequiresAdjudication
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
