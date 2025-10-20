using Microsoft.EntityFrameworkCore;
using TodoApi.Domain.Repositories;
using TodoApi.Models;
using TodoApi.Models.Resources;

namespace TodoApi.Infrastructure.Repositories
{
    public class EfResourceRepository : IResourceRepository
    {
        private readonly PortContext _context;

        public EfResourceRepository(PortContext context)
        {
            _context = context;
        }

        public async Task<List<Resource>> GetAllAsync()
        {
            return await _context.Resources.ToListAsync();
        }

        public async Task<Resource?> GetByCodeAsync(string code)
        {
            return await _context.Resources.FindAsync(code);
        }

        public async Task AddAsync(Resource resource)
        {
            _context.Resources.Add(resource);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(Resource resource)
        {
            _context.Resources.Update(resource);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> ExistsAsync(string code)
        {
            return await _context.Resources.AnyAsync(r => r.Code == code);
        }

        public async Task SaveChangesAsync()
        {
            await _context.SaveChangesAsync();
        }
    }
}
