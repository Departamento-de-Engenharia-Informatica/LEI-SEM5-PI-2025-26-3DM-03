using Microsoft.EntityFrameworkCore;
using TodoApi.Models;
using TodoApi.Models.Vessels;

namespace TodoApi.Application.Services.Vessels
{
    public class VesselService : IVesselService
    {
        private readonly PortContext _context;

        public VesselService(PortContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<VesselDTO>> GetVesselsAsync(string? imo = null, string? name = null, string? @operator = null)
        {
            var query = _context.Set<Vessel>().Include(v => v.VesselType).AsQueryable();

            if (!string.IsNullOrWhiteSpace(imo))
                query = query.Where(v => v.Imo.Contains(imo));

            if (!string.IsNullOrWhiteSpace(name))
            {
                var lower = name.ToLower();
                query = query.Where(v => v.Name.ToLower().Contains(lower));
            }

            if (!string.IsNullOrWhiteSpace(@operator))
            {
                var lower = @operator.ToLower();
                query = query.Where(v => v.Operator.ToLower().Contains(lower));
            }

            var list = await query.ToListAsync();
            return list.Select(VesselMapper.ToDTO);
        }

        public async Task<VesselDTO?> GetVesselAsync(string imo)
        {
            var vessel = await _context.Set<Vessel>()
                .Include(v => v.VesselType)
                .FirstOrDefaultAsync(v => v.Imo == imo);
            
            return vessel == null ? null : VesselMapper.ToDTO(vessel);
        }

        public async Task<VesselDTO> CreateVesselAsync(CreateVesselDTO dto)
        {
            if (!IsValidImo(dto.Imo))
                throw new ArgumentException("Invalid IMO format. It should be 7 digits.");

            var routeDigits = new string(dto.Imo.Where(char.IsDigit).ToArray());

            var vt = await _context.VesselTypes.FindAsync(dto.VesselTypeId);
            if (vt == null) 
                throw new ArgumentException("Invalid VesselTypeId.");

            var exists = await _context.Vessels.AnyAsync(v => v.Imo == routeDigits);
            if (exists)
                throw new ArgumentException("A vessel with this IMO already exists.");

            var normalizedDto = new CreateVesselDTO
            {
                Imo = routeDigits,
                Name = dto.Name,
                VesselTypeId = dto.VesselTypeId,
                Operator = dto.Operator
            };

            var model = VesselMapper.ToModel(normalizedDto);
            _context.Add(model);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // Handle duplicate IMO (SQLite/SQL Server friendly)
                var innerMsg = ex.InnerException?.Message ?? string.Empty;
                if (innerMsg.Contains("UNIQUE constraint failed: Vessels.Imo", StringComparison.OrdinalIgnoreCase) ||
                    innerMsg.Contains("Cannot insert duplicate key", StringComparison.OrdinalIgnoreCase))
                    throw new ArgumentException("A vessel with this IMO already exists.");
                throw;
            }

            await _context.Entry(model).Reference(m => m.VesselType).LoadAsync();
            return VesselMapper.ToDTO(model);
        }

        public async Task UpdateVesselAsync(string imo, UpdateVesselDTO dto)
{
    
    var routeDigits = new string(imo.Where(char.IsDigit).ToArray());
    if (!IsValidImo(routeDigits))
        throw new ArgumentException("Invalid IMO: must be 7 digits with correct check digit.");

    var vessel = await _context.Set<Vessel>().FindAsync(routeDigits);
    if (vessel == null)
        throw new KeyNotFoundException("Vessel not found.");

    
    var vt = await _context.VesselTypes.FindAsync(dto.VesselTypeId);
    if (vt == null)
        throw new ArgumentException("Invalid VesselTypeId.");

    vessel.Name = dto.Name?.Trim() ?? string.Empty;
    vessel.VesselTypeId = dto.VesselTypeId;
    vessel.Operator = dto.Operator?.Trim() ?? string.Empty;

    
    await _context.SaveChangesAsync();
}


        public async Task DeleteVesselAsync(string imo)
        {
            var routeDigits = new string(imo.Where(char.IsDigit).ToArray());
            var vessel = await _context.Set<Vessel>().FindAsync(routeDigits);
            if (vessel == null)
                throw new KeyNotFoundException("Vessel not found.");

            _context.Set<Vessel>().Remove(vessel);
            await _context.SaveChangesAsync();
        }

        public bool IsValidImo(string imo) => VesselMapper.IsValidImo(imo);
    }
}
