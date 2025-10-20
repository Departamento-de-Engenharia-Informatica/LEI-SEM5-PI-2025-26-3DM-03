namespace TodoApi.Models.Resources
{
    // Small owned entity representing a required qualification for a Resource
    public class ResourceQualification
    {
        public int Id { get; set; }
        public string QualificationCode { get; set; } = string.Empty;
    }
}
