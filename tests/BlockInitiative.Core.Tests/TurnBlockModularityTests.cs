using BlockInitiative.Core.Initiative;

namespace BlockInitiative.Core.Tests;

public sealed class TurnBlockModularityTests
{
    [Fact]
    public void StandardCombatantsProduceStandardTurnBlockModule()
    {
        var layout = InitiativeEngine.Build(
        [
            new CombatantInitiative("p1", "Player", "players", 20),
            new CombatantInitiative("p2", "Player 2", "players", 18)
        ]);

        var block = Assert.Single(layout.Blocks);
        Assert.IsType<StandardTurnBlock>(block);
        Assert.Equal(TurnBlockType.Standard, block.BlockType);
    }

    [Fact]
    public void KaijuCombatantsProduceKaijuTurnBlockModule()
    {
        var layout = InitiativeEngine.Build(
        [
            new CombatantInitiative(
                "kaiju",
                "Kaiju",
                "enemies",
                20,
                BlockType: TurnBlockType.Kaiju)
        ]);

        var block = Assert.Single(layout.Blocks);
        Assert.IsType<KaijuTurnBlock>(block);
        Assert.Equal(TurnBlockType.Kaiju, block.BlockType);
    }

    [Fact]
    public void MixedAlliedTurnProducesMixedTurnBlockModule()
    {
        var layout = InitiativeEngine.Build(
        [
            new CombatantInitiative("enemy", "Enemy", "enemies", 20),
            new CombatantInitiative(
                "kaiju",
                "Kaiju",
                "enemies",
                18,
                BlockType: TurnBlockType.Kaiju)
        ]);

        var block = Assert.Single(layout.Blocks);
        Assert.IsType<MixedTurnBlock>(block);
        Assert.Equal(TurnBlockType.Mixed, block.BlockType);
    }

    [Fact]
    public void TacticalReorderingPreservesConcreteBlockModule()
    {
        var layout = InitiativeEngine.Build(
        [
            new CombatantInitiative("p1", "Player 1", "players", 20),
            new CombatantInitiative("p2", "Player 2", "players", 18)
        ]);

        var reordered = Assert.Single(layout.Blocks).WithMemberOrder(["p2", "p1"]);

        Assert.IsType<StandardTurnBlock>(reordered);
        Assert.Equal(new[] { "p2", "p1" }, reordered.MemberOrder);
    }

    [Fact]
    public void CyclicMergeDerivesConcreteMixedBlockModule()
    {
        var layout = InitiativeEngine.Build(
        [
            new CombatantInitiative("enemy", "Enemy", "enemies", 20),
            new CombatantInitiative("player", "Player", "players", 15),
            new CombatantInitiative(
                "kaiju",
                "Kaiju",
                "enemies",
                10,
                BlockType: TurnBlockType.Kaiju)
        ]);
        var state = EncounterTurnState.Resume(
            layout,
            round: 2,
            activeCombatantId: "enemy",
            cyclicMergeCompleted: true);

        Assert.IsType<MixedTurnBlock>(state.ActiveBlock);
        Assert.Equal(new[] { "enemy", "kaiju" }, state.ActiveBlock!.MemberIds);
    }
}
