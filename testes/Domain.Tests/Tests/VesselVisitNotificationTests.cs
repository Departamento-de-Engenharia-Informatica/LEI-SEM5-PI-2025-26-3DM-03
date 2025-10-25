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

        [Fact]
        public void CargoAndCrewCollections_BehaveAsLists()
        {
            var v = new VesselVisitNotification { VesselId = "X", AgentId = 2, ArrivalDate = DateTime.UtcNow };

            // add items
            v.CargoManifest.Add(new ContainerItem { ContainerCode = "ABCU1234567" });
            v.CargoManifest.Add(new ContainerItem { ContainerCode = "MSCU7654321" });
            v.CrewMembers.Add(new CrewMember { Name = "John" });

            Assert.Equal(2, v.CargoManifest.Count);
            Assert.Single(v.CrewMembers);

            // remove and verify
            v.CargoManifest.RemoveAt(0);
            Assert.Single(v.CargoManifest);

            // modifying one collection doesn't affect the other
            v.CrewMembers[0].Name = "John Updated";
            Assert.Equal("John Updated", v.CrewMembers[0].Name);
        }

        [Fact]
        public void SubmissionTimestamp_DefaultsToNull_UponSubmitSetNotNull()
        {
            var v = new VesselVisitNotification { VesselId = "Y", AgentId = 3, ArrivalDate = DateTime.UtcNow };
            Assert.Null(v.SubmissionTimestamp);

            v.Status = "Submitted";
            v.SubmissionTimestamp = DateTime.UtcNow;
            Assert.NotNull(v.SubmissionTimestamp);
        }
    }
}
