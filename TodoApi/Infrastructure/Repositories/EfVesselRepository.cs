using Microsoft.EntityFrameworkCore;
using TodoApi.Domain.Repositories;
using TodoApi.Models;
using TodoApi.Models.Vessels;

namespace TodoApi.Infrastructure.Repositories
{
    public class EfVesselRepository : IVesselRepository
    {
        private readonly PortContext _context;

        public EfVesselRepository(PortContext context)
        {
            _context = context;
        }

        public async Task<List<Vessel>> GetAllAsync()
        {
            return await _context.Set<Vessel>().Include(v => v.VesselType).ToListAsync();
        }

        public async Task<Vessel?> GetByImoAsync(string imo)
        {
            return await _context.Set<Vessel>().Include(v => v.VesselType).FirstOrDefaultAsync(v => v.Imo == imo);
        }

        public async Task AddAsync(Vessel vessel)
        {
            _context.Set<Vessel>().Add(vessel);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(Vessel vessel)
        {
            _context.Set<Vessel>().Update(vessel);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(Vessel vessel)
        {
            _context.Set<Vessel>().Remove(vessel);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> ExistsAsync(string imo)
        {
            return await _context.Set<Vessel>().AnyAsync(v => v.Imo == imo);
        }

        public async Task SaveChangesAsync()
        {
            await _context.SaveChangesAsync();
        }
    }
}
