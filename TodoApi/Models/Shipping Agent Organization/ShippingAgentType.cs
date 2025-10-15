namespace TodoApi.Models.ShippingAgentOrganization
{
    public class ShippingAgentType
    {
        public string Value { get; set; }
        public ShippingAgentType(string value) => Value = value;
        public ShippingAgentType() { }

        public static ShippingAgentType Owner => new ShippingAgentType("Owner");
        public static ShippingAgentType Operator => new ShippingAgentType("Operator");
    }
}