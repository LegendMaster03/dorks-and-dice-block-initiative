using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace BlockInitiative.IntegrationTests;

public sealed class HostingContractTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public HostingContractTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });
    }

    [Fact]
    public async Task HealthEndpointIsAvailable()
    {
        using var response = await _client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task ReadinessEndpointIsAvailable()
    {
        using var response = await _client.GetAsync("/ready");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task EmbeddedModuleEntryPointIsAvailable()
    {
        using var response = await _client.GetAsync("/app.js");
        var content = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("tool-root", content, StringComparison.Ordinal);
    }

    [Fact]
    public async Task EmbeddedModuleExposesPrimaryEncounterWorkflow()
    {
        using var response = await _client.GetAsync("/app.js");
        var content = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("Build initiative blocks", content, StringComparison.Ordinal);
        Assert.Contains("+ Kaiju", content, StringComparison.Ordinal);
        Assert.Contains("Apply DM tie order", content, StringComparison.Ordinal);
        Assert.Contains("Start encounter", content, StringComparison.Ordinal);
        Assert.Contains("Next block", content, StringComparison.Ordinal);
        Assert.Contains("Enemy health", content, StringComparison.Ordinal);
        Assert.Contains("Chaos Threshold", content, StringComparison.Ordinal);
        Assert.Contains("Vulnerable Areas", content, StringComparison.Ordinal);
        Assert.Contains("Finishing Blow", content, StringComparison.Ordinal);
        Assert.Contains("Tactical groups", content, StringComparison.Ordinal);
        Assert.Contains("+ Tactical group", content, StringComparison.Ordinal);
        Assert.Contains("+ Another", content, StringComparison.Ordinal);
        Assert.Contains("Rules Core", content, StringComparison.Ordinal);
        Assert.Contains("Roll all enemies", content, StringComparison.Ordinal);
        Assert.Contains("Group d20 roll", content, StringComparison.Ordinal);
        Assert.Contains("there are no manual tactical groups in this mode", content, StringComparison.Ordinal);
        Assert.Contains("Initiative modifier", content, StringComparison.Ordinal);
        Assert.Contains("internal-combatant-fields", content, StringComparison.Ordinal);
        Assert.Contains("bi-hp-fraction", content, StringComparison.Ordinal);
        Assert.Contains("Subtract the adjustment from current HP", content, StringComparison.Ordinal);
        Assert.Contains("Add the adjustment to current HP", content, StringComparison.Ordinal);
        Assert.Contains("ownerDocument.head", content, StringComparison.Ordinal);
        Assert.Contains(":scope > style[data-role]", content, StringComparison.Ordinal);
        Assert.Contains("bi-dense-tracker", content, StringComparison.Ordinal);
        Assert.Contains("bi-roster-header", content, StringComparison.Ordinal);
        Assert.Contains("HP / Adjust", content, StringComparison.Ordinal);
        Assert.Contains("bi-enemy-roster-header", content, StringComparison.Ordinal);
    }

    [Fact]
    public async Task StandaloneShellMountsTheEmbeddedApplication()
    {
        using var response = await _client.GetAsync("/");
        var content = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("id=\"tool-root\"", content, StringComparison.Ordinal);
        Assert.Contains("src=\"/app.js\"", content, StringComparison.Ordinal);
    }
}
