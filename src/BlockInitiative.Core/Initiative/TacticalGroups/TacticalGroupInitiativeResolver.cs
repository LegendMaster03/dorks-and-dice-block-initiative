namespace BlockInitiative.Core.Initiative;

/// <summary>
/// Calculates effective initiative values and stable sort grouping for tactical
/// groups. InitiativeEngine consumes the result without knowing the details of
/// each tactical-group calculation mode.
/// </summary>
internal static class TacticalGroupInitiativeResolver
{
    internal static IReadOnlyDictionary<TacticalGroupKey, decimal> BuildInitiatives(
        IReadOnlyList<CombatantInitiative> combatants,
        TacticalGroupInitiativeMode mode)
    {
        if (mode == TacticalGroupInitiativeMode.Individual)
        {
            return new Dictionary<TacticalGroupKey, decimal>();
        }

        var result = new Dictionary<TacticalGroupKey, decimal>();
        var groups = combatants
            .Where(combatant => combatant.ControllerId is null)
            .Select(combatant => new
            {
                Combatant = combatant,
                Key = TacticalGroupRules.GetKey(combatant)
            })
            .Where(candidate => candidate.Key is not null)
            .GroupBy(candidate => candidate.Key!);

        foreach (var group in groups)
        {
            var members = group.Select(candidate => candidate.Combatant).ToArray();
            result[group.Key] = mode switch
            {
                TacticalGroupInitiativeMode.AverageMemberRolls
                    => members.Average(member => member.InitiativeTotal),
                TacticalGroupInitiativeMode.SharedGroupRoll
                    => SharedRoll(group.Key, members, combatants),
                _ => throw new ArgumentOutOfRangeException(
                    nameof(mode), mode, "Unknown tactical-group initiative mode.")
            };
        }

        return result;
    }

    internal static int SortIndex(
        InitiativePlacement placement,
        IReadOnlyList<InitiativePlacement> placements,
        TacticalGroupInitiativeMode mode)
    {
        if (mode == TacticalGroupInitiativeMode.Individual)
        {
            return placement.SourceIndex;
        }

        var key = TacticalGroupRules.GetKey(placement.Combatant);
        if (key is null || placement.Combatant.ControllerId is not null)
        {
            return placement.SourceIndex;
        }

        return placements
            .Where(candidate => candidate.Combatant.ControllerId is null
                && Equals(TacticalGroupRules.GetKey(candidate.Combatant), key))
            .Min(candidate => candidate.SourceIndex);
    }

    private static decimal SharedRoll(
        TacticalGroupKey key,
        IReadOnlyList<CombatantInitiative> members,
        IReadOnlyList<CombatantInitiative> source)
    {
        var distinctRolls = members
            .Select(member => member.InitiativeTotal)
            .Distinct()
            .ToArray();

        if (distinctRolls.Length != 1)
        {
            throw new ArgumentException(
                $"Tactical group '{key.TacticalGroupId}' uses one shared roll, "
                + "but its members do not have the same initiative total.",
                nameof(source));
        }

        return distinctRolls[0];
    }
}
