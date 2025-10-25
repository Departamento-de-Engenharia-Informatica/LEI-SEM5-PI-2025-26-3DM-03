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

        [Fact]
        public void Resource_AllProperties_ReadWrite()
        {
            var r = new Resource();

            // Set scalar properties
            r.Code = "R-001";
            r.Description = "Forklift";
            r.Type = "Vehicle";
            r.OperationalCapacity = 12.5m;
            r.AssignedArea = "A1";
            r.SetupTimeMinutes = 15;
            r.Status = "Inactive";

            // Validate
            Assert.Equal("R-001", r.Code);
            Assert.Equal("Forklift", r.Description);
            Assert.Equal("Vehicle", r.Type);
            Assert.Equal(12.5m, r.OperationalCapacity);
            Assert.Equal("A1", r.AssignedArea);
            Assert.Equal(15, r.SetupTimeMinutes);
            Assert.Equal("Inactive", r.Status);

            // Ensure qualifications list is usable
            r.RequiredQualifications.Add(new ResourceQualification { QualificationCode = "OP-FORK" });
            Assert.Contains(r.RequiredQualifications, q => q.QualificationCode == "OP-FORK");
        }
    }
}
