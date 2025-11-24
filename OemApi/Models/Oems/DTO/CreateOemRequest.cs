using System.ComponentModel.DataAnnotations;

namespace OemApi.Models.Oems.DTO
{
    public class CreateOemRequest
    {
        [Required]
        [MaxLength(32)]
        public string Code { get; set; } = string.Empty;

        [Required]
        [MaxLength(128)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(64)]
        public string Country { get; set; } = string.Empty;

        [Required]
        [MaxLength(64)]
        public string Segment { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(256)]
        public string ContactEmail { get; set; } = string.Empty;

        [Required]
        [MaxLength(32)]
        public string ContactPhone { get; set; } = string.Empty;

        public bool Active { get; set; } = true;

        [MaxLength(512)]
        public string? Notes { get; set; }
    }
}
