using System;

namespace TodoApi.Application.Services.VesselVisitNotifications
{
    public class VesselVisitNotificationFilterDTO
    {
        public string? VesselId { get; set; }
        public string? Status { get; set; }
        // representative email to filter by (notifications submitted by a specific rep)
        public string? RepresentativeEmail { get; set; }
        // Filter by submission timestamp range (UTC)
        public DateTime? SubmittedFrom { get; set; }
        public DateTime? SubmittedTo { get; set; }

        // paging
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }
}
