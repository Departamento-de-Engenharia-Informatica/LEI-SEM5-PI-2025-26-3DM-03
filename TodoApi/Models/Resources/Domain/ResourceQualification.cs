using FrameworkDDD.Common;
using System.Collections.Generic;

namespace TodoApi.Models.Resources
{
    // Small value object representing a required qualification for a Resource
    public class ResourceQualification : ValueObject
    {
        public int Id { get; set; }
        public string QualificationCode { get; set; } = string.Empty;

        protected override IEnumerable<object?> GetEqualityComponents()
        {
            yield return QualificationCode;
        }
    }
}
