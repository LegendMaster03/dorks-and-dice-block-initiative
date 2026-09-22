using System.Text.Json;
using BlockInitiative.Core.Combat;
using BlockInitiative.Web.Validation;

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
                NumericInputLimits.RequiredInteger(
                    request.ChaosThresholdCurrent,
                    "Chaos Threshold",
                    NumericInputLimits.TrackerMinimum,
                    NumericInputLimits.TrackerMaximum),
                NumericInputLimits.OptionalInteger(
                    request.FinishingBlowTarget,
                    "Finishing Blow target",
                    1,
                    NumericInputLimits.TrackerMaximum),
                NumericInputLimits.RequiredInteger(
                    request.FinishingBlowDamageThisTurn,
                    "Finishing Blow damage this turn",
                    NumericInputLimits.NonNegativeTrackerMinimum,
                    NumericInputLimits.TrackerMaximum),
                request.VulnerableAreas.Select(area => new KaijuVulnerableAreaState(
                    area.Id,
                    area.Name,
                    NumericInputLimits.RequiredInteger(
                        area.CurrentHitPoints,
                        "Vulnerable Area current HP",
                        NumericInputLimits.TrackerMinimum,
                        NumericInputLimits.TrackerMaximum),
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
    JsonElement ChaosThresholdCurrent,
    JsonElement? FinishingBlowTarget,
    JsonElement FinishingBlowDamageThisTurn,
    IReadOnlyList<KaijuVulnerableAreaRequest>? VulnerableAreas,
    bool? RampageOverride = null,
    bool? DeathThroesOverride = null,
    bool? DefeatedOverride = null);

public sealed record KaijuVulnerableAreaRequest(
    string Id,
    string Name,
    JsonElement CurrentHitPoints,
    bool Targetable,
    bool? ExploitedOverride = null);
