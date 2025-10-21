using System;

namespace TodoApi.Models.VesselVisitNotifications
{
    public class VesselVisitNotificationDTO
    {
        public long Id { get; set; }
        public string VesselId { get; set; } = string.Empty;
        public long AgentId { get; set; }
        public DateTime ArrivalDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public long? ApprovedDockId { get; set; }
        public string? RejectionReason { get; set; }
        public DateTime? DecisionTimestamp { get; set; }
        public long? OfficerId { get; set; }
    }
}
