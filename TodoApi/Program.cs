using Microsoft.EntityFrameworkCore;
using TodoApi.Models;

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

// Vessels
builder.Services.AddScoped<TodoApi.Domain.Repositories.IVesselTypeRepository, TodoApi.Infrastructure.Repositories.EfVesselTypeRepository>();
builder.Services.AddScoped<TodoApi.Application.Services.IVesselTypeService, TodoApi.Application.Services.Vessels.VesselTypeService>();
builder.Services.AddScoped<TodoApi.Application.Services.Vessels.IVesselService, TodoApi.Application.Services.Vessels.VesselService>();
builder.Services.AddScoped<TodoApi.Application.Services.VesselVisitNotifications.IVesselVisitNotificationService, TodoApi.Application.Services.VesselVisitNotifications.VesselVisitNotificationService>();

// Qualifications
builder.Services.AddScoped<TodoApi.Domain.Repositories.IQualificationRepository, TodoApi.Infrastructure.Repositories.EfQualificationRepository>();
builder.Services.AddScoped<TodoApi.Application.Services.Qualifications.IQualificationService, TodoApi.Application.Services.Qualifications.QualificationService>();

// Resources
builder.Services.AddScoped<TodoApi.Domain.Repositories.IResourceRepository, TodoApi.Infrastructure.Repositories.EfResourceRepository>();
builder.Services.AddScoped<TodoApi.Application.Services.Resources.IResourceService, TodoApi.Application.Services.Resources.ResourceService>();


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
