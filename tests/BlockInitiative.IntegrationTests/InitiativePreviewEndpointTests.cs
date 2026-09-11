using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace BlockInitiative.IntegrationTests;

public sealed class InitiativePreviewEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public InitiativePreviewEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task PreviewReturnsDerivedBlocksAndPendingCyclicMerge()
    {
        var request = new
        {
            combatants = new[]
            {
                Combatant("pa", "Player A", "players", 22m),
                Combatant("pb", "Player B", "players", 19m),
                Combatant("ex", "Enemy X", "enemies", 17m),
                Combatant("ey", "Enemy Y", "enemies", 13m),
                Combatant("pc", "Player C", "players", 10m),
                Combatant("pd", "Player D", "players", 7m)
            }
        };

        using var response = await _client.PostAsJsonAsync("/api/initiative/preview", request);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = document.RootElement;

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(3, root.GetProperty("blocks").GetArrayLength());
        Assert.False(root.GetProperty("requiresAdjudication").GetBoolean());
        Assert.Equal("block-1", root.GetProperty("cyclicMerge").GetProperty("topBlockId").GetString());
        Assert.Equal("block-3", root.GetProperty("cyclicMerge").GetProperty("bottomBlockId").GetString());
        Assert.Equal("standard", root.GetProperty("cyclicMerge").GetProperty("blockType").GetString());
    }

    [Fact]
    public async Task PreviewSurfacesOpposingTieWithoutInventingTieBreakRule()
    {
        var request = new
        {
            combatants = new[]
            {
                Combatant("p", "Player", "players", 15m),
                Combatant("e", "Enemy", "enemies", 15m)
            }
        };

        using var response = await _client.PostAsJsonAsync("/api/initiative/preview", request);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = document.RootElement;

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(root.GetProperty("requiresAdjudication").GetBoolean());
        Assert.Single(root.GetProperty("issues").EnumerateArray());
    }

    [Fact]
    public async Task ManualOrderOverrideResolvesPreviewWhilePreservingInitiativeScores()
    {
        var request = new
        {
            combatants = new[]
            {
                Combatant("p", "Player", "players", 15m),
                Combatant("e", "Enemy", "enemies", 15m)
            },
            manualOrderOverride = new[] { "e", "p" }
        };

        using var response = await _client.PostAsJsonAsync("/api/initiative/preview", request);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = document.RootElement;
        var ordered = root.GetProperty("orderedCombatants").EnumerateArray().ToArray();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(root.GetProperty("requiresAdjudication").GetBoolean());
        Assert.True(root.GetProperty("usesManualOrderOverride").GetBoolean());
        Assert.Equal("e", ordered[0].GetProperty("id").GetString());
        Assert.Equal(15m, ordered[0].GetProperty("initiativeTotal").GetDecimal());
        Assert.Equal("p", ordered[1].GetProperty("id").GetString());
        Assert.Equal(15m, ordered[1].GetProperty("initiativeTotal").GetDecimal());
    }

    [Fact]
    public async Task PreviewKeepsKaijuInDedicatedBlockType()
    {
        var request = new
        {
            combatants = new[]
            {
                Combatant("enemy-a", "Enemy A", "enemies", 20m),
                Combatant("kaiju", "Kaiju", "enemies", 18m, "kaiju"),
                Combatant("enemy-b", "Enemy B", "enemies", 16m)
            }
        };

        using var response = await _client.PostAsJsonAsync("/api/initiative/preview", request);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = document.RootElement;
        var blocks = root.GetProperty("blocks").EnumerateArray().ToArray();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(3, blocks.Length);
        Assert.Equal("standard", blocks[0].GetProperty("blockType").GetString());
        Assert.Equal("kaiju", blocks[1].GetProperty("blockType").GetString());
        Assert.Equal("standard", blocks[2].GetProperty("blockType").GetString());
    }

    private static object Combatant(
        string id,
        string name,
        string allianceId,
        decimal initiativeTotal,
        string? blockType = null)
        => new
        {
            id,
            name,
            allianceId,
            initiativeTotal,
            initiativeModifier = (decimal?)null,
            controllerId = (string?)null,
            tacticalGroupId = (string?)null,
            blockType
        };
}
