using TodoApi.Models.Representatives;

namespace TodoApi.Models.ShippingOrganizations

{
    public class CreateShippingAgentDTO
    {
        public long TaxNumber { get; set; }
        public string LegalName { get; set; } = string.Empty;
        public string AlternativeName { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public Address Address { get; set; } = new();
        public List<Representative> Representatives { get; set; } = new();
    }
}