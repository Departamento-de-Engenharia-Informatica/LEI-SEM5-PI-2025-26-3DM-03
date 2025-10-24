using TodoApi.Models.Representatives;

namespace TodoApi.Application.Services.Representatives
{
    public interface IRepresentativeService
    {
        Task<List<RepresentativeDTO>> GetAllAsync(long taxNumber);
        Task<RepresentativeDTO?> GetAsync(long taxNumber, int id);
        Task<RepresentativeDTO> CreateAsync(long taxNumber, CreateRepresentativeDTO dto);
        Task<RepresentativeDTO?> UpdateAsync(long taxNumber, int id, UpdateRepresentativeDTO dto);
        Task<bool> DeactivateAsync(long taxNumber, int id);
        Task<bool> DeleteAsync(long taxNumber, int id);
    }
}
