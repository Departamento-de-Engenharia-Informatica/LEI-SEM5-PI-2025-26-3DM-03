using Microsoft.EntityFrameworkCore;
using TodoApi.Models;
using TodoApi.Domain.Repositories;
using TodoApi.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authentication;
using System.Security.Claims;
using System.Linq;
using Microsoft.Extensions.Logging;
using TodoApi.Models.Auth;

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

// CORS for Angular dev server (allow cookies)
builder.Services.AddCors(o =>
{
    o.AddPolicy("AllowAngularDev", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

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
        OnTokenValidated = async context =>
        {
            var logger = context.HttpContext.RequestServices.GetService<ILoggerFactory>()?.CreateLogger("OIDC");

            var sub = context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? context.Principal?.FindFirst("sub")?.Value;
            var email = context.Principal?.FindFirst(ClaimTypes.Email)?.Value ?? context.Principal?.FindFirst("email")?.Value;
            var name = context.Principal?.FindFirst(ClaimTypes.Name)?.Value ?? context.Principal?.Identity?.Name;

            logger?.LogInformation("[OIDC] Token validated for user {Name}, sub={Sub}, email={Email}", name, sub, email);

            // Use a scoped DbContext to find/create the local user and check roles
            using var scope = context.HttpContext.RequestServices.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PortContext>();

            TodoApi.Models.Auth.AppUser? user = null;
            if (!string.IsNullOrEmpty(sub))
            {
                user = await db.AppUsers.Include(u => u.UserRoles).ThenInclude(ur => ur.Role).FirstOrDefaultAsync(u => u.ExternalId == sub);
            }

            if (user == null && !string.IsNullOrEmpty(email))
            {
                user = await db.AppUsers.Include(u => u.UserRoles).ThenInclude(ur => ur.Role).FirstOrDefaultAsync(u => u.Email == email);
            }

            // If the local user was found by email but doesn't yet have the provider's 'sub' (ExternalId),
            // persist it so future logins can match by the stable ExternalId.
            if (user != null && !string.IsNullOrEmpty(sub) && string.IsNullOrEmpty(user.ExternalId))
            {
                user.ExternalId = sub;
                db.AppUsers.Update(user);
                await db.SaveChangesAsync();
            }

            if (user == null)
            {
                // Create a placeholder local user with no active role. Admin must assign role later.
                user = new TodoApi.Models.Auth.AppUser
                {
                    ExternalId = sub,
                    Email = email ?? string.Empty,
                    Name = name,
                    Active = false
                };

                db.AppUsers.Add(user);
                await db.SaveChangesAsync();

                // Reject login because there is no role assigned yet
                context.HandleResponse();
                context.Response.StatusCode = 403;
                await context.Response.WriteAsync("Utilizador sem role atribuída. Contacte o administrador.");
                return;
            }

            if (!user.Active)
            {
                context.HandleResponse();
                context.Response.StatusCode = 403;
                await context.Response.WriteAsync("Utilizador inativo. Contacte o administrador.");
                return;
            }

            var activeRoles = user.UserRoles?.Where(ur => ur.Role != null && ur.Role.Active).Select(ur => ur.Role.Name).ToList() ?? new List<string>();
            if (activeRoles.Count == 0)
            {
                context.HandleResponse();
                context.Response.StatusCode = 403;
                await context.Response.WriteAsync("Utilizador sem role atribuída. Contacte o administrador.");
                return;
            }

            // Inject role claims into the ClaimsPrincipal so [Authorize(Roles=...)] works
            var identity = context.Principal?.Identity as ClaimsIdentity;
            if (identity != null)
            {
                foreach (var r in activeRoles)
                {
                    identity.AddClaim(new Claim(ClaimTypes.Role, r));
                }

                // Add a claim with the local user id for convenience
                identity.AddClaim(new Claim("app_user_id", user.Id.ToString()));
            }

            return;
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

// Allow cross-origin requests from Angular dev server (cookies)
app.UseCors("AllowAngularDev");

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
