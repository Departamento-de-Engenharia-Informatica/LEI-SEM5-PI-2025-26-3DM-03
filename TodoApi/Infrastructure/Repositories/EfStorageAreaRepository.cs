using Microsoft.EntityFrameworkCore;
using TodoApi.Models;
using TodoApi.Models.StorageAreas;
using TodoApi.Domain.Repositories;

namespace TodoApi.Infrastructure.Repositories
{
    public class EfStorageAreaRepository : IStorageAreaRepository
    {
        private readonly PortContext _context;

        public EfStorageAreaRepository(PortContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<StorageArea>> GetAllAsync(string? type = null, string? location = null, int? servedDockId = null)
        {
            var query = _context.Set<StorageArea>().AsQueryable();

            if (!string.IsNullOrWhiteSpace(type))
            {
                if (Enum.TryParse<StorageAreaType>(type, true, out var t))
                    query = query.Where(sa => sa.Type == t);
            }

            if (!string.IsNullOrWhiteSpace(location))
                query = query.Where(sa => sa.Location != null && sa.Location.Contains(location));

            if (servedDockId.HasValue)
                query = query.Where(sa => sa.ServedDockIds != null && sa.ServedDockIds.Contains(servedDockId.Value));

            return await query.ToListAsync();
        }

        public async Task<StorageArea?> GetByIdAsync(int id)
        {
            return await _context.Set<StorageArea>().FindAsync(id);
        }

        public async Task AddAsync(StorageArea entity)
        {
            _context.Set<StorageArea>().Add(entity);
            await SaveChangesAsync();
        }

        public async Task UpdateAsync(StorageArea entity)
        {
            _context.Set<StorageArea>().Update(entity);
            await SaveChangesAsync();
        }

        public async Task DeleteAsync(StorageArea entity)
        {
            _context.Set<StorageArea>().Remove(entity);
            await SaveChangesAsync();
        }

        public async Task SaveChangesAsync()
        {
            await _context.SaveChangesAsync();
        }
    }
}
