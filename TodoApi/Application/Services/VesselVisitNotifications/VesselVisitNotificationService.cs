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

        public async Task<IEnumerable<VesselVisitNotificationDTO>> GetAllAsync(VesselVisitNotificationFilterDTO? filter = null, long? callerAgentId = null)
        {
            var query = _context.VesselVisitNotifications
                .AsNoTracking()
                .Include(v => v.CargoManifest)
                .Include(v => v.CrewMembers)
                .AsQueryable();

            // Scope to caller's ShippingAgent if provided (representatives can only see notifications for their agent)
            if (callerAgentId.HasValue)
            {
                query = query.Where(v => v.AgentId == callerAgentId.Value);
            }

            if (filter != null)
            {
                if (!string.IsNullOrWhiteSpace(filter.VesselId))
                {
                    // partial match to help searching by vessel id
                    var vessel = filter.VesselId.Trim();
                    query = query.Where(v => v.VesselId.Contains(vessel));
                }

                if (!string.IsNullOrWhiteSpace(filter.Status))
                {
                    var status = filter.Status.Trim();
                    query = query.Where(v => v.Status == status);
                }

                if (!string.IsNullOrWhiteSpace(filter.RepresentativeEmail))
                {
                    var email = filter.RepresentativeEmail.Trim().ToLower();
                    query = query.Where(v => v.SubmittedByRepresentativeEmail != null && v.SubmittedByRepresentativeEmail.ToLower() == email);
                }

                if (filter.SubmittedFrom.HasValue)
                {
                    var from = filter.SubmittedFrom.Value;
                    query = query.Where(v => v.SubmissionTimestamp.HasValue && v.SubmissionTimestamp.Value >= from);
                }

                if (filter.SubmittedTo.HasValue)
                {
                    var to = filter.SubmittedTo.Value;
                    query = query.Where(v => v.SubmissionTimestamp.HasValue && v.SubmissionTimestamp.Value <= to);
                }

                // paging
                var page = Math.Max(1, filter.Page);
                var pageSize = Math.Clamp(filter.PageSize, 1, 200);

                query = query.OrderByDescending(v => v.SubmissionTimestamp ?? v.ArrivalDate)
                             .Skip((page - 1) * pageSize).Take(pageSize);
            }
            else
            {
                // default: return most recent 100 items
                query = query.OrderByDescending(v => v.SubmissionTimestamp ?? v.ArrivalDate).Take(100);
            }

            var list = await query.ToListAsync();
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

            // Only allow updates when the notification is still in progress
            if (!string.Equals(item.Status, "InProgress", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Only notifications with status 'InProgress' can be updated.");
            }

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

            // If caller requested a status change as part of the update, handle it here.
            if (!string.IsNullOrWhiteSpace(dto.Status))
            {
                var requested = dto.Status.Trim();
                // allow representative to request submission / approval pending
                if (string.Equals(requested, "Submitted", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(requested, "ApprovalPending", StringComparison.OrdinalIgnoreCase))
                {
                    // Validate required fields before allowing the transition
                    if (string.IsNullOrWhiteSpace(item.VesselId))
                        throw new InvalidOperationException("Vessel identifier is required before submission.");
                    if (item.AgentId <= 0)
                        throw new InvalidOperationException("Agent identifier is required before submission.");
                    if (item.ArrivalDate == default)
                        throw new InvalidOperationException("Arrival date is required before submission.");

                    // Validate container codes if present
                    if (item.CargoManifest != null)
                    {
                        foreach (var itm in item.CargoManifest)
                        {
                            if (string.IsNullOrWhiteSpace(itm.ContainerCode) || !Iso6346Regex.IsMatch(itm.ContainerCode))
                                throw new ArgumentException("Invalid container identifier");
                        }
                    }

                    // apply requested status and submission timestamp
                    item.Status = string.Equals(requested, "ApprovalPending", StringComparison.OrdinalIgnoreCase) ? "ApprovalPending" : "Submitted";
                    item.SubmissionTimestamp = DateTime.UtcNow;
                }
                else
                {
                    throw new InvalidOperationException("Requested status change not allowed.");
                }
            }
            else
            {
                // keep status as InProgress (do not elevate here)
                item.Status = "InProgress";
            }

            _context.VesselVisitNotifications.Update(item);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> SubmitAsync(long id, string? submitterEmail = null, string? submitterName = null)
        {
            var item = await _context.VesselVisitNotifications
                .Include(v => v.CargoManifest)
                .Include(v => v.CrewMembers)
                .FirstOrDefaultAsync(v => v.Id == id);
            if (item == null) return false;

            // Only allow submission when it's currently in progress
            if (!string.Equals(item.Status, "InProgress", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Only notifications with status 'InProgress' can be submitted.");
            }

            // Validate required fields before submission
            if (string.IsNullOrWhiteSpace(item.VesselId))
                throw new InvalidOperationException("Vessel identifier is required before submission.");
            if (item.AgentId <= 0)
                throw new InvalidOperationException("Agent identifier is required before submission.");
            if (item.ArrivalDate == default)
                throw new InvalidOperationException("Arrival date is required before submission.");

            // Validate container codes if present
            if (item.CargoManifest != null)
            {
                foreach (var itm in item.CargoManifest)
                {
                    if (string.IsNullOrWhiteSpace(itm.ContainerCode) || !Iso6346Regex.IsMatch(itm.ContainerCode))
                        throw new ArgumentException("Invalid container identifier");
                }
            }

            item.Status = "Submitted";
            item.SubmissionTimestamp = DateTime.UtcNow;
            // record submitter info if provided
            if (!string.IsNullOrWhiteSpace(submitterEmail)) item.SubmittedByRepresentativeEmail = submitterEmail;
            if (!string.IsNullOrWhiteSpace(submitterName)) item.SubmittedByRepresentativeName = submitterName;
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
