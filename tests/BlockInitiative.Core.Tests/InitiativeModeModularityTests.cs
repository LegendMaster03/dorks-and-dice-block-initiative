using BlockInitiative.Core.Initiative;

namespace BlockInitiative.Core.Tests;

public sealed class InitiativeModeModularityTests
{
    [Fact]
    public void CoreContainsSeparateModeModulesWithSharedStrategyBase()
    {
        var assemblyTypes = typeof(CoreAssembly).Assembly.GetTypes();
        var strategyBase = Assert.Single(
            assemblyTypes,
            type => type.Name == "InitiativeModeStrategy");
        var blockMode = Assert.Single(
            assemblyTypes,
            type => type.Name == "BlockInitiativeModeStrategy");
        var standardMode = Assert.Single(
            assemblyTypes,
            type => type.Name == "StandardInitiativeModeStrategy");

        Assert.True(strategyBase.IsAbstract);
        Assert.Equal(strategyBase, blockMode.BaseType);
        Assert.Equal(strategyBase, standardMode.BaseType);
    }

    [Fact]
    public void StandardAndBlockModesRemainBehaviorallyDistinct()
    {
        var combatants = new[]
        {
            new CombatantInitiative("p1", "Player 1", "players", 20),
            new CombatantInitiative("p2", "Player 2", "players", 18),
            new CombatantInitiative("e1", "Enemy", "enemies", 15)
        };

        var block = InitiativeEngine.Build(combatants, mode: InitiativeMode.Block);
        var standard = InitiativeEngine.Build(combatants, mode: InitiativeMode.Standard);

        Assert.Equal(2, block.Blocks.Count);
        Assert.Equal(3, standard.Blocks.Count);
        Assert.Null(standard.CyclicMerge);
    }
}
