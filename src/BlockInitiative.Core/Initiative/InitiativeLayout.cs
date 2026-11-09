namespace BlockInitiative.Core.Initiative;

/// <summary>
/// Result of initiative resolution before encounter turns advance. Retains
/// raw combatants, effective placements, blocks, and unresolved adjudication
/// issues independently so consumers can distinguish facts from presentation.
/// </summary>
public sealed class InitiativeLayout
{
    internal InitiativeLayout(
        IReadOnlyList<CombatantInitiative> combatants,
        IReadOnlyList<InitiativePlacement> placements,
        IReadOnlyList<TurnBlock> blocks,
        CyclicMergePlan? cyclicMerge,
        IReadOnlyList<InitiativeIssue> issues,
        bool usesManualOrderOverride)
    {
        Combatants = combatants;
        Placements = placements;
        Blocks = blocks;
        CyclicMerge = cyclicMerge;
        Issues = issues;
        UsesManualOrderOverride = usesManualOrderOverride;
    }

    public IReadOnlyList<CombatantInitiative> Combatants { get; }

    public IReadOnlyList<InitiativePlacement> Placements { get; }

    public IReadOnlyList<TurnBlock> Blocks { get; }

    public CyclicMergePlan? CyclicMerge { get; }

    public IReadOnlyList<InitiativeIssue> Issues { get; }

    public bool UsesManualOrderOverride { get; }

    public bool RequiresAdjudication => Issues.Count > 0;

    public CombatantInitiative GetCombatant(string combatantId)
    {
        return Combatants.Single(combatant =>
            string.Equals(combatant.Id, combatantId, StringComparison.Ordinal));
    }
}
