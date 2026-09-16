namespace BlockInitiative.Core.Initiative;

/// <summary>
/// The ruleset represented inside a derived turn block. Alliance / side and
/// member block type remain separate concepts. Mixed is derived only when a
/// contiguous side turn contains both standard and Kaiju members.
/// </summary>
public enum TurnBlockType
{
    Standard,
    Kaiju,
    Mixed
}

/// <summary>
/// Controls whether tactical-group membership affects placement in initiative.
/// The raw initiative total on each combatant is always preserved.
/// </summary>
public enum TacticalGroupInitiativeMode
{
    Individual,
    AverageMemberRolls,
    SharedGroupRoll
}

/// <summary>
/// Selects how ordered initiative placements are converted into encounter turns.
/// Block mode derives contiguous allied blocks and applies the round-boundary
/// merge rule. Standard mode gives every combatant its own turn.
/// </summary>
public enum InitiativeMode
{
    Block,
    Standard
}

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
