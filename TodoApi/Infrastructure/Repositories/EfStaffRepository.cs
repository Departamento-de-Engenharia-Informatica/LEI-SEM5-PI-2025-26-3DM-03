using Microsoft.EntityFrameworkCore;
using TodoApi.Domain.Repositories;
using TodoApi.Models;
using TodoApi.Models.Staff;

namespace TodoApi.Infrastructure.Repositories
{
    public class EfStaffRepository : IStaffRepository
    {
        private readonly PortContext _context;

        public EfStaffRepository(PortContext context)
        {
            _context = context;
        }

        public async Task<List<StaffMember>> GetAllAsync(string? search = null, string? filterBy = null)
        {
            var query = _context.Set<StaffMember>()
                .Include(s => s.Qualifications)
                .AsNoTracking()
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var lower = search.Trim().ToLower();
                var key = (filterBy ?? "all").Trim().ToLower();

                query = key switch
                {
                    "mecanographic" => query.Where(s =>
                        s.MecanographicNumber.ToLower().Contains(lower)),

                    "name" => query.Where(s =>
                        s.ShortName.ToLower().Contains(lower)),

                    "status" => query.Where(s =>
                        s.Status.ToLower().Contains(lower)),

                    "qualification" => query.Where(s =>
                        s.Qualifications.Any(q => q.QualificationCode.ToLower().Contains(lower))),

                    // ✅ NOVO: filtro por ativo/inativo
                    "active" => TryParseBoolFlexible(lower, out var activeVal)
                        ? query.Where(s => s.Active == activeVal)
                        : query.Where(_ => false), // termo inválido → lista vazia

                    // pesquisa livre (all)
                    _ => TryParseBoolFlexible(lower, out var boolVal)
                        ? query.Where(s =>
                               s.MecanographicNumber.ToLower().Contains(lower)
                            || s.ShortName.ToLower().Contains(lower)
                            || s.Status.ToLower().Contains(lower)
                            || s.Qualifications.Any(q => q.QualificationCode.ToLower().Contains(lower))
                            || s.Active == boolVal)
                        : query.Where(s =>
                               s.MecanographicNumber.ToLower().Contains(lower)
                            || s.ShortName.ToLower().Contains(lower)
                            || s.Status.ToLower().Contains(lower)
                            || s.Qualifications.Any(q => q.QualificationCode.ToLower().Contains(lower)))
                };
            }

            return await query.ToListAsync();
        }

        private static bool TryParseBoolFlexible(string input, out bool value)
        {
            switch (input)
            {
                case "true":
                case "1":
                case "yes":
                case "y":
                case "sim":
                    value = true; return true;
                case "false":
                case "0":
                case "no":
                case "n":
                case "nao":
                case "não":
                    value = false; return true;
                default:
                    return bool.TryParse(input, out value);
            }
        }

        public async Task<StaffMember?> GetByMecanographicNumberAsync(string mecanographicNumber)
        {
            return await _context.Set<StaffMember>().FindAsync(mecanographicNumber);
        }

        public async Task AddAsync(StaffMember staff)
        {
            _context.Set<StaffMember>().Add(staff);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(StaffMember staff)
        {
            _context.Set<StaffMember>().Update(staff);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> ExistsAsync(string mecanographicNumber)
        {
            return await _context.Set<StaffMember>().AnyAsync(s => s.MecanographicNumber == mecanographicNumber);
        }

        public async Task SaveChangesAsync()
        {
            await _context.SaveChangesAsync();
        }
    }
}
