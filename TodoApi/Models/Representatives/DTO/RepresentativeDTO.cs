namespace TodoApi.Models.Representatives
{
    public class RepresentativeDTO
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string CitizenID { get; set; } = string.Empty;
        public string Nationality { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public bool IsActive { get; set; }
    }
}