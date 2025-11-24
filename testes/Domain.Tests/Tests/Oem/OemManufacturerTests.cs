using OemApi.Models.Oems.Domain;
using Xunit;

namespace Domain.Tests.Tests.Oem
{
    public class OemManufacturerTests
    {
        [Fact]
        public void Create_WithValidData_ShouldSetProperties()
        {
            var contact = OemContact.Create("oem@example.com", "+351912345678");

            var aggregate = OemManufacturer.Create("OEM-1", "Alpha OEM", "Portugal", "Electrical", true, contact, "Tier-1 supplier");

            Assert.Equal("OEM-1", aggregate.Code);
            Assert.Equal("Alpha OEM", aggregate.Name);
            Assert.Equal("Portugal", aggregate.Country);
            Assert.Equal("Electrical", aggregate.Segment);
            Assert.True(aggregate.Active);
            Assert.Equal("oem@example.com", aggregate.Contact.Email);
            Assert.Equal("Tier-1 supplier", aggregate.Notes);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void Create_InvalidCode_ShouldThrow(string? code)
        {
            var contact = OemContact.Create("oem@example.com", "+351912345678");

            Assert.Throws<ArgumentException>(() =>
                OemManufacturer.Create(code ?? string.Empty, "Alpha OEM", "Portugal", "Electrical", true, contact));
        }

        [Fact]
        public void Update_ShouldRefreshState()
        {
            var contact = OemContact.Create("oem@example.com", "+351912345678");
            var aggregate = OemManufacturer.Create("OEM-1", "Alpha OEM", "Portugal", "Electrical", true, contact);

            var newContact = OemContact.Create("ops@example.com", "+351987654321");
            aggregate.Update("OEM-1", "Alpha OEM 2", "Spain", "Mechanical", false, newContact, "Updated");

            Assert.Equal("Alpha OEM 2", aggregate.Name);
            Assert.Equal("Spain", aggregate.Country);
            Assert.False(aggregate.Active);
            Assert.Equal("ops@example.com", aggregate.Contact.Email);
            Assert.Equal("Updated", aggregate.Notes);
        }
    }
}
