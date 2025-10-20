using Microsoft.EntityFrameworkCore;
using TodoApi.Domain.Repositories;
using TodoApi.Models;
using TodoApi.Models.Vessels;

namespace TodoApi.Infrastructure.Repositories
{
    public class EfVesselTypeRepository : IVesselTypeRepository
    {
        private readonly PortContext _context;

        public EfVesselTypeRepository(PortContext context)
        {
            _context = context;
        }

        public async Task AddAsync(VesselType entity)
        {
            _context.VesselTypes.Add(entity);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(VesselType entity)
        {
            _context.VesselTypes.Remove(entity);
            await _context.SaveChangesAsync();
        }

        public async Task<IEnumerable<VesselType>> GetAllAsync(string? search = null, string? filterBy = "all")
        {
            var query = _context.VesselTypes.AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var lower = search.ToLower();
                query = filterBy?.ToLower() switch
                {
                    "name" => query.Where(v => v.Name.ToLower().Contains(lower)),
                    "description" => query.Where(v => v.Description.ToLower().Contains(lower)),
                    _ => query.Where(v => v.Name.ToLower().Contains(lower) || v.Description.ToLower().Contains(lower))
                };
            }

            return await query.ToListAsync();
        }

        public async Task<VesselType?> GetByIdAsync(long id)
        {
            return await _context.VesselTypes.FindAsync(id);
        }

        public async Task UpdateAsync(VesselType entity)
        {
            _context.Entry(entity).State = EntityState.Modified;
            await _context.SaveChangesAsync();
        }
    }
}
