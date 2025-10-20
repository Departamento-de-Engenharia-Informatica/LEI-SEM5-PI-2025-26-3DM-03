using System;
using System.Collections.Generic;

namespace TodoApi.Models.Staff
{
    public class CreateStaffDTO
    {
        public string MecanographicNumber { get; set; } = string.Empty;
        public string ShortName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public TimeSpan? StartTime { get; set; }
        public TimeSpan? EndTime { get; set; }
        public List<string> Qualifications { get; set; } = new List<string>();
    }
}
