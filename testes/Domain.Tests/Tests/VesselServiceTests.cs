using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using TodoApi.Application.Services.Vessels;
using TodoApi.Models;
using TodoApi.Models.Vessels;
using TodoApi.Models.Vessels.ValueObjects;
using Xunit;

namespace Domain.Tests.Services
{
    public class VesselServiceTests
    {
        private static PortContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<PortContext>()
                .UseInMemoryDatabase($"VesselServiceTests_{Guid.NewGuid()}")
                .Options;

            var context = new PortContext(options);
            context.Database.EnsureCreated();
            context.Vessels.RemoveRange(context.Vessels);
            context.VesselTypes.RemoveRange(context.VesselTypes);
            context.SaveChanges();
            return context;
        }

        private static VesselType SeedVesselType(PortContext context, long id)
        {
            var constraints = OperationalConstraints.Create(1, 2, 3);
            var vesselType = VesselType.Create($"Type-{id}", "Desc", 100, constraints);
            typeof(VesselType).GetProperty(nameof(VesselType.Id))!.SetValue(vesselType, id);

            context.VesselTypes.Add(vesselType);
            context.SaveChanges();
            return vesselType;
        }

        [Fact]
        public async Task CreateVesselAsync_NormalizesImo_AndPersists()
        {
            await using var context = CreateContext();
            SeedVesselType(context, 1);
            var service = new VesselService(context);

            var dto = new CreateVesselDTO
            {
                Imo = "IMO 1234567",
                Name = "Evergreen",
                VesselTypeId = 1,
                Operator = "EVA"
            };

            var result = await service.CreateVesselAsync(dto);

            Assert.Equal("1234567", result.Imo);
            Assert.Single(context.Vessels);
            Assert.Equal("1234567", context.Vessels.Single().Imo);
        }

        [Fact]
        public async Task CreateVesselAsync_WithExistingImo_Throws()
        {
            await using var context = CreateContext();
            SeedVesselType(context, 1);
            context.Vessels.Add(new Vessel
            {
                Imo = "1234567",
                Name = "Existing",
                VesselTypeId = 1,
                Operator = "Op"
            });
            context.SaveChanges();

            var service = new VesselService(context);
            var dto = new CreateVesselDTO
            {
                Imo = "IMO 1234567",
                Name = "Duplicate",
                VesselTypeId = 1,
                Operator = "Op"
            };

            var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.CreateVesselAsync(dto));
            Assert.Contains("already exists", ex.Message);
        }

        [Fact]
        public async Task UpdateVesselAsync_WhenMissing_Throws()
        {
            await using var context = CreateContext();
            SeedVesselType(context, 1);
            var service = new VesselService(context);

            var dto = new UpdateVesselDTO
            {
                Name = "Updated",
                Operator = "Op",
                VesselTypeId = 1
            };

            await Assert.ThrowsAsync<KeyNotFoundException>(() => service.UpdateVesselAsync("IMO 1234567", dto));
        }

        [Fact]
        public async Task UpdateVesselAsync_WithUnknownVesselType_Throws()
        {
            await using var context = CreateContext();
            SeedVesselType(context, 1);
            context.Vessels.Add(new Vessel
            {
                Imo = "1234567",
                Name = "Existing",
                VesselTypeId = 1,
                Operator = "Op"
            });
            context.SaveChanges();

            var service = new VesselService(context);
            var dto = new UpdateVesselDTO
            {
                Name = "Updated",
                Operator = "New",
                VesselTypeId = 99
            };

            await Assert.ThrowsAsync<ArgumentException>(() => service.UpdateVesselAsync("1234567", dto));
        }

        [Fact]
        public async Task GetVesselsAsync_AppliesFilters()
        {
            await using var context = CreateContext();
            SeedVesselType(context, 1);
            SeedVesselType(context, 2);

            context.Vessels.AddRange(
                new Vessel { Imo = "1234567", Name = "Alpha Star", VesselTypeId = 1, Operator = "Global" },
                new Vessel { Imo = "7654321", Name = "Beta Runner", VesselTypeId = 2, Operator = "PortCo" }
            );
            context.SaveChanges();

            var service = new VesselService(context);

            var filtered = await service.GetVesselsAsync(name: "alpha", @operator: "global");

            var vessel = Assert.Single(filtered);
            Assert.Equal("1234567", vessel.Imo);
        }
    }
}
