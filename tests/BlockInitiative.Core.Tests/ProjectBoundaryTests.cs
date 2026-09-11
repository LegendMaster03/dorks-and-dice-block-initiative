namespace BlockInitiative.Core.Tests;

public sealed class ProjectBoundaryTests
{
    [Fact]
    public void CoreDoesNotReferenceOtherBlockInitiativeProjects()
    {
        var references = typeof(CoreAssembly)
            .Assembly
            .GetReferencedAssemblies()
            .Select(reference => reference.Name)
            .Where(name => name is not null)
            .ToArray();

        Assert.DoesNotContain(
            references,
            name => name!.StartsWith("BlockInitiative.", StringComparison.Ordinal));
    }
}
