using BlockInitiative.Core.Initiative;

namespace BlockInitiative.Core.Tests;

public sealed class TacticalGroupModularityTests
{
    [Fact]
    public void CoreContainsDedicatedTacticalGroupResolver()
    {
        var resolver = Assert.Single(
            typeof(CoreAssembly).Assembly.GetTypes(),
            type => type.Name == "TacticalGroupInitiativeResolver");

        Assert.True(resolver.IsAbstract && resolver.IsSealed);
    }

    [Fact]
    public void TacticalGroupModesPreserveExistingPlacementBehavior()
    {
        var combatants = new[]
        {
            new CombatantInitiative(
                "g1", "Goblin 1", "enemies", 20, TacticalGroupId: "goblins"),
            new CombatantInitiative(
                "g2", "Goblin 2", "enemies", 10, TacticalGroupId: "goblins")
        };

        var layout = InitiativeEngine.Build(
            combatants,
            tacticalGroupMode: TacticalGroupInitiativeMode.AverageMemberRolls);

        Assert.All(layout.Placements, placement =>
            Assert.Equal(15m, placement.EffectiveInitiative));
    }
}
