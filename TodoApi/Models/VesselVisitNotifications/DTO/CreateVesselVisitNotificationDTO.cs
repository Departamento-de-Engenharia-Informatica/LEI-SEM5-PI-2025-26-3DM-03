using System;
using System.Collections.Generic;

namespace TodoApi.Models.VesselVisitNotifications
{
    public class CrewMemberDTO
    {
        public string Name { get; set; } = string.Empty;
        public string CitizenId { get; set; } = string.Empty;
        public string Nationality { get; set; } = string.Empty;
    }

    public class ContainerItemDTO
    {
        public string ContainerCode { get; set; } = string.Empty;
        public string? CargoType { get; set; }
        public bool IsForUnloading { get; set; }
    }

    public class CreateVesselVisitNotificationDTO
    {
        public string VesselId { get; set; } = string.Empty;
        public long AgentId { get; set; }
        public DateTime ArrivalDate { get; set; }
        public DateTime? DepartureDate { get; set; }
        public List<ContainerItemDTO>? CargoManifest { get; set; }
        public List<CrewMemberDTO>? CrewMembers { get; set; }
        // Optional: representative info. In production this should normally be derived from the authenticated user (JWT claims).
        public string? SubmittedByRepresentativeEmail { get; set; }
        public string? SubmittedByRepresentativeName { get; set; }
    }
}
