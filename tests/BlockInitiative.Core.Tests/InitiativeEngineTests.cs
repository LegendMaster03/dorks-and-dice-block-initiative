using BlockInitiative.Core.Initiative;

namespace BlockInitiative.Core.Tests;

public sealed class InitiativeEngineTests
{
    [Fact]
    public void Build_PartitionsContiguousAlliesWithoutChangingInitiativeValues()
    {
        var combatants = new[]
        {
            C("p1", "Player 1", "players", 21),
            C("p2", "Player 2", "players", 18),
            C("e1", "Enemy 1", "enemies", 16),
            C("e2", "Enemy 2", "enemies", 14),
            C("p3", "Player 3", "players", 11),
            C("e3", "Enemy 3", "enemies", 8)
        };

        var layout = InitiativeEngine.Build(combatants);

        Assert.Collection(
            layout.Blocks,
            block => Assert.Equal(new[] { "p1", "p2" }, block.MemberIds),
            block => Assert.Equal(new[] { "e1", "e2" }, block.MemberIds),
            block => Assert.Equal(new[] { "p3" }, block.MemberIds),
            block => Assert.Equal(new[] { "e3" }, block.MemberIds));

        Assert.Equal(21, layout.GetCombatant("p1").InitiativeTotal);
        Assert.Equal(8, layout.GetCombatant("e3").InitiativeTotal);
        Assert.Null(layout.CyclicMerge);
    }

    [Fact]
    public void Build_PreservesFractionalInitiativeOrdering()
    {
        var layout = InitiativeEngine.Build(new[]
        {
            C("e1", "Enemy group 1", "enemies", 13.5m),
            C("p1", "Player", "players", 14m),
            C("e2", "Enemy group 2", "enemies", 13.25m)
        });

        Assert.Equal(
            new[] { "p1", "e1", "e2" },
            layout.Placements.Select(placement => placement.Combatant.Id));
    }

    [Fact]
    public void Build_PlansCyclicMergeWhenTopAndBottomBlocksAreAllied()
    {
        var layout = InitiativeEngine.Build(WorkedExample());

        Assert.NotNull(layout.CyclicMerge);
        Assert.Equal("block-1", layout.CyclicMerge!.TopBlockId);
        Assert.Equal("block-3", layout.CyclicMerge.BottomBlockId);
        Assert.Equal("players", layout.CyclicMerge.AllianceId);
        Assert.Equal(TurnBlockType.Standard, layout.CyclicMerge.BlockType);
    }

    [Fact]
    public void Build_ControlledCreatureUsesControllerInitiativeButPreservesOriginalRoll()
    {
        var layout = InitiativeEngine.Build(new[]
        {
            C("controller", "Controller", "players", 19),
            C("enemy", "Enemy", "enemies", 17),
            new CombatantInitiative(
                "controlled",
                "Controlled creature",
                "players",
                InitiativeTotal: 7,
                InitiativeModifier: 2,
                ControllerId: "controller")
        });

        var placement = layout.Placements.Single(item => item.Combatant.Id == "controlled");

        Assert.Equal(19, placement.EffectiveInitiative);
        Assert.Equal(7, layout.GetCombatant("controlled").InitiativeTotal);
        Assert.Equal("controller", layout.GetCombatant("controlled").ControllerId);
        Assert.Equal(new[] { "controller", "controlled" }, layout.Blocks[0].MemberIds);
    }

    [Fact]
    public void Build_ControllerChainUsesResolvedControllerInitiative()
    {
        var layout = InitiativeEngine.Build(new[]
        {
            C("leader", "Leader", "players", 21),
            new CombatantInitiative(
                "middle",
                "Middle",
                "players",
                InitiativeTotal: 13,
                ControllerId: "leader"),
            new CombatantInitiative(
                "follower",
                "Follower",
                "players",
                InitiativeTotal: 5,
                ControllerId: "middle"),
            C("enemy", "Enemy", "enemies", 18)
        });

        Assert.Equal(
            21,
            layout.Placements.Single(item =>
                item.Combatant.Id == "middle").EffectiveInitiative);
        Assert.Equal(
            21,
            layout.Placements.Single(item =>
                item.Combatant.Id == "follower").EffectiveInitiative);
    }

    [Fact]
    public void Build_RejectsControllerCycles()
    {
        var exception = Assert.Throws<ArgumentException>(() =>
            InitiativeEngine.Build(new[]
            {
                new CombatantInitiative(
                    "a",
                    "A",
                    "players",
                    InitiativeTotal: 20,
                    ControllerId: "b"),
                new CombatantInitiative(
                    "b",
                    "B",
                    "players",
                    InitiativeTotal: 10,
                    ControllerId: "a")
            }));

        Assert.Contains(
            "cycle",
            exception.Message,
            StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Build_OpposingTieRequiresAdjudicationRatherThanInventingRule()
    {
        var layout = InitiativeEngine.Build(new[]
        {
            C("player", "Player", "players", 15),
            C("enemy", "Enemy", "enemies", 15)
        });

        var issue = Assert.Single(layout.Issues);
        Assert.Equal(InitiativeIssueCode.OpposingTieRequiresAdjudication, issue.Code);
        Assert.True(layout.RequiresAdjudication);
        Assert.Throws<InvalidOperationException>(() => EncounterTurnState.Start(layout));
    }

    [Fact]
    public void Build_ManualOrderOverrideResolvesAmbiguousTieWithoutChangingRolls()
    {
        var combatants = new[]
        {
            C("player", "Player", "players", 15),
            C("enemy", "Enemy", "enemies", 15)
        };

        var layout = InitiativeEngine.Build(combatants, new[] { "enemy", "player" });

        Assert.Empty(layout.Issues);
        Assert.True(layout.UsesManualOrderOverride);
        Assert.Equal(
            new[] { "enemy", "player" },
            layout.Placements.Select(placement => placement.Combatant.Id));
        Assert.All(layout.Combatants, combatant => Assert.Equal(15, combatant.InitiativeTotal));
    }

    [Fact]
    public void Build_RejectsIncompleteManualOrderOverride()
    {
        var combatants = new[]
        {
            C("player", "Player", "players", 15),
            C("enemy", "Enemy", "enemies", 14)
        };

        Assert.Throws<ArgumentException>(() =>
            InitiativeEngine.Build(combatants, new[] { "player" }));
    }

    [Fact]
    public void Build_MergesConsecutiveSameSideMembersAcrossBlockTypes()
    {
        var layout = InitiativeEngine.Build(new[]
        {
            C("enemy-a", "Enemy A", "enemies", 20),
            C("kaiju", "Kaiju", "enemies", 18, TurnBlockType.Kaiju),
            C("enemy-b", "Enemy B", "enemies", 16)
        });

        var block = Assert.Single(layout.Blocks);
        Assert.Equal("enemies", block.AllianceId);
        Assert.Equal(TurnBlockType.Mixed, block.BlockType);
        Assert.Equal(new[] { "enemy-a", "kaiju", "enemy-b" }, block.MemberIds);
    }

    [Fact]
    public void Build_CyclicMergeCrossesDifferentMemberBlockTypesWhenSideMatches()
    {
        var layout = InitiativeEngine.Build(new[]
        {
            C("enemy", "Enemy", "enemies", 20),
            C("player", "Player", "players", 15),
            C("kaiju", "Kaiju", "enemies", 10, TurnBlockType.Kaiju)
        });

        Assert.NotNull(layout.CyclicMerge);
        Assert.Equal("enemies", layout.CyclicMerge!.AllianceId);
        Assert.Equal(TurnBlockType.Mixed, layout.CyclicMerge.BlockType);
    }

    [Fact]
    public void Build_RejectsMixedAsARawCombatantBlockType()
    {
        Assert.Throws<ArgumentException>(() => InitiativeEngine.Build(new[]
        {
            C("player", "Player", "players", 15),
            C("bad", "Bad", "enemies", 10, TurnBlockType.Mixed)
        }));
    }

    private static CombatantInitiative C(
        string id,
        string name,
        string alliance,
        decimal initiative,
        TurnBlockType blockType = TurnBlockType.Standard)
        => new(id, name, alliance, initiative, BlockType: blockType);

    internal static CombatantInitiative[] WorkedExample() =>
    [
        C("pa", "Player A", "players", 22),
        C("pb", "Player B", "players", 19),
        C("ex", "Enemy X", "enemies", 17),
        C("ey", "Enemy Y", "enemies", 13),
        C("pc", "Player C", "players", 10),
        C("pd", "Player D", "players", 7)
    ];
}
