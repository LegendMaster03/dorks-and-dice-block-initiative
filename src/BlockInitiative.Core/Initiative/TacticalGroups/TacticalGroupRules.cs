namespace BlockInitiative.Core.Initiative;

/// <summary>
/// Shared tactical-group identity rules used by initiative placement and mode
/// modules. Calculation policy remains in InitiativeEngine.
/// </summary>
internal static class TacticalGroupRules
{
    internal static TacticalGroupKey? GetKey(CombatantInitiative combatant)
        => string.IsNullOrWhiteSpace(combatant.TacticalGroupId)
            ? null
            : new TacticalGroupKey(
                combatant.AllianceId,
                combatant.BlockType,
                combatant.TacticalGroupId.Trim());

    internal static bool BelongToSameGroup(IReadOnlyList<InitiativePlacement> placements)
    {
        if (placements.Count == 0)
        {
            return false;
        }

        var key = GetKey(placements[0].Combatant);
        return key is not null
            && placements.All(placement => Equals(GetKey(placement.Combatant), key));
    }
}
