using System;
using System.Collections.Generic;

namespace TodoApi.Models.VesselVisitNotifications
{
    public class VesselVisitNotification
    {
        public long Id { get; set; }
        public string VesselId { get; set; } = string.Empty; // could be IMO or external id
        public long AgentId { get; set; }
        public DateTime ArrivalDate { get; set; }
        public DateTime? DepartureDate { get; set; }

        // Navigation collections
        public List<ContainerItem> CargoManifest { get; set; } = new List<ContainerItem>();
        public List<CrewMember> CrewMembers { get; set; } = new List<CrewMember>();

        // Status lifecycle: InProgress, Submitted, PendingApproval, Approved, Rejected
        public string Status { get; set; } = "InProgress";
        public DateTime? SubmissionTimestamp { get; set; }

        // Approval fields
        public long? ApprovedDockId { get; set; }
        public string? RejectionReason { get; set; }
        public DateTime? DecisionTimestamp { get; set; }
        public long? OfficerId { get; set; }
    }
}
