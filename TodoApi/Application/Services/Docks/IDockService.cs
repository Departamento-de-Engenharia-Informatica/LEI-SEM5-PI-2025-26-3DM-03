using TodoApi.Models.Docks;

namespace TodoApi.Application.Services.Docks
{
    public interface IDockService
    {
        Task<IEnumerable<DockDTO>> GetDocksAsync(string? name = null, long? vesselTypeId = null, string? location = null);
        Task<DockDTO?> GetDockAsync(long id);
        Task<DockDTO> CreateDockAsync(CreateDockDTO dto);
        Task UpdateDockAsync(long id, UpdateDockDTO dto);
        Task DeleteDockAsync(long id);
    }
}