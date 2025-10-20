using TodoApi.Models.Vessels;

namespace TodoApi.Application.Services.Vessels
{
    public interface IVesselService
    {
        Task<IEnumerable<VesselDTO>> GetVesselsAsync(string? imo = null, string? name = null, string? @operator = null);
        Task<VesselDTO?> GetVesselAsync(string imo);
        Task<VesselDTO> CreateVesselAsync(CreateVesselDTO dto);
        Task UpdateVesselAsync(string imo, UpdateVesselDTO dto);
        Task DeleteVesselAsync(string imo);
        bool IsValidImo(string imo);
    }
}