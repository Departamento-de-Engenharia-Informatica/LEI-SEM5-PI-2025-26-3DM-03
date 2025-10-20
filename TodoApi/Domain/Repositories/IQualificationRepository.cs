using System.Collections.Generic;
using System.Threading.Tasks;
using TodoApi.Models.Qualifications;

namespace TodoApi.Domain.Repositories
{
    public interface IQualificationRepository
    {
        Task<List<Qualification>> GetAllAsync();
        Task<Qualification?> GetByCodeAsync(string code);
        Task<List<Qualification>> SearchAsync(string? search, string? filterBy);
        Task AddAsync(Qualification qualification);
        Task UpdateAsync(Qualification qualification);
        Task DeleteAsync(Qualification qualification);
        Task<bool> ExistsAsync(string code);
        Task SaveChangesAsync();
    }
}
