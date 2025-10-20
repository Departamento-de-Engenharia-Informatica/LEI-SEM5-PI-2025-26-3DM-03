using Microsoft.EntityFrameworkCore;
using TodoApi.Domain.Repositories;
using TodoApi.Models;
using TodoApi.Models.Qualifications;

namespace TodoApi.Infrastructure.Repositories
{
    public class EfQualificationRepository : IQualificationRepository
    {
        private readonly PortContext _context;

        public EfQualificationRepository(PortContext context)
        {
            _context = context;
        }

        public async Task<List<Qualification>> GetAllAsync()
        {
            return await _context.Qualifications.ToListAsync();
        }

        public async Task<Qualification?> GetByCodeAsync(string code)
        {
            return await _context.Qualifications.FindAsync(code);
        }

        public async Task<List<Qualification>> SearchAsync(string? search, string? filterBy)
        {
            var query = _context.Qualifications.AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                string lowerSearch = search.ToLower();

                query = filterBy?.ToLower() switch
                {
                    "code" => query.Where(q => q.Code.ToLower().Contains(lowerSearch)),
                    "description" => query.Where(q => q.Description.ToLower().Contains(lowerSearch)),
                    _ => query.Where(q =>
                        q.Code.ToLower().Contains(lowerSearch) ||
                        q.Description.ToLower().Contains(lowerSearch))
                };
            }

            return await query.ToListAsync();
        }

        public async Task AddAsync(Qualification qualification)
        {
            _context.Qualifications.Add(qualification);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(Qualification qualification)
        {
            _context.Qualifications.Update(qualification);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(Qualification qualification)
        {
            _context.Qualifications.Remove(qualification);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> ExistsAsync(string code)
        {
            return await _context.Qualifications.AnyAsync(q => q.Code == code);
        }

        public async Task SaveChangesAsync()
        {
            await _context.SaveChangesAsync();
        }
    }
}
