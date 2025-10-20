using System.Collections.Generic;
using System.Threading.Tasks;
using TodoApi.Models.Qualifications;

namespace TodoApi.Application.Services.Qualifications
{
    public interface IQualificationService
    {
        Task<List<QualificationDTO>> GetAllAsync(string? search = null, string? filterBy = "all");
        Task<QualificationDTO?> GetByCodeAsync(string code);
        Task<QualificationDTO> CreateAsync(CreateQualificationDTO dto);
        Task UpdateAsync(string code, UpdateQualificationDTO dto);
        Task DeleteAsync(string code);
    }
}
