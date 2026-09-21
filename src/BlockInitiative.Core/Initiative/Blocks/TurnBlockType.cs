namespace BlockInitiative.Core.Initiative;

/// <summary>
/// Rules module represented by a derived turn block. Mixed is a derived type
/// used only when one allied turn contains members from multiple block modules.
/// </summary>
public enum TurnBlockType
{
    Standard,
    Kaiju,
    Mixed
}
