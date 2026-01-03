using System;
using System.ComponentModel.DataAnnotations;
using TodoApi.Models.Auth;

namespace TodoApi.Models.DataRights
{
    public class DataRightsRequest
    {
        public int Id { get; set; }

        public int AppUserId { get; set; }
        public AppUser AppUser { get; set; } = null!;

        [Required]
        [MaxLength(40)]
        public string RequestType { get; set; } = null!;

        public DateTime RequestedAtUtc { get; set; }

        [Required]
        [MaxLength(40)]
        public string Status { get; set; } = "Submitted";

        public string? PayloadJson { get; set; }

        [MaxLength(200)]
        public string? RequestedByEmail { get; set; }

        public DateTime? RespondedAtUtc { get; set; }

        [MaxLength(400)]
        public string? ResponseNote { get; set; }
    }
}
