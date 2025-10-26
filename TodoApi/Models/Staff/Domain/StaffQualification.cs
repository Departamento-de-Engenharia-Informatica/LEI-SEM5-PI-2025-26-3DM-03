using FrameworkDDD.Common;

namespace TodoApi.Models.Staff
{
    public class StaffQualification : IAggregateRoot
    {
        public int Id { get; set; }
        public string QualificationCode { get; set; } = string.Empty;
    }
}
