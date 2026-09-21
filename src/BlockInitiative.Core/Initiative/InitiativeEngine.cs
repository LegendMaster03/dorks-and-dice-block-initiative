namespace BlockInitiative.Core.Initiative;

public static class InitiativeEngine
{
    public static InitiativeLayout Build(
        IEnumerable<CombatantInitiative> combatants,
        IReadOnlyList<string>? manualOrderOverride = null,
        TacticalGroupInitiativeMode tacticalGroupMode = TacticalGroupInitiativeMode.Individual,
        InitiativeMode mode = InitiativeMode.Block)
    {
        var source = combatants.ToArray();
        ValidateCombatants(source);
        var modeStrategy = InitiativeModeStrategyFactory.Resolve(mode);

        var byId = source.ToDictionary(combatant => combatant.Id, StringComparer.Ordinal);
        var tacticalGroupInitiatives = TacticalGroupInitiativeResolver.BuildInitiatives(
            source,
            tacticalGroupMode);
        var placements = source
            .Select((combatant, index) => new InitiativePlacement(
                combatant,
                ResolveEffectiveInitiative(combatant, byId, tacticalGroupInitiatives),
                index))
            .ToArray();

        var issues = new List<InitiativeIssue>();
        InitiativePlacement[] ordered;

        if (manualOrderOverride is not null)
        {
            ValidateManualOrder(manualOrderOverride, source);
            var placementById = placements.ToDictionary(
                placement => placement.Combatant.Id,
                StringComparer.Ordinal);
            ordered = manualOrderOverride
                .Select(combatantId => placementById[combatantId])
                .ToArray();
        }
        else
        {
            ordered = placements
                .OrderByDescending(placement => placement.EffectiveInitiative)
                .ThenBy(placement => TacticalGroupInitiativeResolver.SortIndex(
                    placement,
                    placements,
                    tacticalGroupMode))
                .ThenBy(placement => placement.SourceIndex)
                .ToArray();

            issues.AddRange(modeStrategy.FindTieIssues(
                ordered,
                tacticalGroupMode));
        }

        var blocks = modeStrategy.BuildTurns(ordered);
        var cyclicMerge = modeStrategy.BuildCyclicMergePlan(blocks);

        return new InitiativeLayout(
            source,
            ordered,
            blocks,
            cyclicMerge,
            issues,
            manualOrderOverride is not null);
    }

    private static decimal ResolveEffectiveInitiative(
        CombatantInitiative combatant,
        IReadOnlyDictionary<string, CombatantInitiative> byId,
        IReadOnlyDictionary<TacticalGroupKey, decimal> tacticalGroupInitiatives)
    {
        if (combatant.ControllerId is not null)
        {
            if (!byId.TryGetValue(combatant.ControllerId, out var controller))
            {
                throw new ArgumentException(
                    $"Combatant '{combatant.Id}' references missing controller '{combatant.ControllerId}'.",
                    nameof(byId));
            }

            if (string.Equals(combatant.Id, controller.Id, StringComparison.Ordinal))
            {
                throw new ArgumentException(
                    $"Combatant '{combatant.Id}' can not control itself.",
                    nameof(byId));
            }

            return controller.InitiativeTotal;
        }

        var tacticalKey = TacticalGroupRules.GetKey(combatant);
        return tacticalKey is not null && tacticalGroupInitiatives.TryGetValue(tacticalKey, out var groupInitiative)
            ? groupInitiative
            : combatant.InitiativeTotal;
    }

    private static void ValidateCombatants(IReadOnlyList<CombatantInitiative> combatants)
    {
        foreach (var combatant in combatants)
        {
            if (string.IsNullOrWhiteSpace(combatant.Id))
            {
                throw new ArgumentException("Every combatant requires an id.", nameof(combatants));
            }

            if (string.IsNullOrWhiteSpace(combatant.Name))
            {
                throw new ArgumentException(
                    $"Combatant '{combatant.Id}' requires a name.",
                    nameof(combatants));
            }

            if (string.IsNullOrWhiteSpace(combatant.AllianceId))
            {
                throw new ArgumentException(
                    $"Combatant '{combatant.Id}' requires an alliance.",
                    nameof(combatants));
            }

            if (combatant.BlockType == TurnBlockType.Mixed)
            {
                throw new ArgumentException(
                    $"Combatant '{combatant.Id}' can not use the derived Mixed block type.",
                    nameof(combatants));
            }
        }

        var duplicateId = combatants
            .GroupBy(combatant => combatant.Id, StringComparer.Ordinal)
            .FirstOrDefault(group => group.Count() > 1)?.Key;

        if (duplicateId is not null)
        {
            throw new ArgumentException(
                $"Combatant id '{duplicateId}' is duplicated.",
                nameof(combatants));
        }
    }

    private static void ValidateManualOrder(
        IReadOnlyList<string> manualOrder,
        IReadOnlyList<CombatantInitiative> combatants)
    {
        var expected = combatants
            .Select(combatant => combatant.Id)
            .ToHashSet(StringComparer.Ordinal);

        if (manualOrder.Count != expected.Count
            || manualOrder.Distinct(StringComparer.Ordinal).Count() != expected.Count
            || !manualOrder.ToHashSet(StringComparer.Ordinal).SetEquals(expected))
        {
            throw new ArgumentException(
                "A manual initiative order override must contain every combatant exactly once.",
                nameof(manualOrder));
        }
    }

}
