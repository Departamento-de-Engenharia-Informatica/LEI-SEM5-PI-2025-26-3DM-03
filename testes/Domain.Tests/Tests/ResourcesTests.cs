using Xunit;
using TodoApi.Models.Resources;

namespace Domain.Tests
{
    public class ResourcesTests
    {
        [Fact]
        public void Resource_DefaultStatusActive_AndQualificationsList()
        {
            var r = new Resource();
            Assert.Equal("Active", r.Status);
            Assert.NotNull(r.RequiredQualifications);
            r.RequiredQualifications.Add(new ResourceQualification { QualificationCode = "Q1" });
            Assert.Single(r.RequiredQualifications);
        }

        [Fact]
        public void RequiredQualifications_CanAddDuplicateCodes()
        {
            var r = new Resource();
            r.RequiredQualifications.Add(new ResourceQualification { QualificationCode = "QX" });
            r.RequiredQualifications.Add(new ResourceQualification { QualificationCode = "QX" });
            Assert.Equal(2, r.RequiredQualifications.Count);
        }
    }
}
