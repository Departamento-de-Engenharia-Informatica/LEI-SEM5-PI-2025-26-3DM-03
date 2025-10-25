using Xunit;
using TodoApi.Models.VesselVisitNotifications;

namespace Domain.Tests
{
    public class ContainerAndCrewTests
    {
        [Fact]
        public void ContainerItem_RoundtripProperties()
        {
            var c = new ContainerItem { ContainerCode = "ABCU1234567", CargoType = "Goods", IsForUnloading = true, VesselVisitNotificationId = 5 };
            Assert.Equal("ABCU1234567", c.ContainerCode);
            Assert.True(c.IsForUnloading);
            Assert.Equal(5, c.VesselVisitNotificationId);
        }

        [Fact]
        public void CrewMember_RoundtripProperties()
        {
            var cm = new CrewMember { Name = "Alice", CitizenId = "C100", Nationality = "PT", VesselVisitNotificationId = 7 };
            Assert.Equal("Alice", cm.Name);
            Assert.Equal("C100", cm.CitizenId);
            Assert.Equal("PT", cm.Nationality);
            Assert.Equal(7, cm.VesselVisitNotificationId);
        }

        [Fact]
        public void ContainerCode_NotEmptyAndHasExpectedFormatLength()
        {
            var c = new ContainerItem { ContainerCode = "ABCU1234567" };
            Assert.False(string.IsNullOrWhiteSpace(c.ContainerCode));
            // basic length check (4 letters + 7 digits expected for ISO6346 style used in this project)
            Assert.True(c.ContainerCode.Length >= 7);
        }
    }
}
