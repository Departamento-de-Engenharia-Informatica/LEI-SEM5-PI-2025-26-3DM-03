using Xunit;
using TodoApi.Models.Qualifications;

namespace Domain.Tests
{
    public class QualificationTests
    {
        [Fact]
        public void Qualification_Constructors_Work()
        {
            var q1 = new Qualification();
            q1.Code = "Q";
            q1.Description = "D";
            Assert.Equal("Q", q1.Code);

            var q2 = new Qualification("Q2", "Desc");
            Assert.Equal("Q2", q2.Code);
            Assert.Equal("Desc", q2.Description);
        }
    }
}
