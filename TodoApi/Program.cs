using Microsoft.AspNetCore.Hosting;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TodoApi.Models;
using TodoApi.Domain.Repositories;
using TodoApi.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authentication;
using System.Collections.Generic;
using System.IO;
using System.Security.Claims;
using System.Linq;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi.Models;
using TodoApi.Application.Services.Scheduling;
using TodoApi.Application.Services.Scheduling.Engines;
using TodoApi.Models.Auth;
using TodoApi.Models.PublicResources;
using TodoApi.Models.Scheduling;
using TodoApi.Services.Activation;

// =====================================================
// Application Startup Configuration
// =====================================================

var builder = WebApplication.CreateBuilder(args);

// Explicitly load environment variables for configuration
builder.Configuration.AddEnvironmentVariables();
var configuration = builder.Configuration;

// Shared resources folder configuration (ensure folder exists on boot)
var sharedResourcesSetting = configuration["SharedResources:Root"];
var contentRoot = builder.Environment.ContentRootPath ?? Directory.GetCurrentDirectory();
var sharedResourcesRoot = string.IsNullOrWhiteSpace(sharedResourcesSetting)
    ? Path.Combine(contentRoot, "storage", "public")
    : (Path.IsPathRooted(sharedResourcesSetting)
        ? sharedResourcesSetting
        : Path.Combine(contentRoot, sharedResourcesSetting));
sharedResourcesRoot = Path.GetFullPath(sharedResourcesRoot);
Directory.CreateDirectory(sharedResourcesRoot);
builder.Services.Configure<SharedResourcesOptions>(options =>
{
    options.RootPath = sharedResourcesRoot;
});

// Scheduling options (Prolog bridge)
builder.Services.Configure<SchedulingOptions>(configuration.GetSection("Scheduling"));
builder.Services.AddHttpClient<PrologHttpSchedulingEngine>((sp, client) =>
{
    var schedulingOptions = sp.GetRequiredService<IOptions<SchedulingOptions>>().Value;
    if (!string.IsNullOrWhiteSpace(schedulingOptions.PrologBaseUrl))
    {
        client.BaseAddress = new Uri(schedulingOptions.PrologBaseUrl);
    }
});

// Configure Kestrel only for local development. In containers or non-dev
// environments, rely on ASPNETCORE_URLS (e.g., http://0.0.0.0:8080) and
// platform-provided TLS termination.
if (builder.Environment.IsDevelopment())
{
    builder.WebHost.UseKestrel(options =>
    {
        options.ListenLocalhost(7167, listenOptions =>
        {
            // enable HTTPS for the OIDC callback endpoint
            listenOptions.UseHttps();
        });
    });
}

// Debug log: confirm ClientId is read correctly
Console.WriteLine($"GOOGLE CLIENT ID: {builder.Configuration["Authentication:Google:ClientId"]}");

// =====================================================
// Service Registration
// =====================================================

// Register controllers
builder.Services.AddControllers();

// CORS for Angular dev server (allow cookies). Allow both http and https localhost for dev servers
builder.Services.AddCors(o =>
{
    o.AddPolicy("AllowAngularDev", policy =>
    {
        // Only allow the HTTPS dev server origin so cookies marked Secure are accepted.
        policy.WithOrigins("https://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Register Entity Framework Core using SQLite (persistent, zero-setup for dev)
builder.Services.AddDbContext<PortContext>(opt =>
    opt.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

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

// ---------- Scheduling ----------
builder.Services.AddScoped<ISchedulingService, SchedulingService>();
builder.Services.AddScoped<IOperationalDataProvider, PassThroughOperationalDataProvider>();
builder.Services.AddScoped<ISchedulingEngine, MockSchedulingEngine>();
builder.Services.AddScoped<ISchedulingEngine>(sp => sp.GetRequiredService<PrologHttpSchedulingEngine>());

// ---------- Staff ----------
builder.Services.AddScoped<TodoApi.Domain.Repositories.IStaffRepository, TodoApi.Infrastructure.Repositories.EfStaffRepository>();
builder.Services.AddScoped<TodoApi.Application.Services.Staff.IStaffService, TodoApi.Application.Services.Staff.StaffService>();

// ---------- Shipping Agents (Organizations) ----------
builder.Services.AddScoped<TodoApi.Domain.Repositories.IShippingAgentRepository, TodoApi.Infrastructure.Repositories.EfShippingAgentRepository>();
builder.Services.AddScoped<TodoApi.Application.Services.ShippingOrganizations.IShippingAgentService, TodoApi.Application.Services.ShippingOrganizations.ShippingAgentService>();

// ---------- Representatives (Individuals) ----------
builder.Services.AddScoped<TodoApi.Application.Services.Representatives.IRepresentativeService, TodoApi.Application.Services.Representatives.RepresentativeService>();

// ---------- Visualization / Port Layout ----------
builder.Services.AddScoped<TodoApi.Application.Services.Visualization.IPortLayoutService, TodoApi.Application.Services.Visualization.PortLayoutService>();

// ---------- Storage Areas ----------
builder.Services.AddScoped<TodoApi.Domain.Repositories.IStorageAreaRepository, TodoApi.Infrastructure.Repositories.EfStorageAreaRepository>();
builder.Services.AddScoped<TodoApi.Application.Services.StorageAreas.IStorageAreaService, TodoApi.Application.Services.StorageAreas.StorageAreaService>();

// ---------- Activation ----------
builder.Services.Configure<ActivationOptions>(builder.Configuration.GetSection("Activation"));
builder.Services.AddScoped<ActivationLinkService>();

// =====================================================
// Swagger / OpenAPI for API documentation
// =====================================================
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.MapType<Microsoft.AspNetCore.Http.IFormFile>(() => new OpenApiSchema
    {
        Type = "string",
        Format = "binary"
    });
});

// =====================================================
// Authentication and Authorization Configuration
// =====================================================

// Allow disabling OIDC via environment variable for CI/containers where
// interactive login is not required. Set DISABLE_OIDC=true to skip OIDC.
var disableOidc = configuration.GetValue<bool>("DisableOidc")
                 || string.Equals(Environment.GetEnvironmentVariable("DISABLE_OIDC"), "true", StringComparison.OrdinalIgnoreCase);

if (disableOidc)
{
    builder.Services.AddAuthentication(options =>
    {
        options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    })
    .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme, options =>
    {
        options.Cookie.SameSite = Microsoft.AspNetCore.Http.SameSiteMode.None;
        options.Cookie.SecurePolicy = Microsoft.AspNetCore.Http.CookieSecurePolicy.Always;
    });
}
else
{
    builder.Services.AddAuthentication(options =>
    {
        options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
    })
    .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme, options =>
    {
        // Ensures authentication cookies can flow on HTTPS and cross-site redirects
        // Use SameSite=None so the authentication cookie is sent on cross-site requests
        // (SPA on a different origin during development). Modern browsers require the
        // cookie to also be Secure when SameSite=None, so we set SecurePolicy=Always.
        options.Cookie.SameSite = Microsoft.AspNetCore.Http.SameSiteMode.None;
        options.Cookie.SecurePolicy = Microsoft.AspNetCore.Http.CookieSecurePolicy.Always;
        // Do not set Cookie.Domain for localhost; setting a Domain on 'localhost' can
        // prevent browsers from storing the cookie. Leave host-only for local dev.
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
        // Map Google profile picture into the claims principal so the SPA can display the avatar
        options.ClaimActions.MapUniqueJsonKey("picture", "picture");

        // Allow correlation cookies to flow during HTTPS OIDC roundtrip
        options.CorrelationCookie.SameSite = Microsoft.AspNetCore.Http.SameSiteMode.None;
        options.NonceCookie.SameSite = Microsoft.AspNetCore.Http.SameSiteMode.None;
        // Ensure correlation/nonce cookies are Secure as well (required with SameSite=None)
        options.CorrelationCookie.SecurePolicy = Microsoft.AspNetCore.Http.CookieSecurePolicy.Always;
        options.NonceCookie.SecurePolicy = Microsoft.AspNetCore.Http.CookieSecurePolicy.Always;

        // =====================================================
        // Diagnostic and Debugging Events for OpenID Connect
        // =====================================================
        options.Events = new OpenIdConnectEvents
    {
        // Fired when redirecting to Google for login
        OnRedirectToIdentityProvider = async context =>
    {
        // Clear existing local authentication cookie before starting new login
        await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        
        // Force the redirect_uri to match exactly what is registered in Google Cloud
        context.ProtocolMessage.RedirectUri = "https://localhost:7167/signin-oidc";

        // Always show the Google account picker to avoid auto-login with the last account
        context.ProtocolMessage.Prompt = "select_account";

        // Prevent Google from reusing the previous login session
        context.ProtocolMessage.LoginHint = null;

        var logger = context.HttpContext.RequestServices.GetService<ILoggerFactory>()?.CreateLogger("OIDC");
        logger?.LogInformation("[OIDC] Redirecting to Google with forced redirect_uri={RedirectUri}", context.ProtocolMessage.RedirectUri);

        Console.WriteLine($"[OIDC FIX] Forced redirect_uri: {context.ProtocolMessage.RedirectUri}");
        Console.WriteLine($"[OIDC FIX] ClientId: {context.ProtocolMessage.ClientId}");
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

                var sub   = context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? context.Principal?.FindFirst("sub")?.Value;
                var email = context.Principal?.FindFirst(ClaimTypes.Email)?.Value ?? context.Principal?.FindFirst("email")?.Value;
                var name  = context.Principal?.FindFirst(ClaimTypes.Name)?.Value ?? context.Principal?.Identity?.Name;
                var isActivationFlow = context.Properties?.Items?.ContainsKey("activation_flow") == true;

                var hostingEnv = context.HttpContext.RequestServices.GetRequiredService<Microsoft.AspNetCore.Hosting.IWebHostEnvironment>();
                using var scope = context.HttpContext.RequestServices.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<PortContext>();

                // Try to find the local user either by the provider's ExternalId (sub) or by email
                AppUser? user = null;
                if (!string.IsNullOrEmpty(sub))
                {
                    user = await db.AppUsers
                        .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                        .FirstOrDefaultAsync(u => u.ExternalId == sub);
                }
                if (user == null && !string.IsNullOrEmpty(email))
                {
                    user = await db.AppUsers
                        .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                        .FirstOrDefaultAsync(u => u.Email == email);
                }

                // If the local user was found by email but doesn’t yet have the provider’s ExternalId,
                // persist it so that future logins can match by the stable ExternalId.
                if (user != null && !string.IsNullOrEmpty(sub) && string.IsNullOrEmpty(user.ExternalId))
                {
                    user.ExternalId = sub;
                    db.AppUsers.Update(user);
                    await db.SaveChangesAsync();
                }

                // If no local user exists, deny login and instruct admin to create account
                if (user == null)
                {
                    var frontendUrl = hostingEnv.IsDevelopment() ? "https://localhost:4200" : "/";
                    context.HandleResponse();
                    context.Response.Redirect(frontendUrl + "?auth=denied&reason=not_authorized");
                    return;
                }

                // Deny access if the local user exists but is inactive
                if (!user.Active && !isActivationFlow)
                {
                    var frontendUrl = hostingEnv.IsDevelopment() ? "https://localhost:4200" : "/";
                    context.HandleResponse();
                    context.Response.Redirect(frontendUrl + "?auth=denied&reason=inactive");
                    return;
                }

                // Retrieve the list of active roles assigned to the user
                var activeRoles = user.UserRoles?
                    .Where(ur => ur.Role != null && ur.Role.Active)
                    .Select(ur => ur.Role.Name)
                    .ToList() ?? new List<string>();

                // Deny access if the user has no active roles
                if (activeRoles.Count == 0 && !isActivationFlow)
                {
                    var frontendUrl = hostingEnv.IsDevelopment() ? "https://localhost:4200" : "/";
                    context.HandleResponse();
                    context.Response.Redirect(frontendUrl + "?auth=denied&reason=no_active_roles");
                    return;
                }

                // Inject role claims into the ClaimsPrincipal so that [Authorize(Roles=...)] attributes work properly
                var identity = context.Principal?.Identity as ClaimsIdentity;
                if (identity != null && user.Active)
                {
                    foreach (var r in activeRoles)
                        identity.AddClaim(new Claim(ClaimTypes.Role, r));

                    identity.AddClaim(new Claim("app_user_id", user.Id.ToString()));
                }

                // In Development, after successful validation, redirect back to the SPA.
                // Important: do NOT call HandleResponse()/Response.Redirect() here because the
                // OpenID Connect handler still needs to perform the SignIn (issue the cookie).
                // Instead, set the authentication properties RedirectUri so the handler will
                // complete the sign-in and perform the redirect after creating the cookie.
                if (hostingEnv.IsDevelopment() && string.IsNullOrEmpty(context.Properties?.RedirectUri))
                {
                    context.Properties ??= new AuthenticationProperties();
                    context.Properties.RedirectUri = "https://localhost:4200?auth=ok";
                }

                // Let the normal handler continue so SignInAsync can issue the cookie and
                // then perform the redirect to the configured RedirectUri.
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
}

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("PublicResources.Read", policy =>
    {
        policy.RequireAuthenticatedUser();
    });
    options.AddPolicy("PublicResources.Write", policy =>
    {
        policy.RequireAuthenticatedUser().RequireRole("Admin");
    });
});

// =====================================================
// Build the application and configure middleware pipeline
// =====================================================

var app = builder.Build();
app.UseMiddleware<TodoApi.Security.NetworkRestrictionMiddleware>();

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
// Enforce that API routes only accept users that have a corresponding local AppUser
// with at least one active role. This prevents any external authenticated principal
// from calling internal API endpoints unless an admin has created/activated a local account.
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api"))
    {
        if (context.User?.Identity?.IsAuthenticated != true)
        {
            await next();
            return;
        }

        using var scope = context.RequestServices.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PortContext>();

        var sub = context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                  ?? context.User.FindFirst("sub")?.Value;
        var email = context.User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
                    ?? context.User.FindFirst("email")?.Value;

        TodoApi.Models.Auth.AppUser? user = null;
        if (!string.IsNullOrEmpty(sub))
        {
            user = await db.AppUsers
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.ExternalId == sub);
        }
        if (user == null && !string.IsNullOrEmpty(email))
        {
            user = await db.AppUsers
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Email == email);
        }

        var hasActiveRole = user?.UserRoles?.Any(ur => ur.Role != null && ur.Role.Active) == true;
        if (user == null || !user.Active || !hasActiveRole)
        {
            context.Response.StatusCode = 403;
            await context.Response.WriteAsJsonAsync(new { message = "Access denied: user has no local active account/role." });
            return;
        }
    }

    await next();
});
app.UseAuthorization();

// Map API Controllers
app.MapControllers();

// =====================================================
// Apply EF Core migrations at startup (create/update SQL database)
// =====================================================
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<PortContext>();
    var loggerFactory = scope.ServiceProvider.GetService<ILoggerFactory>();
    var startupLogger = loggerFactory?.CreateLogger("Startup");

    var forcedReset = false;
    if (await ShouldRecreateSqliteDatabaseAsync(context, startupLogger, app.Environment.ContentRootPath))
    {
        startupLogger?.LogWarning("Recreating SQLite database so EF Core migrations can be applied cleanly.");
        await context.Database.EnsureDeletedAsync();
        forcedReset = true;
    }

    var migrationAttempt = 0;
    while (true)
    {
        try
        {
            await context.Database.MigrateAsync();
            break;
        }
        catch (SqliteException ex) when (migrationAttempt == 0 && !forcedReset && ShouldResetOnSqliteSchemaConflict(ex))
        {
            startupLogger?.LogWarning(ex, "Encountered SQLite schema conflict during migration. Deleting database and retrying once.");
            await context.Database.EnsureDeletedAsync();
            migrationAttempt++;
            continue;
        }
    }
    await EnsureRoleChangeColumnsAsync(context, loggerFactory);

    try
    {
        // ---------- ACME 500123456 ----------
        var acme = await context.ShippingAgents
            .Include(sa => sa.Representatives)
            .FirstOrDefaultAsync(sa => sa.TaxNumber == 500123456);

        if (acme == null)
        {
            acme = new TodoApi.Models.ShippingOrganizations.ShippingAgent
            {
                TaxNumber = 500123456,
                LegalName = "Acme Shipping S.A.",
                AlternativeName = "Acme",
                Type = new TodoApi.Models.ShippingOrganizations.ShippingAgentType("Owner"),
                Address = new TodoApi.Models.ShippingOrganizations.Address
                {
                    Street = "Rua A",
                    City = "Porto",
                    PostalCode = "4000-000",
                    Country = "PT"
                },
                Representatives = new List<TodoApi.Models.Representatives.Representative>()
            };

            context.ShippingAgents.Add(acme);
        }

        if (acme.Representatives == null || !acme.Representatives.Any())
        {
            acme.Representatives = new List<TodoApi.Models.Representatives.Representative>
            {
                new TodoApi.Models.Representatives.Representative(
                    "João Silva","C12345","PT","joao.silva@acme.com","+351900000000"),
                new TodoApi.Models.Representatives.Representative(
                    "Maria Costa","C12346","PT","maria.costa@acme.com","+351911111111")
            };
        }

        // ---------- BLUE OCEAN 500123457 ----------
        var blue = await context.ShippingAgents
            .Include(sa => sa.Representatives)
            .FirstOrDefaultAsync(sa => sa.TaxNumber == 500123457);

        if (blue == null)
        {
            blue = new TodoApi.Models.ShippingOrganizations.ShippingAgent
            {
                TaxNumber = 500123457,
                LegalName = "Blue Ocean Lda",
                AlternativeName = "BlueOcean",
                Type = new TodoApi.Models.ShippingOrganizations.ShippingAgentType("Operator"),
                Address = new TodoApi.Models.ShippingOrganizations.Address
                {
                    Street = "Avenida B",
                    City = "Lisboa",
                    PostalCode = "1000-000",
                    Country = "PT"
                },
                Representatives = new List<TodoApi.Models.Representatives.Representative>()
            };

            context.ShippingAgents.Add(blue);
        }

        if (blue.Representatives == null || !blue.Representatives.Any())
        {
            blue.Representatives = new List<TodoApi.Models.Representatives.Representative>
            {
                new TodoApi.Models.Representatives.Representative(
                    "Pedro Azul","C22345","PT","pedro.azul@blueocean.com","+351922222222")
            };
        }

        await context.SaveChangesAsync();
    }
    catch
    {
        // dev seed best-effort
    }
}

// =====================================================
// Run the application
// =====================================================
app.Run();

static async Task<bool> ShouldRecreateSqliteDatabaseAsync(PortContext context, ILogger? logger, string? contentRootPath)
{
    try
    {
        var pending = await context.Database.GetPendingMigrationsAsync();
        if (!pending.Any())
        {
            return false;
        }

        var applied = await context.Database.GetAppliedMigrationsAsync();
        if (applied.Any())
        {
            return false;
        }

        if (!context.Database.IsSqlite())
        {
            return false;
        }

        var builder = new SqliteConnectionStringBuilder(context.Database.GetDbConnection().ConnectionString);
        var dataSource = builder.DataSource;
        if (string.IsNullOrWhiteSpace(dataSource))
        {
            return false;
        }

        var basePath = !string.IsNullOrWhiteSpace(contentRootPath)
            ? contentRootPath!
            : Directory.GetCurrentDirectory();
        var absolutePath = Path.IsPathRooted(dataSource)
            ? dataSource
            : Path.GetFullPath(Path.Combine(basePath, dataSource));

        builder.DataSource = absolutePath;

        await using var connection = new SqliteConnection(builder.ToString());
        await connection.OpenAsync();

        await using (var command = connection.CreateCommand())
        {
            command.CommandText =
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('__EFMigrationsHistory','__EFMigrationsLock');";
            var result = await command.ExecuteScalarAsync();
            var existingTables = Convert.ToInt32(result ?? 0);
            if (existingTables > 0)
            {
                logger?.LogWarning("Detected {Count} existing SQLite tables without migration history. Database file: {File}", existingTables, absolutePath);
                return true;
            }
        }
    }
    catch (Exception ex)
    {
        logger?.LogWarning(ex, "Failed to inspect SQLite database for migration history issues.");
    }

    return false;
}

static bool ShouldResetOnSqliteSchemaConflict(SqliteException ex)
{
    if (ex.SqliteErrorCode == 1 && ex.Message.Contains("already exists", StringComparison.OrdinalIgnoreCase))
    {
        return true;
    }

    return false;
}

static async Task EnsureRoleChangeColumnsAsync(PortContext context, ILoggerFactory? loggerFactory)
{
    var logger = loggerFactory?.CreateLogger("Startup");
    var conn = context.Database.GetDbConnection();
    try
    {
        await conn.OpenAsync();
        var existing = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = "PRAGMA table_info('AppUsers');";
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                if (!reader.IsDBNull(1))
                {
                    existing.Add(reader.GetString(1));
                }
            }
        }

        var statements = new List<string>();
        if (!existing.Contains("LastRoleChangeSentUtc"))
            statements.Add("ALTER TABLE AppUsers ADD COLUMN LastRoleChangeSentUtc TEXT");
        if (!existing.Contains("LastRoleChangeSummary"))
            statements.Add("ALTER TABLE AppUsers ADD COLUMN LastRoleChangeSummary TEXT");
        if (!existing.Contains("LastRoleChangeConfirmedUtc"))
            statements.Add("ALTER TABLE AppUsers ADD COLUMN LastRoleChangeConfirmedUtc TEXT");

        foreach (var sql in statements)
        {
            using var alter = conn.CreateCommand();
            alter.CommandText = sql;
            await alter.ExecuteNonQueryAsync();
            logger?.LogInformation("Applied fallback column addition: {Sql}", sql);
        }
    }
    catch (Exception ex)
    {
        logger?.LogWarning(ex, "Failed to ensure role change columns via fallback");
    }
    finally
    {
        if (conn.State == System.Data.ConnectionState.Open)
        {
            await conn.CloseAsync();
        }
    }
}
