using TodoApi.Models.Vessels;

namespace TodoApi.Domain.Repositories
{
    public interface IVesselTypeRepository
    {
        Task<IEnumerable<VesselType>> GetAllAsync(string? search = null, string? filterBy = "all");
        Task<VesselType?> GetByIdAsync(long id);
        Task AddAsync(VesselType entity);
        Task UpdateAsync(VesselType entity);
        Task DeleteAsync(VesselType entity);
    }
}
