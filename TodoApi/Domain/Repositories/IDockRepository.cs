using System.Collections.Generic;
using System.Threading.Tasks;
using TodoApi.Models.Docks;

namespace TodoApi.Domain.Repositories
{
    public interface IDockRepository
    {
        Task<IEnumerable<Dock>> GetAllAsync(string? name = null, long? vesselTypeId = null, string? location = null);
        Task<Dock?> GetByIdAsync(long id);
        Task AddAsync(Dock entity);
        Task UpdateAsync(Dock entity);
        Task DeleteAsync(Dock entity);
        Task SaveChangesAsync();
    }
}
