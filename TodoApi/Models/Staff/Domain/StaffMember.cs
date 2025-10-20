using System;
using System.Collections.Generic;

namespace TodoApi.Models.Staff
{
    public class StaffMember
    {
        // mecanographic number (unique id)
        public string MecanographicNumber { get; set; } = string.Empty;

        public string ShortName { get; set; } = string.Empty;

        public string Email { get; set; } = string.Empty;

        public string PhoneNumber { get; set; } = string.Empty;

        // Operational window
        public OperationalWindow? OperationalWindow { get; set; }

        // Current availability status (e.g., Available, Unavailable)
        public string Status { get; set; } = "Available";

        // Active indicates not deactivated (soft-delete)
        public bool Active { get; set; } = true;

        // Qualifications codes owned by staff
        public List<StaffQualification> Qualifications { get; private set; }

        public StaffMember()
        {
            Qualifications = new List<StaffQualification>();
        }
    }
}
