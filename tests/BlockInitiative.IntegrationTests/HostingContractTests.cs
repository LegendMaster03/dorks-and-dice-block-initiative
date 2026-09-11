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
