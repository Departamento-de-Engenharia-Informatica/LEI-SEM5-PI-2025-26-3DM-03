namespace TodoApi.Models.ShippingAgentOrganization
{
    public class Representative
    {
        public string Name { get; set; } = string.Empty;
        public string CitizenID { get; set; } = string.Empty;
        public string Nationality { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;

        public Representative() { }
    }
}