using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace TodoApi.Models.Resources
{
    public class UpdateResourceDTO
    {
        [Required]
        public string? Description { get; set; }

        [Required]
        public string? Type { get; set; }

        [Required]
        [Range(0.1, double.MaxValue, ErrorMessage = "Operational capacity must be positive")]
        public decimal OperationalCapacity { get; set; }

        [Required]
        public string? Status { get; set; } = "Active";

        public string? AssignedArea { get; set; }

        [Range(0, int.MaxValue, ErrorMessage = "Setup time cannot be negative")]
        public int? SetupTimeMinutes { get; set; }

        [MinLength(0)]
        public List<string> RequiredQualifications { get; set; } = new();
    }
}
