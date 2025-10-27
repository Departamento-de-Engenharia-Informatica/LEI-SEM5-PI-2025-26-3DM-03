using Microsoft.EntityFrameworkCore;
using TodoApi.Models;
using TodoApi.Domain.Repositories;
using TodoApi.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authentication;
using System.Security.Claims;


var builder = WebApplication.CreateBuilder(args);
var configuration = builder.Configuration;

// =====================================================
// Add services to the dependency injection container
// =====================================================

// Register controllers
builder.Services.AddControllers();

// Configure Entity Framework Core with InMemory database
builder.Services.AddDbContext<PortContext>(opt =>
    opt.UseInMemoryDatabase("PortDB"));

// =====================================================
// Register application services and repositories
// =====================================================

// Docks
builder.Services.AddScoped<TodoApi.Application.Services.Docks.IDockService, TodoApi.Application.Services.Docks.DockService>();
builder.Services.AddScoped<TodoApi.Domain.Repositories.IDockRepository, TodoApi.Infrastructure.Repositories.EfDockRepository>();

// Vessels
builder.Services.AddScoped<TodoApi.Domain.Repositories.IVesselTypeRepository, TodoApi.Infrastructure.Repositories.EfVesselTypeRepository>();
builder.Services.AddScoped<TodoApi.Application.Services.IVesselTypeService, TodoApi.Application.Services.Vessels.VesselTypeService>();
builder.Services.AddScoped<TodoApi.Application.Services.Vessels.IVesselService, TodoApi.Application.Services.Vessels.VesselService>();
builder.Services.AddScoped<TodoApi.Domain.Repositories.IVesselRepository, TodoApi.Infrastructure.Repositories.EfVesselRepository>();
builder.Services.AddScoped<TodoApi.Application.Services.VesselVisitNotifications.IVesselVisitNotificationService, TodoApi.Application.Services.VesselVisitNotifications.VesselVisitNotificationService>();
builder.Services.AddScoped<TodoApi.Domain.Repositories.IVesselVisitNotificationRepository, TodoApi.Infrastructure.Repositories.EfVesselVisitNotificationRepository>();

// Qualifications
builder.Services.AddScoped<TodoApi.Domain.Repositories.IQualificationRepository, TodoApi.Infrastructure.Repositories.EfQualificationRepository>();
builder.Services.AddScoped<TodoApi.Application.Services.Qualifications.IQualificationService, TodoApi.Application.Services.Qualifications.QualificationService>();

// Resources
builder.Services.AddScoped<TodoApi.Domain.Repositories.IResourceRepository, TodoApi.Infrastructure.Repositories.EfResourceRepository>();
builder.Services.AddScoped<TodoApi.Application.Services.Resources.IResourceService, TodoApi.Application.Services.Resources.ResourceService>();

// Staff
builder.Services.AddScoped<TodoApi.Domain.Repositories.IStaffRepository, TodoApi.Infrastructure.Repositories.EfStaffRepository>();
builder.Services.AddScoped<TodoApi.Application.Services.Staff.IStaffService, TodoApi.Application.Services.Staff.StaffService>();

// Shipping Agents (Organizations)
builder.Services.AddScoped<TodoApi.Domain.Repositories.IShippingAgentRepository, TodoApi.Infrastructure.Repositories.EfShippingAgentRepository>();
builder.Services.AddScoped<TodoApi.Application.Services.ShippingOrganizations.IShippingAgentService, TodoApi.Application.Services.ShippingOrganizations.ShippingAgentService>();

// Representatives (Individuals)
builder.Services.AddScoped<TodoApi.Application.Services.Representatives.IRepresentativeService, TodoApi.Application.Services.Representatives.RepresentativeService>();

// Storage Areas
builder.Services.AddScoped<TodoApi.Domain.Repositories.IStorageAreaRepository, TodoApi.Infrastructure.Repositories.EfStorageAreaRepository>();
builder.Services.AddScoped<TodoApi.Application.Services.StorageAreas.IStorageAreaService, TodoApi.Application.Services.StorageAreas.StorageAreaService>();


// =====================================================
// Swagger configuration (for API documentation/testing)
// =====================================================

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// =====================================================
// Authentication (Google OpenID Connect)
// =====================================================

builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
})
    .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddOpenIdConnect(OpenIdConnectDefaults.AuthenticationScheme, options =>
    {
        // Authority for Google OpenID Connect
        options.Authority = "https://accounts.google.com";

        // Read client id/secret from configuration: Authentication:Google
        options.ClientId = configuration["Authentication:Google:ClientId"];
        options.ClientSecret = configuration["Authentication:Google:ClientSecret"];

        // Callback path
        options.CallbackPath = "/signin-oidc";

        // Save tokens so they are available after sign-in
        options.SaveTokens = true;

        // Use authorization code flow
        options.ResponseType = "code";

        // Request email and profile scopes
        options.Scope.Add("email");
        options.Scope.Add("profile");

        // Get claims from the userinfo endpoint
        options.GetClaimsFromUserInfoEndpoint = true;

        // Map common claims
        options.ClaimActions.MapUniqueJsonKey(ClaimTypes.Name, "name");
        options.ClaimActions.MapUniqueJsonKey(ClaimTypes.Email, "email");
    });

// =====================================================
// Build and configure the HTTP request pipeline
// =====================================================

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
// Ensure authentication middleware runs before authorization
app.UseAuthentication();
app.UseAuthorization();

// Map all controllers
app.MapControllers();

// =====================================================
// Ensure InMemory database is created at startup
// =====================================================

using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<PortContext>();
    context.Database.EnsureCreated();
}

// Run the application
app.Run();
