using System;
using System.Collections.Generic;

namespace TodoApi.Models.VesselVisitNotifications
{
    public class UpdateVesselVisitNotificationDTO
    {
        public DateTime? ArrivalDate { get; set; }
        public DateTime? DepartureDate { get; set; }
        public List<ContainerItemDTO>? CargoManifest { get; set; }
        public List<CrewMemberDTO>? CrewMembers { get; set; }
    }
}
