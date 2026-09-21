namespace BlockInitiative.Core.Initiative;

/// <summary>
/// Conventional initiative mode: every combatant receives an independent turn,
/// every unresolved tie requires adjudication, and no cyclic block merge is
/// applied.
/// </summary>
internal sealed class StandardInitiativeModeStrategy : InitiativeModeStrategy
{
    internal override InitiativeMode Mode => InitiativeMode.Standard;

    protected override InitiativeIssueCode TieIssueCode
        => InitiativeIssueCode.TieRequiresAdjudication;

    internal override IReadOnlyList<TurnBlock> BuildTurns(
        IReadOnlyList<InitiativePlacement> orderedPlacements)
        => orderedPlacements
            .Select((placement, index) => CreateTurnBlock(
                index,
                placement.Combatant.AllianceId,
                placement.Combatant.BlockType,
                new[] { placement.Combatant.Id }))
            .ToArray();

    protected override bool RequiresTieAdjudication(
        IReadOnlyList<InitiativePlacement> tiedPlacements,
        TacticalGroupInitiativeMode tacticalGroupMode)
        => tacticalGroupMode == TacticalGroupInitiativeMode.Individual
            || !TacticalGroupRules.BelongToSameGroup(tiedPlacements);

    protected override string TieMessage(decimal initiative)
        => $"Initiative {initiative} is tied. "
            + "The displayed input order is not an adjudicated tie result; "
            + "supply a manual order override before advancing combat.";
}
