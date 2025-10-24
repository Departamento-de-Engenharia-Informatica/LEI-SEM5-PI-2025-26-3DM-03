using Microsoft.EntityFrameworkCore;
using TodoApi.Domain.Repositories;
using TodoApi.Models;
using TodoApi.Models.VesselVisitNotifications;

namespace TodoApi.Infrastructure.Repositories
{
    public class EfVesselVisitNotificationRepository : IVesselVisitNotificationRepository
    {
        private readonly PortContext _context;

        public EfVesselVisitNotificationRepository(PortContext context)
        {
            _context = context;
        }

        public async Task<List<VesselVisitNotification>> GetAllAsync()
        {
            return await _context.VesselVisitNotifications
                .Include(v => v.CargoManifest)
                .Include(v => v.CrewMembers)
                .ToListAsync();
        }

        public async Task<VesselVisitNotification?> GetByIdAsync(long id)
        {
            return await _context.VesselVisitNotifications
                .Include(v => v.CargoManifest)
                .Include(v => v.CrewMembers)
                .FirstOrDefaultAsync(v => v.Id == id);
        }

        public async Task AddAsync(VesselVisitNotification model)
        {
            _context.VesselVisitNotifications.Add(model);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(VesselVisitNotification model)
        {
            _context.VesselVisitNotifications.Update(model);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(VesselVisitNotification model)
        {
            _context.VesselVisitNotifications.Remove(model);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> ExistsAsync(long id)
        {
            return await _context.VesselVisitNotifications.AnyAsync(v => v.Id == id);
        }

        public async Task SaveChangesAsync()
        {
            await _context.SaveChangesAsync();
        }
    }
}
