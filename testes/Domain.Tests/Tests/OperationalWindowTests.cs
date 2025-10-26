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
            var ow = OperationalWindow.Create(TimeSpan.FromHours(7), TimeSpan.FromHours(15));
            Assert.True(ow.StartTime < ow.EndTime);
        }

        [Fact]
        public void Can_Set_And_Read_Times()
        {
            var ow = OperationalWindow.Create(TimeSpan.FromMinutes(30), TimeSpan.FromHours(1));

            Assert.Equal(TimeSpan.FromMinutes(30), ow.StartTime);
            Assert.Equal(TimeSpan.FromHours(1), ow.EndTime);
        }
    }
}
