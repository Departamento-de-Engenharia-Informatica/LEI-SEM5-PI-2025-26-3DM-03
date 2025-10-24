namespace TodoApi.Models.VesselVisitNotifications
{
    public class CrewMember
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string CitizenId { get; set; } = string.Empty;
        public string Nationality { get; set; } = string.Empty;
        public long VesselVisitNotificationId { get; set; }
    }
}
