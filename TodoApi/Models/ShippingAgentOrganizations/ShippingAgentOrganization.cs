namespace TodoApi.Models.ShippingAgentOrganization
{
    public class ShippingAgentOrganization
    {
        public long TaxNumber { get; set; }
        public string Name { get; set; } = string.Empty;
        public ShippingAgentType Type { get; set; } = ShippingAgentType.Owner;
        public Address Address { get; set; } = new();
        public List<Representative> Representatives { get; set; } = new();

        public ShippingAgentOrganization() { }
    }
}
