namespace TodoApi.Models.ShippingOrganizations
{
    public class Representative
    {
        public string Name { get; set; } = string.Empty;
        public string CitizenID { get; set; } = string.Empty;
        public string Nationality { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;

        public Representative() { }

        public Representative(string name, string citizenID, string nationality, string email, string phoneNumber)
        {
            Name = name;
            CitizenID = citizenID;
            Nationality = nationality;
            Email = email;  
            PhoneNumber = phoneNumber;
        }   
    }
}