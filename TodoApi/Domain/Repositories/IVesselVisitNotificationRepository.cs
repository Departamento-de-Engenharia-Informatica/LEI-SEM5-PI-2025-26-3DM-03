using System.Collections.Generic;
using System.Threading.Tasks;
using TodoApi.Models.VesselVisitNotifications;

namespace TodoApi.Domain.Repositories
{
    public interface IVesselVisitNotificationRepository
    {
        Task<List<VesselVisitNotification>> GetAllAsync();
        Task<VesselVisitNotification?> GetByIdAsync(long id);
        Task AddAsync(VesselVisitNotification model);
        Task UpdateAsync(VesselVisitNotification model);
        Task DeleteAsync(VesselVisitNotification model);
        Task<bool> ExistsAsync(long id);
        Task SaveChangesAsync();
    }
}
