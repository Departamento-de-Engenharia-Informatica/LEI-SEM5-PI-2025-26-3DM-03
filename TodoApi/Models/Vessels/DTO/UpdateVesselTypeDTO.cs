namespace TodoApi.Models.Vessels
{
    public class UpdateVesselTypeDTO
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int Capacity { get; set; }
        // Support both nested OperationalConstraints object and flattened fields
        public OperationalConstraintsDTO OperationalConstraints { get; set; } = new OperationalConstraintsDTO();
        // Flattened (optional) fields accepted by some clients
        public int? MaxRows { get; set; }
        public int? MaxBays { get; set; }
        public int? MaxTiers { get; set; }
    }
}
