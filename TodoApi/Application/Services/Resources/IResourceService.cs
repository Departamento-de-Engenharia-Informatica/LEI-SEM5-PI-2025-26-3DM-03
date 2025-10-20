using System.Collections.Generic;
using System.Threading.Tasks;
using TodoApi.Models.Resources;

namespace TodoApi.Application.Services.Resources
{
    public interface IResourceService
    {
        Task<List<ResourceDTO>> GetAllAsync();
        Task<ResourceDTO?> GetByCodeAsync(string code);
        Task<ResourceDTO> CreateAsync(CreateResourceDTO dto);
        Task UpdateAsync(string code, UpdateResourceDTO dto);
        Task DeactivateAsync(string code);
    }
}
