using System.Collections.Generic;
using System.Threading.Tasks;
using TodoApi.Models.VesselVisitNotifications;

namespace TodoApi.Application.Services.VesselVisitNotifications
{
    public interface IVesselVisitNotificationService
    {
        Task<IEnumerable<VesselVisitNotificationDTO>> GetAllAsync();
        Task<VesselVisitNotificationDTO?> GetByIdAsync(long id);
        Task<VesselVisitNotificationDTO> CreateAsync(CreateVesselVisitNotificationDTO dto);
        Task<bool> UpdateAsync(long id, UpdateVesselVisitNotificationDTO dto);
        Task<bool> SubmitAsync(long id);

        Task<bool> ApproveAsync(long id, long dockId, long officerId);
        Task<bool> RejectAsync(long id, long officerId, string reason);
    }
}
