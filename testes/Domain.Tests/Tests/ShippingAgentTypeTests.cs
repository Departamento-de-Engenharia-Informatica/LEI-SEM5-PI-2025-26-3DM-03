using System;
using TodoApi.Models.ShippingOrganizations;
using Xunit;

namespace Domain.Tests
{
    public class ShippingAgentTypeTests
    {
        [Fact]
        public void OwnerAndOperator_ImplicitConversionAndEquality()
        {
            // static instances
            var owner = ShippingAgentType.Owner;
            var op = ShippingAgentType.Operator;

            // implicit to string
            string sOwner = owner;
            string sOp = op;
            Assert.Equal("Owner", sOwner);
            Assert.Equal("Operator", sOp);

            // implicit from string
            ShippingAgentType fromOwner = "Owner";
            ShippingAgentType fromOp = "Operator";
            Assert.Equal(owner, fromOwner);
            Assert.Equal(op, fromOp);

            // Equals override
            Assert.True(owner.Equals((object)fromOwner));
            Assert.False(owner.Equals(op));
        }

        [Fact]
        public void Constructor_RejectsNullOrEmpty()
        {
            Assert.Throws<ArgumentException>(() => new ShippingAgentType(null!));
            Assert.Throws<ArgumentException>(() => new ShippingAgentType(string.Empty));
            Assert.Throws<ArgumentException>(() => new ShippingAgentType("  "));
        }

        [Fact]
        public void Constructor_RejectsInvalidValue()
        {
            var ex = Assert.Throws<ArgumentException>(() => new ShippingAgentType("Invalid"));
            Assert.Contains("Invalid ShippingAgentType", ex.Message);
        }

        [Fact]
        public void Canonicalization_ToString_And_GetHashCode()
        {
            // lower-case input should canonicalize to 'Owner'
            var lower = new ShippingAgentType("owner");
            Assert.Equal("Owner", lower.Value);
            Assert.Equal("Owner", lower.ToString());

            // GetHashCode should match underlying string hash
            Assert.Equal(lower.Value.GetHashCode(), lower.GetHashCode());
        }
    }
}
