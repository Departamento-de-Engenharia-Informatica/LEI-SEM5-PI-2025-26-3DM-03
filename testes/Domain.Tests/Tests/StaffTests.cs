using System;
using Xunit;
using TodoApi.Models.Staff;

namespace Domain.Tests
{
    public class StaffTests
    {
        [Fact]
        public void StaffMember_DefaultsAndQualifications()
        {
            var s = new StaffMember();
            s.MecanographicNumber = "M1";
            s.ShortName = "Short";
            s.Email = "a@b";
            s.OperationalWindow = new OperationalWindow { StartTime = TimeSpan.FromHours(8), EndTime = TimeSpan.FromHours(17) };
            Assert.Equal("M1", s.MecanographicNumber);
            Assert.Equal("Available", s.Status);
            Assert.True(s.Active);
            s.Qualifications.Add(new StaffQualification { QualificationCode = "Q1" });
            Assert.Single(s.Qualifications);
        }

        [Fact]
        public void OperationalWindow_StartBeforeEnd()
        {
            var s = new StaffMember();
            s.OperationalWindow = new OperationalWindow { StartTime = TimeSpan.FromHours(6), EndTime = TimeSpan.FromHours(18) };
            Assert.True(s.OperationalWindow.StartTime < s.OperationalWindow.EndTime);
        }

        [Fact]
        public void StaffMember_CanAddAndRemoveQualifications()
        {
            var s = new StaffMember();
            var q1 = new StaffQualification { QualificationCode = "Q1" };
            var q2 = new StaffQualification { QualificationCode = "Q2" };

            s.Qualifications.Add(q1);
            s.Qualifications.Add(q2);

            Assert.Equal(2, s.Qualifications.Count);

            // remove one
            s.Qualifications.Remove(q1);
            Assert.Single(s.Qualifications);
            Assert.Equal("Q2", s.Qualifications[0].QualificationCode);
        }

        [Fact]
        public void StaffMember_UpdateContactData_Succeeds()
        {
            var s = new StaffMember();
            s.Email = "old@company.com";
            s.PhoneNumber = "+351900000000";

            s.Email = "new@company.com";
            s.PhoneNumber = "+351911111111";

            Assert.Equal("new@company.com", s.Email);
            Assert.Equal("+351911111111", s.PhoneNumber);
        }

        [Fact]
        public void StaffMember_Deactivate_SetsActiveFalse()
        {
            var s = new StaffMember();
            Assert.True(s.Active);
            s.Active = false;
            Assert.False(s.Active);
        }
    }
}
