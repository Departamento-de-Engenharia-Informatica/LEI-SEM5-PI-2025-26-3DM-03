using System.ComponentModel.DataAnnotations;

namespace TodoApi.Models.Resources
{
    public class CreateResourceDTO
    {
        [Required]
        [RegularExpression("^[a-zA-Z0-9]+$", ErrorMessage = "Code must be alphanumeric")]
        public string? Code { get; set; }

        [Required]
        public string? Description { get; set; }

        [Required]
        public string? Type { get; set; }

        [Required]
        [Range(0.1, double.MaxValue, ErrorMessage = "Operational capacity must be positive")]
        public decimal OperationalCapacity { get; set; }

        public string? AssignedArea { get; set; }

        [Range(0, int.MaxValue, ErrorMessage = "Setup time cannot be negative")]
        public int? SetupTimeMinutes { get; set; }
    }
}