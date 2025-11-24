using OemApi.Models.Oems.DTO;

namespace OemApi.Application.Services.Oems
{
    public interface IOemService
    {
        Task<IReadOnlyCollection<OemDto>> GetAllAsync(CancellationToken cancellationToken = default);
        Task<OemDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
        Task<OemDto> CreateAsync(CreateOemRequest request, CancellationToken cancellationToken = default);
        Task<bool> UpdateAsync(Guid id, UpdateOemRequest request, CancellationToken cancellationToken = default);
        Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
    }
}
