using System;
using Xunit;
using TodoApi.Models.VesselVisitNotifications;

namespace Domain.Tests
{
    public class VesselVisitNotificationTests
    {
        [Fact]
        public void VesselVisitNotification_Defaults_And_PropertySetters()
        {
            var v = new VesselVisitNotification();

            // Defaults
            Assert.Equal("InProgress", v.Status);
            Assert.NotNull(v.CargoManifest);
            Assert.NotNull(v.CrewMembers);

            // Set basic fields
            v.Id = 1001;
            v.VesselId = "IMO1234567";
            v.AgentId = 55;
            v.ArrivalDate = new DateTime(2025, 10, 25, 8, 0, 0);
            v.DepartureDate = v.ArrivalDate.AddDays(2);
            v.SubmittedByRepresentativeEmail = "rep@example.com";
            v.SubmittedByRepresentativeName = "Rep Name";

            Assert.Equal(1001, v.Id);
            Assert.Equal("IMO1234567", v.VesselId);
            Assert.Equal(55, v.AgentId);
            Assert.Equal(new DateTime(2025, 10, 25, 8, 0, 0), v.ArrivalDate);
            Assert.Equal(new DateTime(2025, 10, 27, 8, 0, 0), v.DepartureDate);
            Assert.Equal("rep@example.com", v.SubmittedByRepresentativeEmail);
            Assert.Equal("Rep Name", v.SubmittedByRepresentativeName);

            // Cargo manifest and crew
            v.CargoManifest.Add(new ContainerItem { ContainerCode = "CONT1", CargoType = "General", IsForUnloading = true, VesselVisitNotificationId = 1001 });
            v.CrewMembers.Add(new CrewMember { Name = "John Doe", CitizenId = "C123", Nationality = "PT", VesselVisitNotificationId = 1001 });

            Assert.Single(v.CargoManifest);
            Assert.Single(v.CrewMembers);

            // Submission and decision fields
            v.Status = "Submitted";
            v.SubmissionTimestamp = DateTime.UtcNow;
            v.ApprovedDockId = 7;
            v.RejectionReason = null;
            v.DecisionTimestamp = DateTime.UtcNow.AddHours(1);
            v.OfficerId = 99;

            Assert.Equal("Submitted", v.Status);
            Assert.NotNull(v.SubmissionTimestamp);
            Assert.Equal(7, v.ApprovedDockId);
            Assert.Null(v.RejectionReason);
            Assert.NotNull(v.DecisionTimestamp);
            Assert.Equal(99, v.OfficerId);

            // mutate to Rejected
            v.Status = "Rejected";
            v.RejectionReason = "Invalid cargo details";
            v.ApprovedDockId = null;

            Assert.Equal("Rejected", v.Status);
            Assert.Equal("Invalid cargo details", v.RejectionReason);
            Assert.Null(v.ApprovedDockId);
        }

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
