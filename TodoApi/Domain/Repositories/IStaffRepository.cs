using System.Collections.Generic;
using System.Threading.Tasks;
using TodoApi.Models.Staff;

namespace TodoApi.Domain.Repositories
{
    public interface IStaffRepository
    {
        Task<List<StaffMember>> GetAllAsync(string? search = null, string? filterBy = null);
        Task<StaffMember?> GetByMecanographicNumberAsync(string mecanographicNumber);
        Task AddAsync(StaffMember staff);
        Task UpdateAsync(StaffMember staff);
        Task<bool> ExistsAsync(string mecanographicNumber);
        Task SaveChangesAsync();
    }
}
