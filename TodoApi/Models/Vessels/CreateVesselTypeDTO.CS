namespace TodoApi.Models.Vessels
{
    public class CreateVesselTypeDTO
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public int MaxRows { get; set; }
        public int MaxBays { get; set; }
        public int MaxTiers { get; set; }
    }
}
