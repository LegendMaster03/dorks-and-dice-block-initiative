using BlockInitiative.Core.Initiative;

namespace BlockInitiative.Core.Tests;

public sealed class TacticalGroupInitiativeTests
{
    [Fact]
    public void AverageMemberRollsPlacesEveryGroupMemberAtTheAverage()
    {
        var layout = InitiativeEngine.Build(
        [
            Combatant("player", "Player", "players", 18m),
            Combatant("goblin-1", "Goblin 1", "enemies", 20m, "goblins"),
            Combatant("goblin-2", "Goblin 2", "enemies", 10m, "goblins"),
            Combatant("orc", "Orc", "enemies", 12m, "orcs")
        ],
        tacticalGroupMode: TacticalGroupInitiativeMode.AverageMemberRolls);

        var goblins = layout.Placements
            .Where(placement => placement.Combatant.TacticalGroupId == "goblins")
            .ToArray();

        Assert.Equal(2, goblins.Length);
        Assert.All(goblins, placement => Assert.Equal(15m, placement.EffectiveInitiative));
        Assert.Equal(
            new[] { "player", "goblin-1", "goblin-2", "orc" },
            layout.Placements.Select(placement => placement.Combatant.Id));
    }

    [Fact]
    public void IndividualModeIgnoresTacticalGroupForPlacement()
    {
        var layout = InitiativeEngine.Build(
        [
            Combatant("goblin-1", "Goblin 1", "enemies", 20m, "goblins"),
            Combatant("player", "Player", "players", 18m),
            Combatant("goblin-2", "Goblin 2", "enemies", 10m, "goblins")
        ],
        tacticalGroupMode: TacticalGroupInitiativeMode.Individual);

        Assert.Equal(
            new[] { "goblin-1", "player", "goblin-2" },
            layout.Placements.Select(placement => placement.Combatant.Id));
        Assert.Equal(3, layout.Blocks.Count);
    }

    [Fact]
    public void SharedGroupRollKeepsGroupMembersTogetherAtSharedValue()
    {
        var layout = InitiativeEngine.Build(
        [
            Combatant("player", "Player", "players", 17m),
            Combatant("goblin-1", "Goblin 1", "enemies", 14m, "goblins"),
            Combatant("goblin-2", "Goblin 2", "enemies", 14m, "goblins")
        ],
        tacticalGroupMode: TacticalGroupInitiativeMode.SharedGroupRoll);

        Assert.Equal(14m, layout.Placements.Single(p => p.Combatant.Id == "goblin-1").EffectiveInitiative);
        Assert.Equal(14m, layout.Placements.Single(p => p.Combatant.Id == "goblin-2").EffectiveInitiative);
    }

    [Fact]
    public void SharedGroupRollRejectsDifferentMemberValues()
    {
        var exception = Assert.Throws<ArgumentException>(() => InitiativeEngine.Build(
        [
            Combatant("goblin-1", "Goblin 1", "enemies", 14m, "goblins"),
            Combatant("goblin-2", "Goblin 2", "enemies", 13m, "goblins")
        ],
        tacticalGroupMode: TacticalGroupInitiativeMode.SharedGroupRoll));

        Assert.Contains("shared roll", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void KaijuAndStandardGroupsOnSameSideShareOneDerivedTurnBlock()
    {
        var layout = InitiativeEngine.Build(
        [
            Combatant("goblin-1", "Goblin 1", "enemies", 18m, "goblins"),
            Combatant("goblin-2", "Goblin 2", "enemies", 16m, "goblins"),
            new CombatantInitiative("kaiju", "Kaiju", "enemies", 15m, BlockType: TurnBlockType.Kaiju),
            Combatant("orc-1", "Orc 1", "enemies", 14m, "orcs")
        ],
        tacticalGroupMode: TacticalGroupInitiativeMode.AverageMemberRolls);

        var block = Assert.Single(layout.Blocks);
        Assert.Equal("enemies", block.AllianceId);
        Assert.Equal(TurnBlockType.Mixed, block.BlockType);
        Assert.Equal(new[] { "goblin-1", "goblin-2", "kaiju", "orc-1" }, block.MemberIds);
    }

    private static CombatantInitiative Combatant(
        string id,
        string name,
        string alliance,
        decimal initiative,
        string? tacticalGroup = null)
        => new(
            id,
            name,
            alliance,
            initiative,
            TacticalGroupId: tacticalGroup);
}
