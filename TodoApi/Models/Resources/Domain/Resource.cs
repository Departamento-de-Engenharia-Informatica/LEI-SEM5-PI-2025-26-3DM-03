using System;
using System.Collections.Generic;
using FrameworkDDD.Common;

namespace TodoApi.Models.Resources
{
    public class Resource : IAggregateRoot
    {
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Status { get; set; } = "Active";
        public decimal OperationalCapacity { get; set; }
        public string? AssignedArea { get; set; }
        public int? SetupTimeMinutes { get; set; }
    public List<ResourceQualification> RequiredQualifications { get; private set; }

        public Resource()
        {
            RequiredQualifications = new List<ResourceQualification>();
        }
    }
}