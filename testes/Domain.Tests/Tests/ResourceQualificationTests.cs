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

        [Fact]
        public void ResourceQualification_IdAndCode_ReadWrite()
        {
            var rq = new ResourceQualification { Id = 42, QualificationCode = "OP-CRANE" };
            Assert.Equal(42, rq.Id);
            Assert.Equal("OP-CRANE", rq.QualificationCode);
            // mutate
            rq.Id = 43;
            rq.QualificationCode = "OP-FORK";
            Assert.Equal(43, rq.Id);
            Assert.Equal("OP-FORK", rq.QualificationCode);
        }
    }
}
