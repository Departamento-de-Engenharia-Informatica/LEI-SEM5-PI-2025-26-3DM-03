using Xunit;
using TodoApi.Models.Resources;

namespace Domain.Tests
{
    public class ResourceQualificationTests
    {
        [Fact]
        public void ResourceQualification_Roundtrip()
        {
            var rq = new ResourceQualification { QualificationCode = "QX" };
            Assert.Equal("QX", rq.QualificationCode);
        }
    }
}
