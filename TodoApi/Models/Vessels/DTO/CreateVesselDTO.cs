namespace TodoApi.Models.Vessels
{
    public class CreateVesselDTO
    {
        public string Imo { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public long VesselTypeId { get; set; }
        public string Operator { get; set; } = string.Empty;
    }
}
