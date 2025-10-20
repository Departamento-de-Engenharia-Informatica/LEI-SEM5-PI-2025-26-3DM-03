using TodoApi.Models.StorageAreas;

namespace TodoApi.Application.Services.StorageAreas
{
    public interface IStorageAreaService
    {
        Task<StorageArea> RegisterStorageAreaAsync(CreateStorageAreaDTO dto);
        Task<StorageArea> UpdateStorageAreaAsync(int id, UpdateStorageAreaDTO dto);
        Task<StorageArea?> GetStorageAreaAsync(int id);
        Task<IEnumerable<StorageArea>> GetAllStorageAreasAsync();
    }
}
