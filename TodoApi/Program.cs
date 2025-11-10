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

// Configure Kestrel to listen on localhost:7167 with HTTPS for local development.
// This is more robust than UseUrls and ensures the server has an HTTPS endpoint
// for OIDC callbacks (signin-oidc) while still allowing other bindings when needed.
builder.WebHost.UseKestrel(options =>
{
    options.ListenLocalhost(7167, listenOptions =>
    {
        // enable HTTPS for the OIDC callback endpoint
        listenOptions.UseHttps();
    });
});

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

    // Ensure a fresh OIDC handshake for every login attempt
    context.ProtocolMessage.State = Guid.NewGuid().ToString("N");

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

            // If no local user exists, create a placeholder inactive record and deny login
            if (user == null)
            {
                // Create new local user as INACTIVE by default
                user = new TodoApi.Models.Auth.AppUser
                {
                    ExternalId = sub,
                    Email = email ?? string.Empty,
                    Name = name,
                    Active = false // must be activated manually
                };

                db.AppUsers.Add(user);
                await db.SaveChangesAsync();

                // Deny login immediately and redirect with reason
                var frontendUrl = "https://localhost:4200";
                context.HandleResponse();
                context.Response.Redirect(frontendUrl + "?auth=denied&reason=not_authorized");
                return;
            }

            // Deny access if the local user exists but is inactive
            if (!user.Active)
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
            if (activeRoles.Count == 0)
            {
                var frontendUrl = hostingEnv.IsDevelopment() ? "https://localhost:4200" : "/";
                context.HandleResponse();
                context.Response.Redirect(frontendUrl + "?auth=denied&reason=no_active_roles");
                return;
            }

            // Inject role claims into the ClaimsPrincipal so that [Authorize(Roles=...)] attributes work properly
            var identity = context.Principal?.Identity as ClaimsIdentity;
            if (identity != null)
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
            if (hostingEnv.IsDevelopment())
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
// Ensure InMemory database is created at startup
// =====================================================
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<PortContext>();
    context.Database.EnsureCreated();

    // Development-only safety seed to ensure two ShippingAgents with sample representatives exist
    // even if model seeding is altered. Idempotent: only inserts when missing.
    try
    {
        var has500123456 = await context.ShippingAgents.AnyAsync(x => x.TaxNumber == 500123456L);
        if (!has500123456)
        {
            context.ShippingAgents.Add(new TodoApi.Models.ShippingOrganizations.ShippingAgent
            {
                TaxNumber = 500123456L,
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
                Representatives = new List<TodoApi.Models.Representatives.Representative>
                {
                    new TodoApi.Models.Representatives.Representative("João Silva","C12345","PT","joao.silva@acme.com","+351900000000"),
                    new TodoApi.Models.Representatives.Representative("Maria Costa","C12346","PT","maria.costa@acme.com","+351911111111")
                }
            });
        }

        var has500123457 = await context.ShippingAgents.AnyAsync(x => x.TaxNumber == 500123457L);
        if (!has500123457)
        {
            context.ShippingAgents.Add(new TodoApi.Models.ShippingOrganizations.ShippingAgent
            {
                TaxNumber = 500123457L,
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
                Representatives = new List<TodoApi.Models.Representatives.Representative>
                {
                    new TodoApi.Models.Representatives.Representative("Pedro Azul","C22345","PT","pedro.azul@blueocean.com","+351922222222")
                }
            });
        }

        await context.SaveChangesAsync();
    }
    catch { /* dev seed best-effort */ }
}

// =====================================================
// Run the application
// =====================================================
app.Run();
