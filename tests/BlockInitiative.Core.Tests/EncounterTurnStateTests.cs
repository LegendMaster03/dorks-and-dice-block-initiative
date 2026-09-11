using BlockInitiative.Core.Initiative;

namespace BlockInitiative.Core.Tests;

public sealed class EncounterTurnStateTests
{
    [Fact]
    public void AdvanceBlock_SkipsBottomBlockAndCompletesCyclicMergeAtRoundBoundary()
    {
        var layout = InitiativeEngine.Build(InitiativeEngineTests.WorkedExample());
        var state = EncounterTurnState.Start(layout);

        Assert.Equal(1, state.Round);
        Assert.Equal("block-1", state.ActiveBlock!.Id);
        Assert.True(state.CyclicMergePending);

        var firstAdvance = state.AdvanceBlock();

        Assert.False(firstAdvance.RoundAdvanced);
        Assert.Equal("block-2", state.ActiveBlock!.Id);
        Assert.Equal(1, state.Round);

        var mergeAdvance = state.AdvanceBlock();

        Assert.True(mergeAdvance.RoundAdvanced);
        Assert.True(mergeAdvance.CyclicMergeCompleted);
        Assert.Equal("block-3", mergeAdvance.SkippedBlockId);
        Assert.Equal(2, state.Round);
        Assert.False(state.CyclicMergePending);
        Assert.True(state.CyclicMergeCompleted);
        Assert.True(state.LowerCyclicBlockSkippedRoundOne);
        Assert.Equal("block-1", state.ActiveBlock!.Id);
        Assert.Equal(
            new[] { "pa", "pb", "pc", "pd" },
            state.ActiveBlock.MemberIds);
        Assert.Equal(2, state.Blocks.Count);
    }

    [Fact]
    public void AdvanceBlock_WhenEndsOppose_AdvancesNormallyAcrossRoundBoundary()
    {
        var layout = InitiativeEngine.Build(new[]
        {
            new CombatantInitiative("p1", "Player", "players", 20),
            new CombatantInitiative("e1", "Enemy", "enemies", 10)
        });
        var state = EncounterTurnState.Start(layout);

        var firstAdvance = state.AdvanceBlock();
        Assert.False(firstAdvance.RoundAdvanced);
        Assert.Equal("block-2", state.ActiveBlock!.Id);

        var secondAdvance = state.AdvanceBlock();
        Assert.True(secondAdvance.RoundAdvanced);
        Assert.False(secondAdvance.CyclicMergeCompleted);
        Assert.Equal(2, state.Round);
        Assert.Equal("block-1", state.ActiveBlock!.Id);
    }

    [Fact]
    public void SetBlockMemberOrder_DoesNotMutateInitiativeAndCarriesIntoMergedBlock()
    {
        var layout = InitiativeEngine.Build(InitiativeEngineTests.WorkedExample());
        var state = EncounterTurnState.Start(layout);

        state.SetBlockMemberOrder("block-1", new[] { "pb", "pa" });
        state.SetBlockMemberOrder("block-3", new[] { "pd", "pc" });

        state.AdvanceBlock();
        state.AdvanceBlock();

        Assert.Equal(
            new[] { "pb", "pa", "pd", "pc" },
            state.ActiveBlock!.MemberOrder);
        Assert.Equal(22, layout.GetCombatant("pa").InitiativeTotal);
        Assert.Equal(19, layout.GetCombatant("pb").InitiativeTotal);
        Assert.Equal(10, layout.GetCombatant("pc").InitiativeTotal);
        Assert.Equal(7, layout.GetCombatant("pd").InitiativeTotal);
    }

    [Fact]
    public void SetBlockMemberOrder_RejectsMovingCombatantAcrossBlockBoundary()
    {
        var layout = InitiativeEngine.Build(InitiativeEngineTests.WorkedExample());
        var state = EncounterTurnState.Start(layout);

        Assert.Throws<ArgumentException>(() =>
            state.SetBlockMemberOrder("block-1", new[] { "pa", "pc" }));
    }

    [Fact]
    public void EmptyEncounter_HasNoActiveBlockAndCanAdvanceSafely()
    {
        var state = EncounterTurnState.Start(InitiativeEngine.Build(Array.Empty<CombatantInitiative>()));

        Assert.Null(state.ActiveBlock);
        var result = state.AdvanceBlock();
        Assert.Null(result.CurrentBlockId);
        Assert.Equal(1, state.Round);
    }
}
