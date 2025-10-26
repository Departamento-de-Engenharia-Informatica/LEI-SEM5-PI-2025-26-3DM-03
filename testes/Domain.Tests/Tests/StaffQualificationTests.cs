using TodoApi.Models.Staff;
using Xunit;

namespace TodoApi.Domain.Tests.Models.Staff
{
    public class StaffQualificationTests
    {
        [Fact]
        public void Default_Qualification_Has_DefaultValues()
        {
            var q = new StaffQualification();
            Assert.Equal(0, q.Id);
            Assert.Equal(string.Empty, q.QualificationCode);
        }

        [Fact]
        public void StaffMember_CanAdd_Qualifications()
        {
            var s = new StaffMember();
            var q1 = new StaffQualification { QualificationCode = "Q1" };
            var q2 = new StaffQualification { QualificationCode = "Q2" };

            s.Qualifications.Add(q1);
            s.Qualifications.Add(q2);

            Assert.Equal(2, s.Qualifications.Count);
            Assert.Contains(s.Qualifications, qq => qq.QualificationCode == "Q1");
            Assert.Contains(s.Qualifications, qq => qq.QualificationCode == "Q2");
        }
    }
}
