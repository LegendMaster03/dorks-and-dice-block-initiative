using BlockInitiative.Core.Initiative;

namespace BlockInitiative.Web.Initiative;

public static class InitiativePreviewEndpoints
{
    public static IEndpointRouteBuilder MapInitiativePreviewEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/initiative/preview", Preview);
        endpoints.MapPost("/api/initiative/state", State);
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
            var combatants = ToCombatants(request.Combatants);
            var tacticalGroupMode = ParseTacticalGroupMode(request.TacticalGroupMode);
            var initiativeMode = ParseInitiativeMode(request.InitiativeMode);
            var layout = InitiativeEngine.Build(
                combatants,
                request.ManualOrderOverride,
                tacticalGroupMode,
                initiativeMode);

            return Results.Ok(ToPreviewResponse(layout));
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new { error = exception.Message });
        }
    }

    private static IResult State(InitiativeTurnStateRequest request)
    {
        if (request.Combatants is null)
        {
            return Results.BadRequest(new { error = "Combatants are required." });
        }

        if (request.AdvanceCount < 0 || request.AdvanceCount > 10_000)
        {
            return Results.BadRequest(new { error = "AdvanceCount must be between 0 and 10000." });
        }

        try
        {
            var combatants = ToCombatants(request.Combatants);
            var tacticalGroupMode = ParseTacticalGroupMode(request.TacticalGroupMode);
            var initiativeMode = ParseInitiativeMode(request.InitiativeMode);
            var layout = InitiativeEngine.Build(
                combatants,
                request.ManualOrderOverride,
                tacticalGroupMode,
                initiativeMode);

            var isResume = request.ResumeRound is not null || request.ResumeActiveCombatantId is not null;
            if (isResume && (request.ResumeRound is null || string.IsNullOrWhiteSpace(request.ResumeActiveCombatantId)))
            {
                throw new ArgumentException(
                    "ResumeRound and ResumeActiveCombatantId must be supplied together.");
            }

            var state = isResume
                ? EncounterTurnState.Resume(
                    layout,
                    request.ResumeRound!.Value,
                    request.ResumeActiveCombatantId!,
                    request.ResumeCyclicMergeCompleted)
                : EncounterTurnState.Start(layout);
            TurnAdvanceResult? lastAdvance = null;

            for (var index = 0; index < request.AdvanceCount; index++)
            {
                lastAdvance = state.AdvanceBlock();
            }

            return Results.Ok(new InitiativeTurnStateResponse(
                state.Round,
                state.ActiveBlock?.Id,
                state.Blocks.Select(ToBlockPreview).ToArray(),
                state.CyclicMergePending,
                state.CyclicMergeCompleted,
                state.LowerCyclicBlockSkippedRoundOne,
                lastAdvance is null
                    ? null
                    : new TurnAdvancePreview(
                        lastAdvance.PreviousRound,
                        lastAdvance.CurrentRound,
                        lastAdvance.PreviousBlockId,
                        lastAdvance.CurrentBlockId,
                        lastAdvance.RoundAdvanced,
                        lastAdvance.CyclicMergeCompleted,
                        lastAdvance.SkippedBlockId)));
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new { error = exception.Message });
        }
        catch (InvalidOperationException exception)
        {
            return Results.BadRequest(new { error = exception.Message });
        }
    }

    private static CombatantInitiative[] ToCombatants(
        IReadOnlyList<InitiativeCombatantRequest> combatants)
        => combatants
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

    private static InitiativePreviewResponse ToPreviewResponse(InitiativeLayout layout)
        => new(
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
            layout.Blocks.Select(ToBlockPreview).ToArray(),
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
            layout.UsesManualOrderOverride);

    private static InitiativeBlockPreview ToBlockPreview(TurnBlock block)
        => new(
            block.Id,
            block.AllianceId,
            FormatBlockType(block.BlockType),
            block.MemberIds,
            block.MemberOrder,
            block.SourceBlockIds,
            block.IsMerged);

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

    private static TacticalGroupInitiativeMode ParseTacticalGroupMode(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)
            || string.Equals(value, "individual", StringComparison.OrdinalIgnoreCase))
        {
            return TacticalGroupInitiativeMode.Individual;
        }

        if (string.Equals(value, "average", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "average-member-rolls", StringComparison.OrdinalIgnoreCase))
        {
            return TacticalGroupInitiativeMode.AverageMemberRolls;
        }

        if (string.Equals(value, "shared", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "shared-group-roll", StringComparison.OrdinalIgnoreCase))
        {
            return TacticalGroupInitiativeMode.SharedGroupRoll;
        }

        throw new ArgumentException(
            $"Unknown tactical group initiative mode '{value}'. Expected 'individual', 'average', or 'shared'.",
            nameof(value));
    }

    private static InitiativeMode ParseInitiativeMode(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)
            || string.Equals(value, "block", StringComparison.OrdinalIgnoreCase))
        {
            return InitiativeMode.Block;
        }

        if (string.Equals(value, "standard", StringComparison.OrdinalIgnoreCase))
        {
            return InitiativeMode.Standard;
        }

        throw new ArgumentException(
            $"Unknown initiative mode '{value}'. Expected 'block' or 'standard'.",
            nameof(value));
    }

    private static string FormatBlockType(TurnBlockType blockType)
        => blockType switch
        {
            TurnBlockType.Standard => "standard",
            TurnBlockType.Kaiju => "kaiju",
            TurnBlockType.Mixed => "mixed",
            _ => throw new ArgumentOutOfRangeException(nameof(blockType), blockType, null)
        };
}

public sealed record InitiativePreviewRequest(
    IReadOnlyList<InitiativeCombatantRequest>? Combatants,
    IReadOnlyList<string>? ManualOrderOverride = null,
    string? TacticalGroupMode = null,
    string? InitiativeMode = null);

public sealed record InitiativeTurnStateRequest(
    IReadOnlyList<InitiativeCombatantRequest>? Combatants,
    IReadOnlyList<string>? ManualOrderOverride = null,
    string? TacticalGroupMode = null,
    string? InitiativeMode = null,
    int AdvanceCount = 0,
    int? ResumeRound = null,
    string? ResumeActiveCombatantId = null,
    bool ResumeCyclicMergeCompleted = false);

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

public sealed record InitiativeTurnStateResponse(
    int Round,
    string? ActiveBlockId,
    IReadOnlyList<InitiativeBlockPreview> Blocks,
    bool CyclicMergePending,
    bool CyclicMergeCompleted,
    bool LowerCyclicBlockSkippedRoundOne,
    TurnAdvancePreview? LastAdvance);

public sealed record TurnAdvancePreview(
    int PreviousRound,
    int CurrentRound,
    string? PreviousBlockId,
    string? CurrentBlockId,
    bool RoundAdvanced,
    bool CyclicMergeCompleted,
    string? SkippedBlockId);

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
