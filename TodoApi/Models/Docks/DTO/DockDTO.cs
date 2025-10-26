using TodoApi.Models.Vessels;

namespace TodoApi.Models.Docks
{
    public class DockDTO
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public double Length { get; set; }
        public double Depth { get; set; }
        public double MaxDraft { get; set; }

        // Return allowed vessel types as simple DTOs
        public IEnumerable<VesselTypeDTO> AllowedVesselTypes { get; set; } = Enumerable.Empty<VesselTypeDTO>();
    }
}
