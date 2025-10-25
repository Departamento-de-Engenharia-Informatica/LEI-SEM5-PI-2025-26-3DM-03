using Xunit;
using TodoApi.Models.Docks;
using TodoApi.Models.Vessels;
using TodoApi.Models.Vessels.ValueObjects;

namespace Domain.Tests
{
    public class DockDomainTests
    {
        [Fact]
        public void Dock_Defaults_AreInitialized()
        {
            var dock = new Dock();

            Assert.Equal(0L, dock.Id);
            Assert.Equal(string.Empty, dock.Name);
            Assert.Equal(string.Empty, dock.Location);
            Assert.NotNull(dock.AllowedVesselTypes);
            Assert.Empty(dock.AllowedVesselTypes);
            Assert.Equal(0d, dock.Length);
            Assert.Equal(0d, dock.Depth);
            Assert.Equal(0d, dock.MaxDraft);
        }

        [Fact]
        public void Dock_PropertyAssignment_WorksAndAllowsVesselTypes()
        {
            var dock = new Dock
            {
                Id = 5,
                Name = "North Pier 1",
                Location = "North Side",
                Length = 300.0,
                Depth = 15.0,
                MaxDraft = 12.0
            };

            var constraints = OperationalConstraints.Create(1, 1, 1);
            var vt = VesselType.Create("Container", "Large container ship", 50000, constraints);

            dock.AllowedVesselTypes.Add(vt);

            Assert.Equal(5L, dock.Id);
            Assert.Equal("North Pier 1", dock.Name);
            Assert.Equal("North Side", dock.Location);
            Assert.Single(dock.AllowedVesselTypes);
            Assert.Contains(vt, dock.AllowedVesselTypes);
        }
    }
}
