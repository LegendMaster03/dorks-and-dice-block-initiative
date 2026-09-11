using BlockInitiative.Core.Combat;

namespace BlockInitiative.Web.Combat;

public static class KaijuTrackingEndpoints
{
    public static IEndpointRouteBuilder MapKaijuTrackingEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/kaiju/evaluate", Evaluate);
        return endpoints;
    }

    private static IResult Evaluate(KaijuEvaluationRequest request)
    {
        if (request.VulnerableAreas is null)
        {
            return Results.BadRequest(new { error = "Vulnerable Areas are required." });
        }

        try
        {
            var state = new KaijuCombatState(
                request.ChaosThresholdCurrent,
                request.FinishingBlowTarget,
                request.FinishingBlowDamageThisTurn,
                request.VulnerableAreas.Select(area => new KaijuVulnerableAreaState(
                    area.Id,
                    area.Name,
                    area.CurrentHitPoints,
                    area.Targetable,
                    area.ExploitedOverride)).ToArray(),
                request.RampageOverride,
                request.DeathThroesOverride,
                request.DefeatedOverride);

            var evaluation = KaijuCombatRules.Evaluate(state);
            return Results.Ok(evaluation);
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new { error = exception.Message });
        }
    }
}

public sealed record KaijuEvaluationRequest(
    int ChaosThresholdCurrent,
    int? FinishingBlowTarget,
    int FinishingBlowDamageThisTurn,
    IReadOnlyList<KaijuVulnerableAreaRequest>? VulnerableAreas,
    bool? RampageOverride = null,
    bool? DeathThroesOverride = null,
    bool? DefeatedOverride = null);

public sealed record KaijuVulnerableAreaRequest(
    string Id,
    string Name,
    int CurrentHitPoints,
    bool Targetable,
    bool? ExploitedOverride = null);
