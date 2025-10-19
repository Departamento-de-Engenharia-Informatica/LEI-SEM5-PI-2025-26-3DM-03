namespace TodoApi.Models.Vessels
{
    public class VesselDTO
    {
        // Identifier
        public string Imo { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public long VesselTypeId { get; set; }
        public VesselTypeDTO? VesselType { get; set; }
        public string Operator { get; set; } = string.Empty;
    }
}
