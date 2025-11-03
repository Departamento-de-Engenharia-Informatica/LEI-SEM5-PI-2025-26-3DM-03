using Microsoft.EntityFrameworkCore;
using TodoApi.Models;
using TodoApi.Domain.Repositories;
using TodoApi.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authentication;
using System.Security.Claims;
using Microsoft.Extensions.Logging;

// =====================================================
// Application Startup Configuration
// =====================================================

var builder = WebApplication.CreateBuilder(args);

// Explicitly load environment variables for configuration
builder.Configuration.AddEnvironmentVariables();
var configuration = builder.Configuration;

// Ensure the app binds to HTTPS locally by default when running from CLI
// This forces Kestrel to listen on https://localhost:7167 unless overridden
// by ASPNETCORE_URLS or a launch profile. Keeps local dev HTTPS consistent.
builder.WebHost.UseUrls("https://localhost:7167");

// Debug log: confirm ClientId is read correctly
Console.WriteLine($"GOOGLE CLIENT ID: {builder.Configuration["Authentication:Google:ClientId"]}");

// =====================================================
// Service Registration
// =====================================================

// Register controllers
builder.Services.AddControllers();

// Register Entity Framework Core using InMemory database
builder.Services.AddDbContext<PortContext>(opt =>
    opt.UseInMemoryDatabase("PortDB"));

// =====================================================
// Dependency Injection - Application & Domain Services
// =====================================================

// ---------- Docks ----------
builder.Services.AddScoped<TodoApi.Application.Services.Docks.IDockService, TodoApi.Application.Services.Docks.DockService>();
builder.Services.AddScoped<TodoApi.Domain.Repositories.IDockRepository, TodoApi.Infrastructure.Repositories.EfDockRepository>();

// ---------- Vessels ----------
builder.Services.AddScoped<TodoApi.Domain.Repositories.IVesselTypeRepository, TodoApi.Infrastructure.Repositories.EfVesselTypeRepository>();
builder.Services.AddScoped<TodoApi.Application.Services.IVesselTypeService, TodoApi.Application.Services.Vessels.VesselTypeService>();
builder.Services.AddScoped<TodoApi.Application.Services.Vessels.IVesselService, TodoApi.Application.Services.Vessels.VesselService>();
builder.Services.AddScoped<TodoApi.Domain.Repositories.IVesselRepository, TodoApi.Infrastructure.Repositories.EfVesselRepository>();
builder.Services.AddScoped<TodoApi.Application.Services.VesselVisitNotifications.IVesselVisitNotificationService, TodoApi.Application.Services.VesselVisitNotifications.VesselVisitNotificationService>();
builder.Services.AddScoped<TodoApi.Domain.Repositories.IVesselVisitNotificationRepository, TodoApi.Infrastructure.Repositories.EfVesselVisitNotificationRepository>();

// ---------- Qualifications ----------
builder.Services.AddScoped<TodoApi.Domain.Repositories.IQualificationRepository, TodoApi.Infrastructure.Repositories.EfQualificationRepository>();
builder.Services.AddScoped<TodoApi.Application.Services.Qualifications.IQualificationService, TodoApi.Application.Services.Qualifications.QualificationService>();

// ---------- Resources ----------
builder.Services.AddScoped<TodoApi.Domain.Repositories.IResourceRepository, TodoApi.Infrastructure.Repositories.EfResourceRepository>();
builder.Services.AddScoped<TodoApi.Application.Services.Resources.IResourceService, TodoApi.Application.Services.Resources.ResourceService>();

// ---------- Staff ----------
builder.Services.AddScoped<TodoApi.Domain.Repositories.IStaffRepository, TodoApi.Infrastructure.Repositories.EfStaffRepository>();
builder.Services.AddScoped<TodoApi.Application.Services.Staff.IStaffService, TodoApi.Application.Services.Staff.StaffService>();

// ---------- Shipping Agents (Organizations) ----------
builder.Services.AddScoped<TodoApi.Domain.Repositories.IShippingAgentRepository, TodoApi.Infrastructure.Repositories.EfShippingAgentRepository>();
builder.Services.AddScoped<TodoApi.Application.Services.ShippingOrganizations.IShippingAgentService, TodoApi.Application.Services.ShippingOrganizations.ShippingAgentService>();

// ---------- Representatives (Individuals) ----------
builder.Services.AddScoped<TodoApi.Application.Services.Representatives.IRepresentativeService, TodoApi.Application.Services.Representatives.RepresentativeService>();

// ---------- Storage Areas ----------
builder.Services.AddScoped<TodoApi.Domain.Repositories.IStorageAreaRepository, TodoApi.Infrastructure.Repositories.EfStorageAreaRepository>();
builder.Services.AddScoped<TodoApi.Application.Services.StorageAreas.IStorageAreaService, TodoApi.Application.Services.StorageAreas.StorageAreaService>();

// =====================================================
// Swagger / OpenAPI for API documentation
// =====================================================
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// =====================================================
// Authentication and Authorization Configuration
// =====================================================

builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
})
.AddCookie(CookieAuthenticationDefaults.AuthenticationScheme, options =>
{
    // Ensures authentication cookies can flow on HTTPS and cross-site redirects
    options.Cookie.SameSite = Microsoft.AspNetCore.Http.SameSiteMode.None;
    options.Cookie.SecurePolicy = Microsoft.AspNetCore.Http.CookieSecurePolicy.Always;
})
.AddOpenIdConnect(OpenIdConnectDefaults.AuthenticationScheme, options =>
{
    // Authority (issuer) for Google OpenID Connect
    options.Authority = "https://accounts.google.com";

    // Read credentials from appsettings.json or environment variables
    var clientId = configuration["Authentication:Google:ClientId"]
                   ?? Environment.GetEnvironmentVariable("Authentication__Google__ClientId");
    var clientSecret = configuration["Authentication:Google:ClientSecret"]
                       ?? Environment.GetEnvironmentVariable("Authentication__Google__ClientSecret");

    options.ClientId = clientId;
    options.ClientSecret = clientSecret;

    // Validation during development (clearer exception)
    if (string.IsNullOrEmpty(options.ClientId) || string.IsNullOrEmpty(options.ClientSecret))
    {
        throw new InvalidOperationException(
            "Google OpenID Connect ClientId and/or ClientSecret are not configured. " +
            "Set 'Authentication__Google__ClientId' and 'Authentication__Google__ClientSecret' as environment variables, " +
            "add them to appsettings.json, or configure them in .vscode/launch.json for debugging.");
    }

    // Callback path for Google to redirect after login
    options.CallbackPath = "/signin-oidc";

    // Save tokens into the authentication session (for later use)
    options.SaveTokens = true;

    // Use Authorization Code Flow (recommended)
    options.ResponseType = "code";

    // Request these scopes
    options.Scope.Add("email");
    options.Scope.Add("profile");

    // Retrieve additional claims from the user info endpoint
    options.GetClaimsFromUserInfoEndpoint = true;

    // Map useful claims to standard .NET ClaimTypes
    options.ClaimActions.MapUniqueJsonKey(ClaimTypes.Name, "name");
    options.ClaimActions.MapUniqueJsonKey(ClaimTypes.Email, "email");

    // Allow correlation cookies to flow during HTTPS OIDC roundtrip
    options.CorrelationCookie.SameSite = Microsoft.AspNetCore.Http.SameSiteMode.None;
    options.NonceCookie.SameSite = Microsoft.AspNetCore.Http.SameSiteMode.None;

    // =====================================================
    // Diagnostic and Debugging Events for OpenID Connect
    // =====================================================
    options.Events = new OpenIdConnectEvents
    {
        // Fired when redirecting to Google for login
        OnRedirectToIdentityProvider = context =>
        {
            var logger = context.HttpContext.RequestServices.GetService<ILoggerFactory>()?.CreateLogger("OIDC");
            var redirectUri = context.ProtocolMessage.RedirectUri;
            var client = context.ProtocolMessage.ClientId;

            logger?.LogInformation("[OIDC] Redirecting to Google. client_id={ClientId}, redirect_uri={RedirectUri}", client, redirectUri);
            Console.WriteLine($"[OIDC DEBUG] Redirect URI: {redirectUri}");
            Console.WriteLine($"[OIDC DEBUG] Client ID: {client}");

            return Task.CompletedTask;
        },

        // Fired when an authorization code is received. Useful to log the incoming message.
        OnAuthorizationCodeReceived = context =>
        {
            var logger = context.HttpContext.RequestServices.GetService<ILoggerFactory>()?.CreateLogger("OIDC");
            logger?.LogInformation("[OIDC] Authorization code received. RedirectUri={RedirectUri}", context.TokenEndpointRequest?.Parameters?["redirect_uri"] ?? context.Properties?.RedirectUri);
            return Task.CompletedTask;
        },

        // Fired after tokens are validated
        OnTokenValidated = context =>
        {
            var logger = context.HttpContext.RequestServices.GetService<ILoggerFactory>()?.CreateLogger("OIDC");
            logger?.LogInformation("[OIDC] Token validated for user {Name}", context.Principal?.Identity?.Name ?? "(unknown)");
            return Task.CompletedTask;
        },

        // Fired when remote authentication fails (Google returns an error)
        OnRemoteFailure = context =>
        {
            var logger = context.HttpContext.RequestServices.GetService<ILoggerFactory>()?.CreateLogger("OIDC");
            logger?.LogError(context.Failure, "OpenID Connect remote failure: {Message}", context.Failure?.Message);

            // Prevent infinite redirect loops on failure
            context.HandleResponse();
            context.Response.StatusCode = 500;
            return context.Response.WriteAsync("OpenID Connect remote failure: " + (context.Failure?.Message ?? "unknown"));
        },

        // Fired when authentication fails (token validation exception, etc.)
        OnAuthenticationFailed = context =>
        {
            var logger = context.HttpContext.RequestServices.GetService<ILoggerFactory>()?.CreateLogger("OIDC");
            logger?.LogError(context.Exception, "OpenID Connect authentication failed: {Message}", context.Exception?.Message);

            // Write the exception message to the response in Development to assist debugging
            context.HandleResponse();
            context.Response.StatusCode = 500;
            return context.Response.WriteAsync("OpenID Connect authentication failed: " + (context.Exception?.Message ?? "unknown"));
        }
    };
});

// =====================================================
// Build the application and configure middleware pipeline
// =====================================================

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Enable endpoint routing before authentication
app.UseRouting();

// =====================================================
// Simple Middleware for Request Logging
// =====================================================
app.Use(async (context, next) =>
{
    var logger = context.RequestServices.GetService<ILoggerFactory>()?.CreateLogger("RequestLogger");
    logger?.LogInformation("Incoming request: {Method} {Path}", context.Request.Method, context.Request.Path);
    await next();
    logger?.LogInformation("Response status: {StatusCode} for {Method} {Path}", context.Response.StatusCode, context.Request.Method, context.Request.Path);
});

// =====================================================
// Authentication & Authorization Middleware
// =====================================================
app.UseAuthentication();
app.UseAuthorization();

// Map API Controllers
app.MapControllers();

// =====================================================
// Ensure InMemory database is created at startup
// =====================================================
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<PortContext>();
    context.Database.EnsureCreated();
}

// =====================================================
// Run the application
// =====================================================
app.Run();
