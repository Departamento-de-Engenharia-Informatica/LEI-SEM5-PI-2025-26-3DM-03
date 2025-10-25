using System.Collections.Generic;
using TodoApi.Models.ShippingOrganizations;
using TodoApi.Models.Representatives;
using Xunit;

namespace TodoApi.Domain.Tests.Models.ShippingOrganizations
{
    public class ShippingAgentTests
    {
        [Fact]
        public void DefaultConstructor_InitializesDefaults()
        {
            var agent = new ShippingAgent();

            Assert.Equal(0, agent.TaxNumber);
            Assert.Equal(string.Empty, agent.LegalName);
            Assert.Equal(string.Empty, agent.AlternativeName);
            Assert.Equal(ShippingAgentType.Owner, agent.Type);
            Assert.NotNull(agent.Address);
            Assert.NotNull(agent.Representatives);
            Assert.Empty(agent.Representatives);
        }

        [Fact]
        public void ParameterizedConstructor_AssignsAllProperties()
        {
            var reps = new List<Representative>
            {
                new Representative("João Silva", "CID123", "PT", "joao@empresa.pt", "+351910000000")
            };
            var address = new Address();

            var agent = new ShippingAgent(
                taxNumber: 123456789,
                legalName: "Empresa Marítima Lda",
                alternativeName: "EML",
                type: ShippingAgentType.Owner,
                address: address,
                representatives: reps
            );

            Assert.Equal(123456789, agent.TaxNumber);
            Assert.Equal("Empresa Marítima Lda", agent.LegalName);
            Assert.Equal("EML", agent.AlternativeName);
            Assert.Equal(ShippingAgentType.Owner, agent.Type);
            Assert.Same(address, agent.Address);
            Assert.Same(reps, agent.Representatives);
            Assert.Single(agent.Representatives);
            Assert.Equal("João Silva", agent.Representatives[0].Name);
        }
    }
}
