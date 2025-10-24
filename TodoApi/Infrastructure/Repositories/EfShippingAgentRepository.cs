// File: Infrastructure/Repositories/EfShippingAgentRepository.cs
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using TodoApi.Domain.Repositories;
using TodoApi.Models;
using TodoApi.Models.ShippingOrganizations;

namespace TodoApi.Infrastructure.Repositories
{
    public class EfShippingAgentRepository : IShippingAgentRepository
    {
        private readonly PortContext _ctx;
        public EfShippingAgentRepository(PortContext ctx) => _ctx = ctx;

        public Task<bool> ExistsByTaxNumberAsync(long taxNumber) =>
            _ctx.ShippingAgents.AnyAsync(o => o.TaxNumber == taxNumber);

        public Task AddAsync(ShippingAgent org) =>
            _ctx.ShippingAgents.AddAsync(org).AsTask();

        public Task<ShippingAgent?> GetByTaxNumberAsync(long taxNumber, bool includeRepresentatives = false)
        {
            var query = _ctx.ShippingAgents.AsQueryable();

            // Representatives é uma coleção owned (OwnsMany) — Include funciona normalmente.
            if (includeRepresentatives)
                query = query.Include(o => o.Representatives);

            return query.FirstOrDefaultAsync(o => o.TaxNumber == taxNumber);
        }

        public Task SaveChangesAsync() => _ctx.SaveChangesAsync();
    }
}
