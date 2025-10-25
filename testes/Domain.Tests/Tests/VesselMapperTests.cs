using TodoApi.Models.Vessels;
using Xunit;

namespace Domain.Tests.Tests
{
    public class VesselMapperTests
    {
        [Theory]
        // 1234567 -> valid because (1*7+2*6+3*5+4*4+5*3+6*2)=77 -> 77%10=7 == last digit 7
        [InlineData("1234567", true)]
        [InlineData("IMO1234567", true)]
        [InlineData("IMO 1234567", true)]
        // invalid check digit
        [InlineData("1234560", false)]
        // non-digit
        [InlineData("abcdefg", false)]
        public void IsValidImo_Works(string imo, bool expected)
        {
            var actual = VesselMapper.IsValidImo(imo);
            Assert.Equal(expected, actual);
        }
    }
}
