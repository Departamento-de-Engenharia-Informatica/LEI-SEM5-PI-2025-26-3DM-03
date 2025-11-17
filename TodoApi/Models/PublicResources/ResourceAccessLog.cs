using System;

namespace TodoApi.Models.PublicResources
{
    /// <summary>
    /// Audit log for all interactions with the shared resources endpoints.
    /// </summary>
    public class ResourceAccessLog
    {
        public long Id { get; set; }
        public long? ResourceId { get; set; }
        public string Action { get; set; } = null!;
        public string? UserId { get; set; }
        public string? UserEmail { get; set; }
        public string? IpAddress { get; set; }
        public string? UserAgent { get; set; }
        public DateTime OccurredAt { get; set; }
    }
}
