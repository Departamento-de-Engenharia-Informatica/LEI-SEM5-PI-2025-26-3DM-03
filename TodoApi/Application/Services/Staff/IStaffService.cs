using System.Collections.Generic;
using System.Threading.Tasks;
using TodoApi.Models.Staff;

namespace TodoApi.Application.Services.Staff
{
    public interface IStaffService
    {
        Task<List<StaffDTO>> GetAllAsync(string? search = null, string? filterBy = "all");
        Task<StaffDTO?> GetByMecanographicNumberAsync(string mecanographicNumber);
        Task<StaffDTO> CreateAsync(CreateStaffDTO dto);
        Task UpdateAsync(string mecanographicNumber, UpdateStaffDTO dto);
        Task DeactivateAsync(string mecanographicNumber);
    }
}
