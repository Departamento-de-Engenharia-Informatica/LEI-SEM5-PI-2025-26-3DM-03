using System;
using TodoApi.Models.Staff;
using Xunit;

namespace TodoApi.Domain.Tests.Models.Staff
{
    public class OperationalWindowTests
    {
        [Fact]
        public void StartTime_MustBeBefore_EndTime()
        {
            var ow = new OperationalWindow { StartTime = TimeSpan.FromHours(7), EndTime = TimeSpan.FromHours(15) };
            Assert.True(ow.StartTime < ow.EndTime);
        }

        [Fact]
        public void Can_Set_And_Read_Times()
        {
            var ow = new OperationalWindow();
            ow.StartTime = TimeSpan.FromMinutes(30);
            ow.EndTime = TimeSpan.FromHours(1);

            Assert.Equal(TimeSpan.FromMinutes(30), ow.StartTime);
            Assert.Equal(TimeSpan.FromHours(1), ow.EndTime);
        }
    }
}
