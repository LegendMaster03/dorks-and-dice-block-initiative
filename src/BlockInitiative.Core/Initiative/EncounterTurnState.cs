namespace BlockInitiative.Core.Initiative;

public sealed record TurnAdvanceResult(
    int PreviousRound,
    int CurrentRound,
    string? PreviousBlockId,
    string? CurrentBlockId,
    bool RoundAdvanced,
    bool CyclicMergeCompleted,
    string? SkippedBlockId);

/// <summary>
/// Stateful traversal of a validated initiative layout. The special round-one
/// cyclic merge is represented explicitly rather than hidden in the initial sort.
/// </summary>
public sealed class EncounterTurnState
{
    private readonly InitiativeLayout _layout;
    private List<TurnBlock> _blocks;
    private int _activeBlockIndex;

    private EncounterTurnState(InitiativeLayout layout)
    {
        _layout = layout;
        _blocks = layout.Blocks.ToList();
        _activeBlockIndex = _blocks.Count == 0 ? -1 : 0;
        Round = 1;
        CyclicMergePending = layout.CyclicMerge is not null;
    }

    public int Round { get; private set; }

    public IReadOnlyList<TurnBlock> Blocks => _blocks;

    public TurnBlock? ActiveBlock =>
        _activeBlockIndex >= 0 ? _blocks[_activeBlockIndex] : null;

    public bool CyclicMergePending { get; private set; }

    public bool CyclicMergeCompleted { get; private set; }

    public bool LowerCyclicBlockSkippedRoundOne { get; private set; }

    public static EncounterTurnState Start(InitiativeLayout layout)
    {
        ValidateLayout(layout);
        return new EncounterTurnState(layout);
    }

    /// <summary>
    /// Rebuilds the operational turn state after the roster changes while an
    /// encounter is already running. The active combatant acts as a stable
    /// anchor even when the number or ids of derived blocks have changed.
    /// </summary>
    public static EncounterTurnState Resume(
        InitiativeLayout layout,
        int round,
        string activeCombatantId,
        bool cyclicMergeCompleted)
    {
        ValidateLayout(layout);

        if (round < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(round), "Round must be at least 1.");
        }

        if (string.IsNullOrWhiteSpace(activeCombatantId))
        {
            throw new ArgumentException(
                "An active combatant id is required when resuming an encounter.",
                nameof(activeCombatantId));
        }

        var state = new EncounterTurnState(layout)
        {
            Round = round
        };

        if (layout.CyclicMerge is not null && (round > 1 || cyclicMergeCompleted))
        {
            state.MergeCyclicBlocksForResume();
            state.CyclicMergePending = false;
            state.CyclicMergeCompleted = true;
            state.LowerCyclicBlockSkippedRoundOne = true;
        }
        else
        {
            state.CyclicMergePending = round == 1 && layout.CyclicMerge is not null;
            state.CyclicMergeCompleted = false;
            state.LowerCyclicBlockSkippedRoundOne = false;
        }

        var activeIndex = state._blocks.FindIndex(block =>
            block.MemberIds.Contains(activeCombatantId, StringComparer.Ordinal));
        if (activeIndex < 0)
        {
            throw new ArgumentException(
                $"Active combatant '{activeCombatantId}' is not present in the rebuilt encounter.",
                nameof(activeCombatantId));
        }

        state._activeBlockIndex = activeIndex;
        return state;
    }

    /// <summary>
    /// Records a chosen order inside a block without changing any initiative score.
    /// Authorization for ordinary player reordering versus DM override belongs to
    /// the application layer; the core only preserves the order separately.
    /// </summary>
    public void SetBlockMemberOrder(string blockId, IEnumerable<string> memberOrder)
    {
        var blockIndex = _blocks.FindIndex(block =>
            string.Equals(block.Id, blockId, StringComparison.Ordinal));

        if (blockIndex < 0)
        {
            throw new ArgumentException($"Unknown turn block '{blockId}'.", nameof(blockId));
        }

        _blocks[blockIndex] = _blocks[blockIndex].WithMemberOrder(memberOrder);
    }

    public TurnAdvanceResult AdvanceBlock()
    {
        if (ActiveBlock is null)
        {
            return new TurnAdvanceResult(
                Round,
                Round,
                null,
                null,
                false,
                false,
                null);
        }

        var previousRound = Round;
        var previousBlockId = ActiveBlock.Id;

        if (ShouldCompletePendingCyclicMerge())
        {
            var bottom = _blocks[^1];
            CompleteCyclicMerge();

            return new TurnAdvanceResult(
                previousRound,
                Round,
                previousBlockId,
                ActiveBlock?.Id,
                true,
                true,
                bottom.Id);
        }

        _activeBlockIndex++;
        var roundAdvanced = false;

        if (_activeBlockIndex >= _blocks.Count)
        {
            _activeBlockIndex = _blocks.Count == 0 ? -1 : 0;
            Round++;
            roundAdvanced = true;
        }

        return new TurnAdvanceResult(
            previousRound,
            Round,
            previousBlockId,
            ActiveBlock?.Id,
            roundAdvanced,
            false,
            null);
    }

    private static void ValidateLayout(InitiativeLayout layout)
    {
        ArgumentNullException.ThrowIfNull(layout);

        if (layout.RequiresAdjudication)
        {
            throw new InvalidOperationException(
                "The initiative layout contains unresolved adjudication issues. "
                + "Resolve them with a DM order override before starting combat.");
        }
    }

    private bool ShouldCompletePendingCyclicMerge()
    {
        if (!CyclicMergePending
            || Round != 1
            || _layout.CyclicMerge is null
            || _blocks.Count < 2)
        {
            return false;
        }

        var bottomIndex = _blocks.Count - 1;
        return _activeBlockIndex == bottomIndex - 1
            && string.Equals(
                _blocks[bottomIndex].Id,
                _layout.CyclicMerge.BottomBlockId,
                StringComparison.Ordinal);
    }

    private void CompleteCyclicMerge()
    {
        var bottom = _blocks[^1];
        MergeCyclicBlocksForResume();

        LowerCyclicBlockSkippedRoundOne = true;
        CyclicMergePending = false;
        CyclicMergeCompleted = true;
        Round = 2;
        _activeBlockIndex = 0;
    }

    private void MergeCyclicBlocksForResume()
    {
        if (_layout.CyclicMerge is null || _blocks.Count < 2)
        {
            return;
        }

        var top = _blocks[0];
        var bottom = _blocks[^1];

        if (!string.Equals(top.Id, _layout.CyclicMerge.TopBlockId, StringComparison.Ordinal)
            || !string.Equals(bottom.Id, _layout.CyclicMerge.BottomBlockId, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                "The pending cyclic merge no longer matches the encounter block state.");
        }

        var merged = top.MergeWith(bottom);
        var middle = _blocks.Skip(1).Take(_blocks.Count - 2);
        _blocks = new[] { merged }.Concat(middle).ToList();
    }
}
