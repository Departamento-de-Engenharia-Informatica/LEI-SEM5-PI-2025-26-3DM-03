using Microsoft.EntityFrameworkCore;
using TodoApi.Models;
using TodoApi.Models.Vessels;

namespace TodoApi.Application.Services
{
    public class VesselTypeService : IVesselTypeService
    {
        private readonly PortContext _context;

        public VesselTypeService(PortContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<VesselTypeDTO>> GetAllAsync(string? search = null, string? filterBy = "all")
        {
            var query = _context.VesselTypes.AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                string lowerSearch = search.ToLower();
                query = filterBy?.ToLower() switch
                {
                    "name" => query.Where(vt => vt.Name.ToLower().Contains(lowerSearch)),
                    "description" => query.Where(vt => vt.Description.ToLower().Contains(lowerSearch)),
                    _ => query.Where(vt => vt.Name.ToLower().Contains(lowerSearch) || vt.Description.ToLower().Contains(lowerSearch))
                };
            }

            var list = await query.ToListAsync();
            return list.Select(VesselTypeMapper.ToDTO);
        }

        public async Task<VesselTypeDTO?> GetByIdAsync(long id)
        {
            var vt = await _context.VesselTypes.FindAsync(id);
            return vt == null ? null : VesselTypeMapper.ToDTO(vt);
        }

        public async Task<VesselTypeDTO> CreateAsync(CreateVesselTypeDTO dto)
        {
            var model = VesselTypeMapper.ToModel(dto);
            _context.VesselTypes.Add(model);
            await _context.SaveChangesAsync();
            return VesselTypeMapper.ToDTO(model);
        }

        public async Task<bool> UpdateAsync(long id, UpdateVesselTypeDTO dto)
        {
            if (id != dto.Id) return false;

            var vt = await _context.VesselTypes.FindAsync(id);
            if (vt == null) return false;

            vt.Name = dto.Name;
            vt.Description = dto.Description;
            vt.Capacity = dto.Capacity;
            vt.MaxRows = dto.MaxRows;
            vt.MaxBays = dto.MaxBays;
            vt.MaxTiers = dto.MaxTiers;

            _context.Entry(vt).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteAsync(long id)
        {
            var vt = await _context.VesselTypes.FindAsync(id);
            if (vt == null) return false;

            _context.VesselTypes.Remove(vt);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
