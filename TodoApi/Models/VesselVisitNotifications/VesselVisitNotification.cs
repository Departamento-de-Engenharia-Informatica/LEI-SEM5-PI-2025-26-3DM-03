using System;

namespace TodoApi.Models.VesselVisitNotifications
{
    public class VesselVisitNotification
    {
        public long Id { get; set; }
        public string VesselId { get; set; } = string.Empty; // could be IMO or external id
        public long AgentId { get; set; }
        public DateTime ArrivalDate { get; set; }
        public string Status { get; set; } = "Pending"; // Pending / Approved / Rejected
        public long? ApprovedDockId { get; set; }
        public string? RejectionReason { get; set; }
        public DateTime? DecisionTimestamp { get; set; }
        public long? OfficerId { get; set; }
    }
}
