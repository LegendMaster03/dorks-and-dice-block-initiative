namespace BlockInitiative.Core.Combat;

public sealed record KaijuVulnerableAreaState(
    string Id,
    string Name,
    int CurrentHitPoints,
    bool Targetable,
    bool? ExploitedOverride = null);

public sealed record KaijuCombatState(
    int ChaosThresholdCurrent,
    int? FinishingBlowTarget,
    int FinishingBlowDamageThisTurn,
    IReadOnlyList<KaijuVulnerableAreaState> VulnerableAreas,
    bool? RampageOverride = null,
    bool? DeathThroesOverride = null,
    bool? DefeatedOverride = null);

public sealed record KaijuVulnerableAreaEvaluation(
    string Id,
    string Name,
    int CurrentHitPoints,
    bool Targetable,
    bool Exploited,
    bool UsedOverride);

public sealed record KaijuCombatEvaluation(
    bool RampageActive,
    bool DeathThroesActive,
    bool FinishingBlowReady,
    bool FinishingBlowMet,
    bool Defeated,
    IReadOnlyList<KaijuVulnerableAreaEvaluation> VulnerableAreas);

/// <summary>
/// Deterministic state derivation for the public Kaiju Fighting rules.
/// Raw tracker values remain separate from the derived states so the DM can
/// override exceptional table rulings without destroying the underlying facts.
/// </summary>
public static class KaijuCombatRules
{
    public static KaijuCombatEvaluation Evaluate(KaijuCombatState state)
    {
        ArgumentNullException.ThrowIfNull(state);
        ArgumentNullException.ThrowIfNull(state.VulnerableAreas);

        if (state.FinishingBlowTarget is <= 0)
        {
            throw new ArgumentException(
                "Finishing Blow target must be greater than zero when configured.",
                nameof(state));
        }

        if (state.FinishingBlowDamageThisTurn < 0)
        {
            throw new ArgumentException(
                "Finishing Blow damage this turn can not be negative.",
                nameof(state));
        }

        var seenAreaIds = new HashSet<string>(StringComparer.Ordinal);
        var evaluatedAreas = new List<KaijuVulnerableAreaEvaluation>(state.VulnerableAreas.Count);

        foreach (var area in state.VulnerableAreas)
        {
            if (string.IsNullOrWhiteSpace(area.Id))
            {
                throw new ArgumentException("Every Vulnerable Area needs an id.", nameof(state));
            }

            if (!seenAreaIds.Add(area.Id))
            {
                throw new ArgumentException(
                    $"Duplicate Vulnerable Area id '{area.Id}'.",
                    nameof(state));
            }

            if (string.IsNullOrWhiteSpace(area.Name))
            {
                throw new ArgumentException("Every Vulnerable Area needs a name.", nameof(state));
            }

            var exploited = area.ExploitedOverride ?? area.CurrentHitPoints <= 0;
            evaluatedAreas.Add(new KaijuVulnerableAreaEvaluation(
                area.Id,
                area.Name,
                area.CurrentHitPoints,
                area.Targetable,
                exploited,
                area.ExploitedOverride.HasValue));
        }

        var rampageActive = state.RampageOverride ?? state.ChaosThresholdCurrent <= 0;
        var allAreasExploited = evaluatedAreas.Count > 0 && evaluatedAreas.All(area => area.Exploited);
        var deathThroesActive = state.DeathThroesOverride ?? allAreasExploited;
        var finishingBlowReady = deathThroesActive && state.FinishingBlowTarget.HasValue;
        var finishingBlowMet = finishingBlowReady
            && state.FinishingBlowDamageThisTurn >= state.FinishingBlowTarget!.Value;
        var defeated = state.DefeatedOverride ?? finishingBlowMet;

        return new KaijuCombatEvaluation(
            rampageActive,
            deathThroesActive,
            finishingBlowReady,
            finishingBlowMet,
            defeated,
            evaluatedAreas);
    }
}
