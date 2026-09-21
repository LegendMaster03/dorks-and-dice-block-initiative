namespace BlockInitiative.Core.Initiative;

/// <summary>
/// Single mapping from the public initiative mode value to its concrete rules
/// module.
/// </summary>
internal static class InitiativeModeStrategyFactory
{
    private static readonly InitiativeModeStrategy Block = new BlockInitiativeModeStrategy();
    private static readonly InitiativeModeStrategy Standard = new StandardInitiativeModeStrategy();

    internal static InitiativeModeStrategy Resolve(InitiativeMode mode)
        => mode switch
        {
            InitiativeMode.Block => Block,
            InitiativeMode.Standard => Standard,
            _ => throw new ArgumentOutOfRangeException(
                nameof(mode), mode, "Unknown initiative mode.")
        };
}
