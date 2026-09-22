using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace BlockInitiative.IntegrationTests;

public sealed class KaijuTrackingEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public KaijuTrackingEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task EvaluateDerivesRampageDeathThroesAndFinishingBlow()
    {
        var request = new
        {
            chaosThresholdCurrent = 0,
            finishingBlowTarget = 60,
            finishingBlowDamageThisTurn = 60,
            vulnerableAreas = new[]
            {
                new
                {
                    id = "skull",
                    name = "Skull",
                    currentHitPoints = 0,
                    targetable = true,
                    exploitedOverride = (bool?)null
                },
                new
                {
                    id = "heart",
                    name = "Heart",
                    currentHitPoints = 20,
                    targetable = true,
                    exploitedOverride = (bool?)true
                }
            }
        };

        using var response = await _client.PostAsJsonAsync("/api/kaiju/evaluate", request);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = document.RootElement;

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(root.GetProperty("rampageActive").GetBoolean());
        Assert.True(root.GetProperty("deathThroesActive").GetBoolean());
        Assert.True(root.GetProperty("finishingBlowReady").GetBoolean());
        Assert.True(root.GetProperty("finishingBlowMet").GetBoolean());
        Assert.True(root.GetProperty("defeated").GetBoolean());
        Assert.All(root.GetProperty("vulnerableAreas").EnumerateArray(), area =>
            Assert.True(area.GetProperty("exploited").GetBoolean()));
    }

    [Fact]
    public async Task EvaluateRejectsOversizedTrackerValueWithValidationMessage()
    {
        const string json = """
            {
              "chaosThresholdCurrent": 999999999999999999999999999999999999999999999999999999999999,
              "finishingBlowTarget": 60,
              "finishingBlowDamageThisTurn": 0,
              "vulnerableAreas": []
            }
            """;

        using var response = await _client.PostAsync(
            "/api/kaiju/evaluate",
            new StringContent(json, Encoding.UTF8, "application/json"));
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(
            "Chaos Threshold must be a number between -1000000000 and 1000000000.",
            body,
            StringComparison.Ordinal);
    }

    [Fact]
    public async Task EvaluateRejectsInvalidFinishingBlowTarget()
    {
        var request = new
        {
            chaosThresholdCurrent = 10,
            finishingBlowTarget = 0,
            finishingBlowDamageThisTurn = 0,
            vulnerableAreas = Array.Empty<object>()
        };

        using var response = await _client.PostAsJsonAsync("/api/kaiju/evaluate", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
