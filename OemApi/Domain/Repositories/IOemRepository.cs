using OemApi.Models.Oems.Domain;

namespace OemApi.Domain.Repositories
{
    public interface IOemRepository
    {
        Task<IReadOnlyList<OemManufacturer>> GetAllAsync(CancellationToken cancellationToken = default);
        Task<OemManufacturer?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
        Task<OemManufacturer?> GetByCodeAsync(string code, CancellationToken cancellationToken = default);
        Task AddAsync(OemManufacturer entity, CancellationToken cancellationToken = default);
        Task UpdateAsync(OemManufacturer entity, CancellationToken cancellationToken = default);
        Task DeleteAsync(OemManufacturer entity, CancellationToken cancellationToken = default);
        Task<bool> ExistsWithCodeAsync(string code, Guid? ignoreId = null, CancellationToken cancellationToken = default);
    }
}
