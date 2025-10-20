namespace TodoApi.Models.Vessels
{
    public class CreateVesselTypeDTO
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public OperationalConstraintsDTO OperationalConstraints { get; set; } = new OperationalConstraintsDTO();
    }
}
