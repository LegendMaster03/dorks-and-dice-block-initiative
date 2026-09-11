namespace BlockInitiative.Core.Initiative;

public static class InitiativeEngine
{
    public static InitiativeLayout Build(
        IEnumerable<CombatantInitiative> combatants,
        IReadOnlyList<string>? manualOrderOverride = null)
    {
        var source = combatants.ToArray();
        ValidateCombatants(source);

        var byId = source.ToDictionary(combatant => combatant.Id, StringComparer.Ordinal);
        var placements = source
            .Select((combatant, index) => new InitiativePlacement(
                combatant,
                ResolveEffectiveInitiative(combatant, byId),
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
                .ThenBy(placement => placement.SourceIndex)
                .ToArray();

            issues.AddRange(FindOpposingTieIssues(ordered));
        }

        var blocks = BuildBlocks(ordered);
        var cyclicMerge = BuildCyclicMergePlan(blocks);

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
        IReadOnlyDictionary<string, CombatantInitiative> byId)
    {
        if (combatant.ControllerId is null)
        {
            return combatant.InitiativeTotal;
        }

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

    private static IReadOnlyList<TurnBlock> BuildBlocks(
        IReadOnlyList<InitiativePlacement> ordered)
    {
        if (ordered.Count == 0)
        {
            return Array.Empty<TurnBlock>();
        }

        var blocks = new List<TurnBlock>();
        var memberIds = new List<string>();
        var allianceId = ordered[0].Combatant.AllianceId;

        foreach (var placement in ordered)
        {
            if (!string.Equals(
                    allianceId,
                    placement.Combatant.AllianceId,
                    StringComparison.Ordinal))
            {
                blocks.Add(CreateBlock(blocks.Count, allianceId, memberIds));
                memberIds = new List<string>();
                allianceId = placement.Combatant.AllianceId;
            }

            memberIds.Add(placement.Combatant.Id);
        }

        blocks.Add(CreateBlock(blocks.Count, allianceId, memberIds));
        return blocks;
    }

    private static TurnBlock CreateBlock(
        int zeroBasedIndex,
        string allianceId,
        IEnumerable<string> memberIds)
    {
        return new TurnBlock(
            $"block-{zeroBasedIndex + 1}",
            allianceId,
            memberIds);
    }

    private static CyclicMergePlan? BuildCyclicMergePlan(
        IReadOnlyList<TurnBlock> blocks)
    {
        if (blocks.Count < 2)
        {
            return null;
        }

        var top = blocks[0];
        var bottom = blocks[^1];

        return string.Equals(top.AllianceId, bottom.AllianceId, StringComparison.Ordinal)
            ? new CyclicMergePlan(top.Id, bottom.Id, top.AllianceId)
            : null;
    }

    private static IEnumerable<InitiativeIssue> FindOpposingTieIssues(
        IReadOnlyList<InitiativePlacement> ordered)
    {
        foreach (var tieGroup in ordered.GroupBy(placement => placement.EffectiveInitiative))
        {
            var tied = tieGroup.ToArray();
            if (tied.Length < 2)
            {
                continue;
            }

            var alliances = tied
                .Select(placement => placement.Combatant.AllianceId)
                .Distinct(StringComparer.Ordinal)
                .ToArray();

            if (alliances.Length < 2)
            {
                continue;
            }

            yield return new InitiativeIssue(
                InitiativeIssueCode.OpposingTieRequiresAdjudication,
                $"Initiative {tieGroup.Key} is tied across opposing alliances. "
                + "The displayed input order is not an adjudicated tie result; "
                + "supply a manual order override before advancing combat.",
                tied.Select(placement => placement.Combatant.Id).ToArray());
        }
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
