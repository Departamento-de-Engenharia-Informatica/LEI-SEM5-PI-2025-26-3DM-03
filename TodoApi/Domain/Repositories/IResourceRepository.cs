using System.Collections.Generic;
using System.Threading.Tasks;
using TodoApi.Models.Resources;

namespace TodoApi.Domain.Repositories
{
    public interface IResourceRepository
    {
        Task<List<Resource>> GetAllAsync();
        Task<Resource?> GetByCodeAsync(string code);
        Task AddAsync(Resource resource);
        Task UpdateAsync(Resource resource);
        Task<bool> ExistsAsync(string code);
        Task SaveChangesAsync();
    }
}
