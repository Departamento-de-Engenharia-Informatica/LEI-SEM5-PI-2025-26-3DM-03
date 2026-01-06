using System;
using System.ComponentModel.DataAnnotations;

namespace TodoApi.Models.DataRights
{
    public class PublicDataRightsRequest
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(40)]
        public string RequestType { get; set; } = null!;

        public DateTime RequestedAtUtc { get; set; }

        [Required]
        [MaxLength(120)]
        public string RequestedByName { get; set; } = null!;

        [Required]
        [MaxLength(200)]
        public string RequestedByEmail { get; set; } = null!;

        [MaxLength(2000)]
        public string? Details { get; set; }
    }
}
