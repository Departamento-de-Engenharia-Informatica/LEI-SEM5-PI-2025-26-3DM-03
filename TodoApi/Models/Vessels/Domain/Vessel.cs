using FrameworkDDD.Common;

namespace TodoApi.Models.Vessels
{
    public class Vessel : IAggregateRoot
    {
        
        public string Imo { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;

        public long VesselTypeId { get; set; }
        public VesselType? VesselType { get; set; }

        public string Operator { get; set; } = string.Empty;
    }
}
