namespace TodoApi.Models.ShippingAgentOrganization
{
    public class ShippingAgentOrganizationDTO
    {
        public long TaxNumber { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public Address Address { get; set; } = new();
        public List<Representative> Representatives { get; set; } = new();
    }
}