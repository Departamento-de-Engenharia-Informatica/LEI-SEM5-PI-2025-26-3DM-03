namespace TodoApi.Models.VesselVisitNotifications
{
    public class ContainerItem
    {
        public int Id { get; set; }
        public string ContainerCode { get; set; } = string.Empty; // ISO 6346
        public string? CargoType { get; set; }
        public bool IsForUnloading { get; set; }
        public long VesselVisitNotificationId { get; set; }
    }
}
