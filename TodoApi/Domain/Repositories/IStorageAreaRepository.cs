using TodoApi.Models.StorageAreas;
namespace TodoApi.Domain.Repositories
{
    public interface IStorageAreaRepository
    {
        Task<IEnumerable<StorageArea>> GetAllAsync(string? type = null, string? location = null, int? servedDockId = null);
        Task<StorageArea?> GetByIdAsync(int id);
        Task AddAsync(StorageArea entity);
        Task UpdateAsync(StorageArea entity);
        Task DeleteAsync(StorageArea entity);
        Task SaveChangesAsync();
    }
}
