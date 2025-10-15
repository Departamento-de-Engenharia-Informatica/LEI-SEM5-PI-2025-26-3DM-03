namespace TodoApi.Models.ShippingAgentOrganization
{
    public class CreateShippingAgentOrganizationDTO
    {
        public long TaxNumber { get; set; }
        public string Name { get; set; } = string.Empty;
        public String Type { get; set; } = "Owner";
        public Address Address { get; set; } = new();
        public List<Representative> Representatives { get; set; } = new();
    }
}