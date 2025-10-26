using FrameworkDDD.Common;
using System.Collections.Generic;

namespace TodoApi.Models.VesselVisitNotifications
{
    public class ContainerItem : ValueObject
    {
        public int Id { get; set; }
        public string ContainerCode { get; set; } = string.Empty; // ISO 6346
        public string? CargoType { get; set; }
        public bool IsForUnloading { get; set; }
        public long VesselVisitNotificationId { get; set; }

        protected override IEnumerable<object?> GetEqualityComponents()
        {
            yield return ContainerCode;
            yield return CargoType;
            yield return IsForUnloading;
        }
    }
}
