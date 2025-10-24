using Microsoft.EntityFrameworkCore;
using TodoApi.Domain.Repositories;
using TodoApi.Models;
using TodoApi.Models.ShippingOrganizations;

namespace TodoApi.Infrastructure.Repositories
{
    public class EFShippingAgentRepository : IShippingAgentRepository
    {
        private readonly PortContext _ctx;
        public EFShippingAgentRepository(PortContext ctx) => _ctx = ctx;

        public Task<bool> ExistsByTaxNumberAsync(long taxNumber) =>
            _ctx.ShippingAgents.AnyAsync(o => o.TaxNumber == taxNumber);

        public async Task AddAsync(ShippingAgent org)
        {
            await _ctx.ShippingAgents.AddAsync(org);
        }

        public Task<ShippingAgent?> GetByTaxNumberAsync(long taxNumber) =>
            _ctx.ShippingAgents
                .Include(o => o.Representatives)
                .FirstOrDefaultAsync(o => o.TaxNumber == taxNumber);

        public Task SaveChangesAsync() => _ctx.SaveChangesAsync();
    }
}
