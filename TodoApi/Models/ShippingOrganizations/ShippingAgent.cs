using System.Collections.Generic;

namespace TodoApi.Models.ShippingOrganizations
{
    public class ShippingAgent
    {
        public long TaxNumber { get; set; }           // PK
        public string Name { get; set; } = string.Empty;

        // Agora é o Value Object (Owner / Operator)
        public ShippingAgentType Type { get; set; } = ShippingAgentType.Owner;

        public Address Address { get; set; } = new();
        public List<Representative> Representatives { get; set; } = new();

        public ShippingAgent() { }

        public ShippingAgent(
            long taxNumber,
            string name,
            ShippingAgentType type,
            Address address,
            List<Representative> representatives)
        {
            TaxNumber = taxNumber;
            Name = name;
            Type = type;
            Address = address;
            Representatives = representatives;
        }
    }
}
