using System;
using System.ComponentModel.DataAnnotations;

namespace TodoApi.Models.PrivacyPolicy
{
    public class PrivacyPolicy
    {
        public int Id { get; set; }

        public int Version { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = null!;

        [Required]
        public string Content { get; set; } = null!;

        public DateTime PublishedAtUtc { get; set; }

        public bool IsCurrent { get; set; }

        [MaxLength(200)]
        public string? PublishedBy { get; set; }
    }
}
