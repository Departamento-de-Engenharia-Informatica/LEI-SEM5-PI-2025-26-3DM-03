using Microsoft.EntityFrameworkCore;
using TodoApi.Models;
using TodoApi.Models.Docks;

namespace TodoApi.Application.Services.Docks
{
    public class DockService : IDockService
    {
        private readonly PortContext _context;

        public DockService(PortContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<DockDTO>> GetDocksAsync(string? name = null, long? vesselTypeId = null, string? location = null)
        {
            var query = _context.Docks.Include(d => d.AllowedVesselTypes).AsQueryable();

            if (!string.IsNullOrWhiteSpace(name))
            {
                var n = name.ToLower();
                query = query.Where(d => d.Name.ToLower().Contains(n));
            }

            if (!string.IsNullOrWhiteSpace(location))
            {
                var l = location.ToLower();
                query = query.Where(d => d.Location.ToLower().Contains(l));
            }

            if (vesselTypeId.HasValue)
            {
                query = query.Where(d => d.AllowedVesselTypes.Any(v => v.Id == vesselTypeId.Value));
            }

            var docks = await query.ToListAsync();
            return docks.Select(DockMapper.ToDTO);
        }

        public async Task<DockDTO?> GetDockAsync(long id)
        {
            var dock = await _context.Docks
                .Include(d => d.AllowedVesselTypes)
                .FirstOrDefaultAsync(d => d.Id == id);

            return dock == null ? null : DockMapper.ToDTO(dock);
        }

        public async Task<DockDTO> CreateDockAsync(CreateDockDTO dto)
        {
            var dock = new Dock
            {
                Name = dto.Name,
                Location = dto.Location,
                Length = dto.Length,
                Depth = dto.Depth,
                MaxDraft = dto.MaxDraft
            };

            if (dto.AllowedVesselTypeIds != null && dto.AllowedVesselTypeIds.Any())
            {
                var vesselTypes = await _context.VesselTypes
                    .Where(v => dto.AllowedVesselTypeIds.Contains(v.Id))
                    .ToListAsync();

                if (vesselTypes.Count != dto.AllowedVesselTypeIds.Count())
                    throw new ArgumentException("One or more invalid vessel type IDs");

                dock.AllowedVesselTypes = vesselTypes;
            }

            _context.Docks.Add(dock);
            await _context.SaveChangesAsync();

            return DockMapper.ToDTO(dock);
        }

        public async Task UpdateDockAsync(long id, UpdateDockDTO dto)
        {
            if (id != dto.Id)
                throw new ArgumentException("ID mismatch");

            var dock = await _context.Docks
                .Include(d => d.AllowedVesselTypes)
                .FirstOrDefaultAsync(d => d.Id == id);

            if (dock == null)
                throw new KeyNotFoundException("Dock not found");

            dock.Name = dto.Name;
            dock.Location = dto.Location;
            dock.Length = dto.Length;
            dock.Depth = dto.Depth;
            dock.MaxDraft = dto.MaxDraft;

            if (dto.AllowedVesselTypeIds != null)
            {
                var vesselTypes = await _context.VesselTypes
                    .Where(v => dto.AllowedVesselTypeIds.Contains(v.Id))
                    .ToListAsync();

                if (vesselTypes.Count != dto.AllowedVesselTypeIds.Count())
                    throw new ArgumentException("One or more invalid vessel type IDs");

                dock.AllowedVesselTypes.Clear();
                foreach (var vt in vesselTypes)
                    dock.AllowedVesselTypes.Add(vt);
            }

            await _context.SaveChangesAsync();
        }

        public async Task DeleteDockAsync(long id)
        {
            var dock = await _context.Docks.FindAsync(id);
            if (dock == null)
                throw new KeyNotFoundException("Dock not found");

            _context.Docks.Remove(dock);
            await _context.SaveChangesAsync();
        }
    }
}