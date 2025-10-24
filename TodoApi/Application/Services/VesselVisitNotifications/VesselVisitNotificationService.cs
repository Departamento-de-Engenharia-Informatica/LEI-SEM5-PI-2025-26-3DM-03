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
        private static readonly System.Text.RegularExpressions.Regex Iso6346Regex = new System.Text.RegularExpressions.Regex("^[A-Z]{4}\\d{7}$", System.Text.RegularExpressions.RegexOptions.Compiled);

        public VesselVisitNotificationService(PortContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<VesselVisitNotificationDTO>> GetAllAsync()
        {
            var list = await _context.VesselVisitNotifications
                .AsNoTracking()
                .Include(v => v.CargoManifest)
                .Include(v => v.CrewMembers)
                .ToListAsync();
            return list.Select(VesselVisitNotificationMapper.ToDTO);
        }

        public async Task<VesselVisitNotificationDTO?> GetByIdAsync(long id)
        {
            var item = await _context.VesselVisitNotifications
                .Include(v => v.CargoManifest)
                .Include(v => v.CrewMembers)
                .FirstOrDefaultAsync(v => v.Id == id);
            if (item == null) return null;
            return VesselVisitNotificationMapper.ToDTO(item);
        }

        public async Task<VesselVisitNotificationDTO> CreateAsync(CreateVesselVisitNotificationDTO dto)
        {
            // validate container codes
            if (dto.CargoManifest != null)
            {
                foreach (var itm in dto.CargoManifest)
                {
                    if (string.IsNullOrWhiteSpace(itm.ContainerCode) || !Iso6346Regex.IsMatch(itm.ContainerCode))
                        throw new ArgumentException("Invalid container identifier");
                }
            }

            var model = VesselVisitNotificationMapper.ToModel(dto);
            model.Status = "InProgress";
            _context.VesselVisitNotifications.Add(model);
            await _context.SaveChangesAsync();

            return VesselVisitNotificationMapper.ToDTO(model);
        }

        public async Task<bool> UpdateAsync(long id, UpdateVesselVisitNotificationDTO dto)
        {
            var item = await _context.VesselVisitNotifications
                .Include(v => v.CargoManifest)
                .Include(v => v.CrewMembers)
                .FirstOrDefaultAsync(v => v.Id == id);
            if (item == null) return false;

            // validate container codes if provided
            if (dto.CargoManifest != null)
            {
                foreach (var itm in dto.CargoManifest)
                {
                    if (string.IsNullOrWhiteSpace(itm.ContainerCode) || !Iso6346Regex.IsMatch(itm.ContainerCode))
                        throw new ArgumentException("Invalid container identifier");
                }
            }

            VesselVisitNotificationMapper.UpdateFromDto(item, dto);
            // keep status as InProgress
            item.Status = item.Status ?? "InProgress";
            _context.VesselVisitNotifications.Update(item);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> SubmitAsync(long id)
        {
            var item = await _context.VesselVisitNotifications.FindAsync(id);
            if (item == null) return false;

            item.Status = "Submitted";
            item.SubmissionTimestamp = DateTime.UtcNow;
            _context.VesselVisitNotifications.Update(item);
            await _context.SaveChangesAsync();
            return true;
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
