using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TodoApi.Models.Auth
{
    public class AppUser
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Email { get; set; } = null!;

        // External identifier from the Identity Provider (OIDC 'sub' claim)
        [MaxLength(200)]
        public string? ExternalId { get; set; }

        [MaxLength(200)]
        public string? Name { get; set; }

        // If false, user is inactive and should be denied
        public bool Active { get; set; } = true;

        public DateTime? LastRoleChangeSentUtc { get; set; }

        [MaxLength(400)]
        public string? LastRoleChangeSummary { get; set; }

        public DateTime? LastRoleChangeConfirmedUtc { get; set; }

        public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
        public ICollection<ActivationToken> ActivationTokens { get; set; } = new List<ActivationToken>();
    }
}
