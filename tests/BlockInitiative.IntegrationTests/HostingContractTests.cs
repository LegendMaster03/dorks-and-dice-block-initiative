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
        Assert.Contains("Roll all enemy members", content, StringComparison.Ordinal);
        Assert.Contains("Roll average", content, StringComparison.Ordinal);
        Assert.Contains("Single roll", content, StringComparison.Ordinal);
        Assert.Contains("average initiative", content, StringComparison.Ordinal);
        Assert.Contains("there are no manual tactical groups in this mode", content, StringComparison.Ordinal);
        Assert.Contains("Tactical groups are DM-authored roster units", content, StringComparison.Ordinal);
        Assert.Contains("not rolled", content, StringComparison.Ordinal);
        Assert.Contains("Initiative modifier", content, StringComparison.Ordinal);
        Assert.Contains("internal-combatant-fields", content, StringComparison.Ordinal);
        Assert.Contains("bi-hp-editor", content, StringComparison.Ordinal);
        Assert.Contains("bi-hp-popover", content, StringComparison.Ordinal);
        Assert.Contains("Edit or adjust hit points", content, StringComparison.Ordinal);
        Assert.Contains("Modify by", content, StringComparison.Ordinal);
        Assert.Contains("Subtract the modifier from current HP", content, StringComparison.Ordinal);
        Assert.Contains("Add the modifier to current HP", content, StringComparison.Ordinal);
        Assert.Contains("ownerDocument.head", content, StringComparison.Ordinal);
        Assert.Contains(":scope > style[data-role]", content, StringComparison.Ordinal);
        Assert.Contains("bi-dense-tracker", content, StringComparison.Ordinal);
        Assert.Contains("bi-roster-header", content, StringComparison.Ordinal);
        Assert.Contains("<span>HP</span>", content, StringComparison.Ordinal);
        Assert.Contains("bi-enemy-roster-header", content, StringComparison.Ordinal);
        Assert.Contains("grid-template-columns:minmax(16rem,34rem) 5rem 13rem 6rem auto", content, StringComparison.Ordinal);
        Assert.Contains("grid-column:4;grid-row:1", content, StringComparison.Ordinal);
        Assert.Contains("bi-kaiju-basics-compact", content, StringComparison.Ordinal);
        Assert.Contains("bi-kaiju-pool-editor", content, StringComparison.Ordinal);
        Assert.Contains("Edit or adjust Chaos", content, StringComparison.Ordinal);
        Assert.Contains("Edit or adjust vulnerable area HP", content, StringComparison.Ordinal);
        Assert.Contains("bi-kaiju-area-header", content, StringComparison.Ordinal);
        Assert.Contains("<span>Targetable</span>", content, StringComparison.Ordinal);
        Assert.Contains("bi-duplicate-actions", content, StringComparison.Ordinal);
        Assert.Contains("Add another", content, StringComparison.Ordinal);
        Assert.Contains("manualDuplicateIndex", content, StringComparison.Ordinal);
        Assert.Contains("+ Different enemy", content, StringComparison.Ordinal);
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
