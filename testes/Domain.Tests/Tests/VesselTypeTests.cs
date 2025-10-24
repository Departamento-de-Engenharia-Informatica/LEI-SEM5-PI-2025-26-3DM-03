using System;
using Xunit;
using TodoApi.Models.Vessels;
using TodoApi.Models.Vessels.ValueObjects;

namespace Domain.Tests
{
    public class VesselTypeTests
    {
        [Fact]
        public void Create_WithValidValues_Succeeds()
        {
            var oc = OperationalConstraints.Create(2, 3, 1);
            var vt = VesselType.Create("Name","Desc",100, oc);
            Assert.Equal("Name", vt.Name);
            Assert.Equal(100, vt.Capacity);
            Assert.Equal(oc, vt.OperationalConstraints);
        }

        [Fact]
        public void Create_InvalidParameters_Throws()
        {
            var oc = OperationalConstraints.Create(1,1,1);
            Assert.Throws<ArgumentException>(() => VesselType.Create("", "d", 1, oc));
            Assert.Throws<ArgumentOutOfRangeException>(() => VesselType.Create("n","d", -1, oc));
            Assert.Throws<ArgumentNullException>(() => VesselType.Create("n","d", 1, null!));
        }

        [Fact]
        public void Update_Works()
        {
            var oc = OperationalConstraints.Create(1,1,1);
            var vt = VesselType.Create("n","d",10, oc);
            var newOc = OperationalConstraints.Create(2,2,2);
            vt.Update("new","nd",20,newOc);
            Assert.Equal("new", vt.Name);
            Assert.Equal(20, vt.Capacity);
            Assert.Equal(newOc, vt.OperationalConstraints);
        }
    }
}
