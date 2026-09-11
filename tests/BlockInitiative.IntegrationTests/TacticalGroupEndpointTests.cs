using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace BlockInitiative.IntegrationTests;

public sealed class TacticalGroupEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public TacticalGroupEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task PreviewAveragesMemberRollsForTacticalGroup()
    {
        var request = new
        {
            tacticalGroupMode = "average",
            combatants = new[]
            {
                Combatant("player", "Player", "players", 18m),
                Combatant("g1", "Goblin 1", "enemies", 20m, "goblins"),
                Combatant("g2", "Goblin 2", "enemies", 10m, "goblins"),
                Combatant("orc", "Orc", "enemies", 12m, "orcs")
            }
        };

        using var response = await _client.PostAsJsonAsync("/api/initiative/preview", request);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var goblins = json.RootElement.GetProperty("orderedCombatants")
            .EnumerateArray()
            .Where(item => item.GetProperty("tacticalGroupId").GetString() == "goblins")
            .ToArray();
        Assert.Equal(2, goblins.Length);
        Assert.All(goblins, item => Assert.Equal(15m, item.GetProperty("effectiveInitiative").GetDecimal()));
    }

    [Fact]
    public async Task PreviewIndividualModeLeavesMemberRollsIndependent()
    {
        var request = new
        {
            tacticalGroupMode = "individual",
            combatants = new[]
            {
                Combatant("g1", "Goblin 1", "enemies", 20m, "goblins"),
                Combatant("player", "Player", "players", 18m),
                Combatant("g2", "Goblin 2", "enemies", 10m, "goblins")
            }
        };

        using var response = await _client.PostAsJsonAsync("/api/initiative/preview", request);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var order = json.RootElement.GetProperty("orderedCombatants")
            .EnumerateArray()
            .Select(item => item.GetProperty("id").GetString())
            .ToArray();
        Assert.Equal(new[] { "g1", "player", "g2" }, order);
    }

    [Fact]
    public async Task PreviewRejectsMismatchedSharedGroupRolls()
    {
        var request = new
        {
            tacticalGroupMode = "shared",
            combatants = new[]
            {
                Combatant("g1", "Goblin 1", "enemies", 14m, "goblins"),
                Combatant("g2", "Goblin 2", "enemies", 13m, "goblins")
            }
        };

        using var response = await _client.PostAsJsonAsync("/api/initiative/preview", request);
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("shared roll", body, StringComparison.OrdinalIgnoreCase);
    }

    private static object Combatant(
        string id,
        string name,
        string allianceId,
        decimal initiativeTotal,
        string? tacticalGroupId = null)
        => new
        {
            id,
            name,
            allianceId,
            initiativeTotal,
            initiativeModifier = (decimal?)null,
            controllerId = (string?)null,
            tacticalGroupId,
            blockType = "standard"
        };
}
