using TodoApi.Models.Vessels;

namespace TodoApi.Application.Services
{
    public interface IVesselTypeService
    {
        Task<IEnumerable<VesselTypeDTO>> GetAllAsync(string? search = null, string? filterBy = "all");
        Task<VesselTypeDTO?> GetByIdAsync(long id);
        Task<VesselTypeDTO> CreateAsync(CreateVesselTypeDTO dto);
        Task<bool> UpdateAsync(long id, UpdateVesselTypeDTO dto);
        Task<bool> DeleteAsync(long id);
    }
}
