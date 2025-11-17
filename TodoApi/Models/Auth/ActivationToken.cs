using System;
using System.ComponentModel.DataAnnotations;

namespace TodoApi.Models.Auth
{
    public class ActivationToken
    {
        public int Id { get; set; }

        [Required]
        public int AppUserId { get; set; }
        public AppUser AppUser { get; set; } = null!;

        [Required]
        [MaxLength(200)]
        public string TokenHash { get; set; } = null!;

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAtUtc { get; set; }
        public DateTime? RedeemedAtUtc { get; set; }
        public string? RedeemedByIp { get; set; }
    }
}
