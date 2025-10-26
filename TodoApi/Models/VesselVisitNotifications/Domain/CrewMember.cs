using FrameworkDDD.Common;
using System.Collections.Generic;

namespace TodoApi.Models.VesselVisitNotifications
{
    public class CrewMember : ValueObject
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string CitizenId { get; set; } = string.Empty;
        public string Nationality { get; set; } = string.Empty;
        public long VesselVisitNotificationId { get; set; }

        protected override IEnumerable<object?> GetEqualityComponents()
        {
            yield return Name;
            yield return CitizenId;
            yield return Nationality;
        }
    }
}
