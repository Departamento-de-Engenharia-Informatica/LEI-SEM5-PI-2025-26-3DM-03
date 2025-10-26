using FrameworkDDD.Common;
using TodoApi.Models.Vessels;

namespace TodoApi.Models.Docks
{
    public class Dock : IAggregateRoot
    {
        public long Id { get; set; }

        // Human friendly identifier (name or number)
        public string Name { get; set; } = string.Empty;

        // Logical/location description inside the port (e.g., "North Pier 3")
        public string Location { get; set; } = string.Empty;

        // Physical characteristics
        public double Length { get; set; }
        public double Depth { get; set; }
        public double MaxDraft { get; set; }

        // Allowed vessel types that can berth at this dock (many-to-many)
        public ICollection<VesselType> AllowedVesselTypes { get; set; } = new List<VesselType>();
    }
}
