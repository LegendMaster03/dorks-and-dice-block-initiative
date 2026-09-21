namespace BlockInitiative.Core.Initiative;

/// <summary>
/// Core contract for an initiative execution mode.
///
/// InitiativeEngine owns the shared pipeline that validates combatants,
/// resolves effective initiative, and orders placements. A mode module owns
/// only the behavior that genuinely differs: tie policy, turn construction,
/// and optional round-boundary merge planning.
/// </summary>
internal abstract class InitiativeModeStrategy
{
    internal abstract InitiativeMode Mode { get; }

    internal abstract IReadOnlyList<TurnBlock> BuildTurns(
        IReadOnlyList<InitiativePlacement> orderedPlacements);

    internal virtual CyclicMergePlan? BuildCyclicMergePlan(
        IReadOnlyList<TurnBlock> blocks)
        => null;

    internal IEnumerable<InitiativeIssue> FindTieIssues(
        IReadOnlyList<InitiativePlacement> orderedPlacements,
        TacticalGroupInitiativeMode tacticalGroupMode)
    {
        foreach (var tieGroup in orderedPlacements.GroupBy(
                     placement => placement.EffectiveInitiative))
        {
            var tied = tieGroup.ToArray();
            if (tied.Length < 2
                || !RequiresTieAdjudication(tied, tacticalGroupMode))
            {
                continue;
            }

            yield return new InitiativeIssue(
                TieIssueCode,
                TieMessage(tieGroup.Key),
                tied.Select(placement => placement.Combatant.Id).ToArray());
        }
    }

    protected abstract InitiativeIssueCode TieIssueCode { get; }

    protected abstract bool RequiresTieAdjudication(
        IReadOnlyList<InitiativePlacement> tiedPlacements,
        TacticalGroupInitiativeMode tacticalGroupMode);

    protected abstract string TieMessage(decimal initiative);

    protected static TurnBlock CreateTurnBlock(
        int zeroBasedIndex,
        string allianceId,
        TurnBlockType blockType,
        IEnumerable<string> memberIds)
        => TurnBlockFactory.Create(
            $"block-{zeroBasedIndex + 1}",
            allianceId,
            blockType,
            memberIds);
}
