using System;
using System.Collections.Generic;

namespace TodoApi.Models.Resources
{
    public class Resource
    {
        public string Code { get; set; }
        public string Description { get; set; }
        public string Type { get; set; }
        public string Status { get; set; }
        public decimal OperationalCapacity { get; set; }
        public string? AssignedArea { get; set; }
        public int? SetupTimeMinutes { get; set; }
    public List<ResourceQualification> RequiredQualifications { get; private set; }

        public Resource()
        {
            RequiredQualifications = new List<ResourceQualification>();
            Status = "Active"; // Default status
        }
    }
}