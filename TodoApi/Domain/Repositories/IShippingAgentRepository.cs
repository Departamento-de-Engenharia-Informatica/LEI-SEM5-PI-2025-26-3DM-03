// IShippingAgentRepository.cs
using TodoApi.Models.ShippingOrganizations;

namespace TodoApi.Domain.Repositories
{
    public interface IShippingAgentRepository
    {
        Task<bool> ExistsByTaxNumberAsync(long taxNumber);
        Task AddAsync(ShippingAgent org);
        Task<ShippingAgent?> GetByTaxNumberAsync(long taxNumber);
        Task SaveChangesAsync();
    }
}
