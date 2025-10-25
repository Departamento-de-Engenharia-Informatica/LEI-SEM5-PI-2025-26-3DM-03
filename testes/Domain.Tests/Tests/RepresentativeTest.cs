using System.Collections.Generic;
using System.Linq;
using TodoApi.Models.Representatives;
using TodoApi.Models.ShippingOrganizations;
using Xunit;

namespace TodoApi.Domain.Tests.US226
{
    public class RepresentativeManagementTests_US226
    {
        private static ShippingAgent CreateAgent(long tax, string legal, string alt)
        {
            return new ShippingAgent(
                taxNumber: tax,
                legalName: legal,
                alternativeName: alt,
                type: ShippingAgentType.Owner,
                address: new Address(),
                representatives: new List<Representative>()
            );
        }

        private static Representative CreateRep(
            string name = "João Silva",
            string citizenId = "CID123",
            string nationality = "PT",
            string email = "joao@empresa.pt",
            string phone = "+351910000000")
        {
            return new Representative(name, citizenId, nationality, email, phone);
        }

        // CREATE
        [Fact]
        public void CreateRepresentative_AndAssociateWithOneAgent_Succeeds()
        {
            var agent = CreateAgent(123456789, "Empresa Marítima Lda", "EML");
            var rep = CreateRep();

            agent.Representatives.Add(rep);

            Assert.Single(agent.Representatives);
            Assert.Same(rep, agent.Representatives[0]);

            Assert.Equal("João Silva", rep.Name);
            Assert.Equal("CID123", rep.CitizenID);
            Assert.Equal("PT", rep.Nationality);
            Assert.Equal("joao@empresa.pt", rep.Email);
            Assert.Equal("+351910000000", rep.PhoneNumber);
            Assert.True(rep.IsActive);
        }

        // UPDATE
        [Fact]
        public void UpdateRepresentative_ContactData_WhileAssociatedToAgent_Succeeds()
        {
            var agent = CreateAgent(123456789, "Empresa Marítima Lda", "EML");
            var rep = CreateRep();
            agent.Representatives.Add(rep);

            rep.Email = "novo.email@empresa.pt";
            rep.PhoneNumber = "+351930000000";
            rep.Nationality = "ES";

            var stored = agent.Representatives.Single();

            Assert.Equal("novo.email@empresa.pt", stored.Email);
            Assert.Equal("+351930000000", stored.PhoneNumber);
            Assert.Equal("ES", stored.Nationality);
        }

        // DEACTIVATE
        [Fact]
        public void DeactivateRepresentative_SetsIsActiveFalse_AndRemainsAssociated()
        {
            var agent = CreateAgent(123456789, "Empresa Marítima Lda", "EML");
            var rep = CreateRep();
            agent.Representatives.Add(rep);

            rep.IsActive = false;

            Assert.Single(agent.Representatives);
            Assert.False(agent.Representatives[0].IsActive);
        }

        [Fact]
        public void Representative_ShouldBeAssociatedWithExactlyOneAgent_AtAnyTime()
        {
            var agentA = CreateAgent(111111111, "Org A", "A");
            var agentB = CreateAgent(222222222, "Org B", "B");
            var rep = CreateRep();

            agentA.Representatives.Add(rep);
            Assert.Contains(rep, agentA.Representatives);
            Assert.DoesNotContain(rep, agentB.Representatives);

            agentA.Representatives.Remove(rep);
            agentB.Representatives.Add(rep);

            Assert.DoesNotContain(rep, agentA.Representatives);
            Assert.Contains(rep, agentB.Representatives);


            Assert.Empty(agentA.Representatives);
            Assert.Single(agentB.Representatives);
        }
    }
}
