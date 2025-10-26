namespace TodoApi.Models.Docks
{
    public class UpdateDockDTO
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public double Length { get; set; }
        public double Depth { get; set; }
        public double MaxDraft { get; set; }

        // IDs of vessel types allowed
        public IEnumerable<long> AllowedVesselTypeIds { get; set; } = Enumerable.Empty<long>();
    }
}
