using System.Globalization;
using System.Text.Json;

namespace BlockInitiative.Web.Validation;

public static class NumericInputLimits
{
    public const decimal InitiativeMinimum = -1_000_000m;
    public const decimal InitiativeMaximum = 1_000_000m;
    public const int TrackerMinimum = -1_000_000_000;
    public const int TrackerMaximum = 1_000_000_000;
    public const int NonNegativeTrackerMinimum = 0;

    public static decimal RequiredDecimal(
        JsonElement raw,
        string label,
        decimal minimum,
        decimal maximum)
    {
        if (raw.ValueKind != JsonValueKind.Number
            || !raw.TryGetDecimal(out var value)
            || value < minimum
            || value > maximum)
        {
            throw RangeError(label, minimum, maximum);
        }

        return value;
    }

    public static decimal? OptionalDecimal(
        JsonElement? raw,
        string label,
        decimal minimum,
        decimal maximum)
    {
        if (raw is null
            || raw.Value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            return null;
        }

        return RequiredDecimal(raw.Value, label, minimum, maximum);
    }

    public static int RequiredInteger(
        JsonElement raw,
        string label,
        int minimum,
        int maximum)
    {
        if (raw.ValueKind != JsonValueKind.Number
            || !raw.TryGetInt64(out var value)
            || value < minimum
            || value > maximum)
        {
            throw RangeError(label, minimum, maximum);
        }

        return checked((int)value);
    }

    public static int? OptionalInteger(
        JsonElement? raw,
        string label,
        int minimum,
        int maximum)
    {
        if (raw is null
            || raw.Value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            return null;
        }

        return RequiredInteger(raw.Value, label, minimum, maximum);
    }

    private static ArgumentException RangeError(
        string label,
        decimal minimum,
        decimal maximum)
        => new(
            $"{label} must be a number between {Format(minimum)} and {Format(maximum)}.");

    private static string Format(decimal value)
        => value.ToString("0.#############################", CultureInfo.InvariantCulture);
}
