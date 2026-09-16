using BlockInitiative.Core.Initiative;

namespace BlockInitiative.Core.Tests;

public sealed class StandardInitiativeModeTests
{
    [Fact]
    public void Build_StandardModeCreatesOneTurnPerCombatantWithoutCyclicMerge()
    {
        var layout = InitiativeEngine.Build(
            new[]
            {
                C("p1", "Player 1", "players", 20),
                C("p2", "Player 2", "players", 18),
                C("e1", "Enemy", "enemies", 15),
                C("p3", "Player 3", "players", 10)
            },
            mode: InitiativeMode.Standard);

        Assert.Collection(
            layout.Blocks,
            block => Assert.Equal(new[] { "p1" }, block.MemberIds),
            block => Assert.Equal(new[] { "p2" }, block.MemberIds),
            block => Assert.Equal(new[] { "e1" }, block.MemberIds),
            block => Assert.Equal(new[] { "p3" }, block.MemberIds));
        Assert.Null(layout.CyclicMerge);
    }

    [Fact]
    public void TurnState_StandardModeAdvancesOneCombatantAtATime()
    {
        var layout = InitiativeEngine.Build(
            new[]
            {
                C("p1", "Player 1", "players", 20),
                C("p2", "Player 2", "players", 18),
                C("e1", "Enemy", "enemies", 15)
            },
            mode: InitiativeMode.Standard);
        var state = EncounterTurnState.Start(layout);

        Assert.Equal(new[] { "p1" }, state.ActiveBlock!.MemberIds);

        var firstAdvance = state.AdvanceBlock();
        Assert.False(firstAdvance.RoundAdvanced);
        Assert.Equal(1, state.Round);
        Assert.Equal(new[] { "p2" }, state.ActiveBlock!.MemberIds);

        var secondAdvance = state.AdvanceBlock();
        Assert.False(secondAdvance.RoundAdvanced);
        Assert.Equal(new[] { "e1" }, state.ActiveBlock!.MemberIds);

        var thirdAdvance = state.AdvanceBlock();
        Assert.True(thirdAdvance.RoundAdvanced);
        Assert.False(thirdAdvance.CyclicMergeCompleted);
        Assert.Equal(2, state.Round);
        Assert.Equal(new[] { "p1" }, state.ActiveBlock!.MemberIds);
    }

    [Fact]
    public void Build_StandardModeRequiresAdjudicationForSameSideTie()
    {
        var layout = InitiativeEngine.Build(
            new[]
            {
                C("p1", "Player 1", "players", 18),
                C("p2", "Player 2", "players", 18),
                C("e1", "Enemy", "enemies", 12)
            },
            mode: InitiativeMode.Standard);

        var issue = Assert.Single(layout.Issues);
        Assert.Equal(InitiativeIssueCode.TieRequiresAdjudication, issue.Code);
        Assert.Equal(new[] { "p1", "p2" }, issue.CombatantIds);
        Assert.True(layout.RequiresAdjudication);
        Assert.Throws<InvalidOperationException>(() => EncounterTurnState.Start(layout));
    }

    [Fact]
    public void Build_StandardModeManualOrderResolvesTieWithoutChangingRolls()
    {
        var layout = InitiativeEngine.Build(
            new[]
            {
                C("p1", "Player 1", "players", 18),
                C("p2", "Player 2", "players", 18),
                C("e1", "Enemy", "enemies", 12)
            },
            manualOrderOverride: new[] { "p2", "p1", "e1" },
            mode: InitiativeMode.Standard);

        Assert.False(layout.RequiresAdjudication);
        Assert.True(layout.UsesManualOrderOverride);
        Assert.Equal(
            new[] { "p2", "p1", "e1" },
            layout.Blocks.Select(block => block.MemberIds.Single()));
        Assert.Equal(18, layout.GetCombatant("p1").InitiativeTotal);
        Assert.Equal(18, layout.GetCombatant("p2").InitiativeTotal);
    }

    [Fact]
    public void Build_StandardModeKeepsSharedTacticalGroupAsSeparateTurnsWithoutInternalTieRuling()
    {
        var layout = InitiativeEngine.Build(
            new[]
            {
                C("p1", "Player", "players", 20),
                new CombatantInitiative("e1", "Enemy 1", "enemies", 14, TacticalGroupId: "group-1"),
                new CombatantInitiative("e2", "Enemy 2", "enemies", 14, TacticalGroupId: "group-1")
            },
            tacticalGroupMode: TacticalGroupInitiativeMode.SharedGroupRoll,
            mode: InitiativeMode.Standard);

        Assert.False(layout.RequiresAdjudication);
        Assert.Equal(
            new[] { "p1", "e1", "e2" },
            layout.Blocks.Select(block => block.MemberIds.Single()));
        Assert.All(layout.Blocks, block => Assert.Single(block.MemberIds));
    }

    private static CombatantInitiative C(
        string id,
        string name,
        string allianceId,
        decimal initiative)
        => new(id, name, allianceId, initiative);
}
