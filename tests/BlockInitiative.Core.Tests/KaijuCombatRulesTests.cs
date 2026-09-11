using BlockInitiative.Core.Combat;

namespace BlockInitiative.Core.Tests;

public sealed class KaijuCombatRulesTests
{
    [Fact]
    public void ChaosThresholdAtZeroTriggersRampage()
    {
        var evaluation = KaijuCombatRules.Evaluate(State(
            chaos: 0,
            areas: [Area("skull", 40)]));

        Assert.True(evaluation.RampageActive);
        Assert.False(evaluation.DeathThroesActive);
        Assert.False(evaluation.Defeated);
    }

    [Fact]
    public void AllExploitedAreasTriggerDeathThroes()
    {
        var evaluation = KaijuCombatRules.Evaluate(State(
            chaos: 25,
            finishingBlow: 50,
            areas:
            [
                Area("skull", 0),
                Area("heart", 10, exploitedOverride: true)
            ]));

        Assert.True(evaluation.DeathThroesActive);
        Assert.True(evaluation.FinishingBlowReady);
        Assert.False(evaluation.Defeated);
    }

    [Fact]
    public void FinishingBlowRequiresDeathThroesAndSingleTurnDamageTarget()
    {
        var notReady = KaijuCombatRules.Evaluate(State(
            chaos: 0,
            finishingBlow: 50,
            finishingDamage: 80,
            areas: [Area("skull", 10)]));

        var defeated = KaijuCombatRules.Evaluate(State(
            chaos: 0,
            finishingBlow: 50,
            finishingDamage: 50,
            areas: [Area("skull", 0)]));

        Assert.False(notReady.FinishingBlowMet);
        Assert.False(notReady.Defeated);
        Assert.True(defeated.FinishingBlowMet);
        Assert.True(defeated.Defeated);
    }

    [Fact]
    public void DmOverridesCanReplaceDerivedStateWithoutChangingRawValues()
    {
        var evaluation = KaijuCombatRules.Evaluate(new KaijuCombatState(
            ChaosThresholdCurrent: 100,
            FinishingBlowTarget: null,
            FinishingBlowDamageThisTurn: 0,
            VulnerableAreas: [Area("skull", 30)],
            RampageOverride: true,
            DeathThroesOverride: true,
            DefeatedOverride: false));

        Assert.True(evaluation.RampageActive);
        Assert.True(evaluation.DeathThroesActive);
        Assert.False(evaluation.Defeated);
        Assert.Equal(30, evaluation.VulnerableAreas[0].CurrentHitPoints);
    }

    private static KaijuCombatState State(
        int chaos,
        IReadOnlyList<KaijuVulnerableAreaState> areas,
        int? finishingBlow = null,
        int finishingDamage = 0)
        => new(
            ChaosThresholdCurrent: chaos,
            FinishingBlowTarget: finishingBlow,
            FinishingBlowDamageThisTurn: finishingDamage,
            VulnerableAreas: areas);

    private static KaijuVulnerableAreaState Area(
        string id,
        int hp,
        bool? exploitedOverride = null)
        => new(
            Id: id,
            Name: id,
            CurrentHitPoints: hp,
            Targetable: true,
            ExploitedOverride: exploitedOverride);
}
