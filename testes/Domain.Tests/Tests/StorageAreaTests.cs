using Xunit;
using TodoApi.Models.StorageAreas;
using System.Collections.Generic;

namespace Domain.Tests
{
    public class StorageAreaTests
    {
        [Fact]
        public void StorageArea_SetPropsAndCollections()
        {
            var s = new StorageArea();
            s.Id = 10;
            s.Type = StorageAreaType.Yard;
            s.Location = "North";
            s.MaxCapacityTEU = 1000;
            s.CurrentOccupancyTEU = 100;
            s.ServedDockIds.Add(1);
            s.DockDistances[1] = 250.5;

            Assert.Equal(10, s.Id);
            Assert.Equal(StorageAreaType.Yard, s.Type);
            Assert.Contains(1, s.ServedDockIds);
            Assert.Equal(250.5, s.DockDistances[1]);
        }
    }
}
