namespace TodoApi.Models.ShippingOrganizations
{
    public class ShippingAgent
    {
        public long TaxNumber { get; set; }
        public string Name { get; set; } = string.Empty;
        public ShippingAgentType Type { get; set; } = ShippingAgentType.Owner;
        public Address Address { get; set; } = new();
        public List<Representative> Representatives { get; set; } = new();

        public ShippingAgent() { }

        public ShippingAgent(long taxNumber, string name, string type, Address address, List<Representative> representatives)
        {
            TaxNumber = taxNumber;
            Name = name;
            Type = type;
            Address = address;
            Representatives = representatives;
        }
    }
}