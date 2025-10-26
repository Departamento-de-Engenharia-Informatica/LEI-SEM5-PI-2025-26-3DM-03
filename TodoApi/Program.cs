using Microsoft.EntityFrameworkCore;
using TodoApi.Models;
using TodoApi.Domain.Repositories;
using TodoApi.Infrastructure.Repositories;


var builder = WebApplication.CreateBuilder(args);

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
// Build and configure the HTTP request pipeline
// =====================================================

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
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
