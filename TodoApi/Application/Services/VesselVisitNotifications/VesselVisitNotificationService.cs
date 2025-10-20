using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using TodoApi.Models;
using TodoApi.Models.VesselVisitNotifications;

namespace TodoApi.Application.Services.VesselVisitNotifications
{
    public class VesselVisitNotificationService : IVesselVisitNotificationService
    {
        private readonly PortContext _context;

        public VesselVisitNotificationService(PortContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<VesselVisitNotificationDTO>> GetAllAsync()
        {
            var list = await _context.VesselVisitNotifications.AsNoTracking().ToListAsync();
            return list.Select(VesselVisitNotificationMapper.ToDTO);
        }

        public async Task<VesselVisitNotificationDTO?> GetByIdAsync(long id)
        {
            var item = await _context.VesselVisitNotifications.FindAsync(id);
            if (item == null) return null;
            return VesselVisitNotificationMapper.ToDTO(item);
        }

        public async Task<bool> ApproveAsync(long id, long dockId, long officerId)
        {
            var item = await _context.VesselVisitNotifications.FindAsync(id);
            if (item == null) return false;

            item.Status = "Approved";
            item.ApprovedDockId = dockId;
            item.OfficerId = officerId;
            item.DecisionTimestamp = DateTime.UtcNow;

            _context.VesselVisitNotifications.Update(item);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> RejectAsync(long id, long officerId, string reason)
        {
            var item = await _context.VesselVisitNotifications.FindAsync(id);
            if (item == null) return false;

            item.Status = "Rejected";
            item.RejectionReason = reason;
            item.OfficerId = officerId;
            item.DecisionTimestamp = DateTime.UtcNow;

            _context.VesselVisitNotifications.Update(item);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
