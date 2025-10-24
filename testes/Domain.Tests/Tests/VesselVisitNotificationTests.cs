using System;
using Xunit;
using TodoApi.Models.VesselVisitNotifications;

namespace Domain.Tests
{
    public class VesselVisitNotificationTests
    {
        [Fact]
        public void CanSetPropertiesAndDefaultStatusIsInProgress()
        {
            var v = new VesselVisitNotification();
            v.VesselId = "1234567";
            v.AgentId = 1;
            v.ArrivalDate = DateTime.UtcNow;
            v.DepartureDate = DateTime.UtcNow.AddDays(1);

            Assert.Equal("1234567", v.VesselId);
            Assert.Equal(1, v.AgentId);
            Assert.NotNull(v.CargoManifest);
            Assert.NotNull(v.CrewMembers);
            Assert.Equal("InProgress", v.Status);
        }
    }
}
