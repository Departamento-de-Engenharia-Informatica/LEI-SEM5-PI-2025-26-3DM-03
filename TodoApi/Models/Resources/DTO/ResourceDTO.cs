using System.Collections.Generic;

namespace TodoApi.Models.Resources
{
    public class ResourceDTO
    {
        public string Code { get; set; } = default!;
        public string Description { get; set; } = default!;
        public string Type { get; set; } = default!;
        public string Status { get; set; } = default!;
        public decimal OperationalCapacity { get; set; }
        public string? AssignedArea { get; set; }
        public int? SetupTimeMinutes { get; set; }
        public List<string> RequiredQualifications { get; set; } = new();
    }
}