using BlockInitiative.Core.Initiative;

namespace BlockInitiative.Web.Initiative;

public static class InitiativePreviewEndpoints
{
    public static IEndpointRouteBuilder MapInitiativePreviewEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/initiative/preview", Preview);
        return endpoints;
    }

    private static IResult Preview(InitiativePreviewRequest request)
    {
        if (request.Combatants is null)
        {
            return Results.BadRequest(new { error = "Combatants are required." });
        }

        try
        {
            var combatants = request.Combatants
                .Select(combatant => new CombatantInitiative(
                    combatant.Id,
                    combatant.Name,
                    combatant.AllianceId,
                    combatant.InitiativeTotal,
                    combatant.InitiativeModifier,
                    combatant.ControllerId,
                    combatant.TacticalGroupId,
                    ParseBlockType(combatant.BlockType)))
                .ToArray();

            var layout = InitiativeEngine.Build(combatants, request.ManualOrderOverride);

            return Results.Ok(new InitiativePreviewResponse(
                layout.Placements.Select(placement => new InitiativeCombatantPreview(
                    placement.Combatant.Id,
                    placement.Combatant.Name,
                    placement.Combatant.AllianceId,
                    placement.Combatant.InitiativeTotal,
                    placement.EffectiveInitiative,
                    placement.Combatant.InitiativeModifier,
                    placement.Combatant.ControllerId,
                    placement.Combatant.TacticalGroupId,
                    FormatBlockType(placement.Combatant.BlockType))).ToArray(),
                layout.Blocks.Select(block => new InitiativeBlockPreview(
                    block.Id,
                    block.AllianceId,
                    FormatBlockType(block.BlockType),
                    block.MemberIds,
                    block.MemberOrder,
                    block.SourceBlockIds,
                    block.IsMerged)).ToArray(),
                layout.CyclicMerge is null
                    ? null
                    : new CyclicMergePreview(
                        layout.CyclicMerge.TopBlockId,
                        layout.CyclicMerge.BottomBlockId,
                        layout.CyclicMerge.AllianceId,
                        FormatBlockType(layout.CyclicMerge.BlockType)),
                layout.Issues.Select(issue => new InitiativeIssuePreview(
                    issue.Code.ToString(),
                    issue.Message,
                    issue.CombatantIds)).ToArray(),
                layout.RequiresAdjudication,
                layout.UsesManualOrderOverride));
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new { error = exception.Message });
        }
    }

    private static TurnBlockType ParseBlockType(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)
            || string.Equals(value, "standard", StringComparison.OrdinalIgnoreCase))
        {
            return TurnBlockType.Standard;
        }

        if (string.Equals(value, "kaiju", StringComparison.OrdinalIgnoreCase))
        {
            return TurnBlockType.Kaiju;
        }

        throw new ArgumentException(
            $"Unknown turn block type '{value}'. Expected 'standard' or 'kaiju'.",
            nameof(value));
    }

    private static string FormatBlockType(TurnBlockType blockType)
        => blockType switch
        {
            TurnBlockType.Standard => "standard",
            TurnBlockType.Kaiju => "kaiju",
            _ => throw new ArgumentOutOfRangeException(nameof(blockType), blockType, null)
        };
}

public sealed record InitiativePreviewRequest(
    IReadOnlyList<InitiativeCombatantRequest>? Combatants,
    IReadOnlyList<string>? ManualOrderOverride = null);

public sealed record InitiativeCombatantRequest(
    string Id,
    string Name,
    string AllianceId,
    decimal InitiativeTotal,
    decimal? InitiativeModifier = null,
    string? ControllerId = null,
    string? TacticalGroupId = null,
    string? BlockType = null);

public sealed record InitiativePreviewResponse(
    IReadOnlyList<InitiativeCombatantPreview> OrderedCombatants,
    IReadOnlyList<InitiativeBlockPreview> Blocks,
    CyclicMergePreview? CyclicMerge,
    IReadOnlyList<InitiativeIssuePreview> Issues,
    bool RequiresAdjudication,
    bool UsesManualOrderOverride);

public sealed record InitiativeCombatantPreview(
    string Id,
    string Name,
    string AllianceId,
    decimal InitiativeTotal,
    decimal EffectiveInitiative,
    decimal? InitiativeModifier,
    string? ControllerId,
    string? TacticalGroupId,
    string BlockType);

public sealed record InitiativeBlockPreview(
    string Id,
    string AllianceId,
    string BlockType,
    IReadOnlyList<string> MemberIds,
    IReadOnlyList<string> MemberOrder,
    IReadOnlyList<string> SourceBlockIds,
    bool IsMerged);

public sealed record CyclicMergePreview(
    string TopBlockId,
    string BottomBlockId,
    string AllianceId,
    string BlockType);

public sealed record InitiativeIssuePreview(
    string Code,
    string Message,
    IReadOnlyList<string> CombatantIds);
