using Microsoft.EntityFrameworkCore;
using OemApi.Domain.Repositories;
using OemApi.Models;
using OemApi.Models.Oems.Domain;

namespace OemApi.Infrastructure.Repositories
{
    public class EfOemRepository : IOemRepository
    {
        private readonly OemContext _context;

        public EfOemRepository(OemContext context)
        {
            _context = context;
        }

        public async Task AddAsync(OemManufacturer entity, CancellationToken cancellationToken = default)
        {
            await _context.Oems.AddAsync(entity, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task DeleteAsync(OemManufacturer entity, CancellationToken cancellationToken = default)
        {
            _context.Oems.Remove(entity);
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task<IReadOnlyList<OemManufacturer>> GetAllAsync(CancellationToken cancellationToken = default)
        {
            return await _context.Oems
                .AsNoTracking()
                .OrderBy(o => o.Name)
                .ToListAsync(cancellationToken);
        }

        public async Task<OemManufacturer?> GetByCodeAsync(string code, CancellationToken cancellationToken = default)
        {
            var normalized = code.Trim();
            return await _context.Oems.FirstOrDefaultAsync(o => o.Code == normalized, cancellationToken);
        }

        public async Task<OemManufacturer?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        {
            return await _context.Oems.FirstOrDefaultAsync(o => o.Id == id, cancellationToken);
        }

        public async Task UpdateAsync(OemManufacturer entity, CancellationToken cancellationToken = default)
        {
            _context.Entry(entity).State = EntityState.Modified;
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task<bool> ExistsWithCodeAsync(string code, Guid? ignoreId = null, CancellationToken cancellationToken = default)
        {
            var normalized = code.Trim();
            return await _context.Oems
                .AnyAsync(o => o.Code == normalized && (!ignoreId.HasValue || o.Id != ignoreId.Value), cancellationToken);
        }
    }
}
