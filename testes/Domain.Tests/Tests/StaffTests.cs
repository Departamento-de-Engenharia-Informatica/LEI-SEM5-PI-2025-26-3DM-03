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
    }
}
