using BlockInitiative.Web.Combat;
using BlockInitiative.Web.Initiative;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHealthChecks();

var app = builder.Build();

app.UseStaticFiles();

app.MapHealthChecks("/health");

app.MapGet("/ready", () => Results.Ok(new
{
    status = "ready"
}));

app.MapGet("/api", () => Results.Ok(new
{
    service = "Block Initiative API",
    version = "0.1-dev",
    status = "initiative-and-combat-tracking"
}));

app.MapInitiativePreviewEndpoints();
app.MapKaijuTrackingEndpoints();

app.MapGet("/", () => Results.Content(
    """
    <!doctype html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Block Initiative</title>
    </head>
    <body>
        <main id="tool-root"></main>
        <script type="module" src="/app.js"></script>
    </body>
    </html>
    """,
    "text/html; charset=utf-8"));

app.Run();

public partial class Program;
