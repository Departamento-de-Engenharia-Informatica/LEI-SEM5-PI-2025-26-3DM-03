using Microsoft.EntityFrameworkCore;
using TodoApi.Domain.Repositories;
using TodoApi.Models;
using TodoApi.Models.Docks;

namespace TodoApi.Infrastructure.Repositories
{
    public class EfDockRepository : IDockRepository
    {
        private readonly PortContext _context;

        public EfDockRepository(PortContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<Dock>> GetAllAsync(string? name = null, long? vesselTypeId = null, string? location = null)
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

            return await query.ToListAsync();
        }

        public async Task<Dock?> GetByIdAsync(long id)
        {
            return await _context.Docks
                .Include(d => d.AllowedVesselTypes)
                .FirstOrDefaultAsync(d => d.Id == id);
        }

        public async Task AddAsync(Dock entity)
        {
            _context.Docks.Add(entity);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(Dock entity)
        {
            _context.Entry(entity).State = EntityState.Modified;
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(Dock entity)
        {
            _context.Docks.Remove(entity);
            await _context.SaveChangesAsync();
        }

        public async Task SaveChangesAsync()
        {
            await _context.SaveChangesAsync();
        }
    }
}
