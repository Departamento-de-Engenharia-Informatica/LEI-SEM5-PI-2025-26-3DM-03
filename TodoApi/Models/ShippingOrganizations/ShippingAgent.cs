using System.Collections.Generic;

namespace TodoApi.Models.ShippingOrganizations
{
    public class ShippingAgent
    {
        public long TaxNumber { get; set; }           // PK
        public string LegalName { get; set; } = string.Empty;       // NEW
        public string AlternativeName { get; set; } = string.Empty;
        public ShippingAgentType Type { get; set; } = ShippingAgentType.Owner;

        public Address Address { get; set; } = new();
        public List<Representative> Representatives { get; set; } = new();

        public ShippingAgent() { }

        public ShippingAgent(
            long taxNumber,
            string legalName,
            string alternativeName,
            ShippingAgentType type,
            Address address,
            List<Representative> representatives)
        {
            TaxNumber = taxNumber;
            LegalName = legalName;
            AlternativeName = alternativeName;
            Type = type;
            Address = address;
            Representatives = representatives;
        }
    }
}
