using System.Collections.Generic;
using System.Threading.Tasks;
using TodoApi.Models.Vessels;

namespace TodoApi.Domain.Repositories
{
    public interface IVesselRepository
    {
        Task<List<Vessel>> GetAllAsync();
        Task<Vessel?> GetByImoAsync(string imo);
        Task AddAsync(Vessel vessel);
        Task UpdateAsync(Vessel vessel);
        Task DeleteAsync(Vessel vessel);
        Task<bool> ExistsAsync(string imo);
        Task SaveChangesAsync();
    }
}
