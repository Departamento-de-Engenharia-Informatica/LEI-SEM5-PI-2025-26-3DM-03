using System;
using Xunit;
using TodoApi.Models.Vessels;
using TodoApi.Models.Vessels.ValueObjects;

namespace Domain.Tests
{
    public class VesselsTests
    {
        [Fact]
        public void Vessel_CanSetProperties()
        {
            var v = new Vessel { Imo = "1234567", Name = "MV Test", VesselTypeId = 2, Operator = "Ops" };
            Assert.Equal("1234567", v.Imo);
            Assert.Equal("MV Test", v.Name);
            Assert.Equal(2, v.VesselTypeId);
            Assert.Equal("Ops", v.Operator);
        }

        [Fact]
        public void OperationalConstraints_CreateAndValidation()
        {
            var oc = OperationalConstraints.Create(5, 6, 3);
            Assert.Equal(5, oc.MaxRows);
            Assert.Equal(6, oc.MaxBays);
            Assert.Equal(3, oc.MaxTiers);

            Assert.Throws<ArgumentOutOfRangeException>(() => OperationalConstraints.Create(-1, 1, 1));
            Assert.Throws<ArgumentOutOfRangeException>(() => OperationalConstraints.Create(1, -1, 1));
            Assert.Throws<ArgumentOutOfRangeException>(() => OperationalConstraints.Create(1, 1, -1));
        }

        [Fact]
        public void OperationalConstraints_EqualityAndComponents()
        {
            var a = OperationalConstraints.Create(2, 3, 4);
            var b = OperationalConstraints.Create(2, 3, 4);
            var c = OperationalConstraints.Create(2, 3, 5);

            Assert.Equal(a, b);
            Assert.NotEqual(a, c);
            Assert.Equal(a.GetHashCode(), b.GetHashCode());
        }
    }
}
