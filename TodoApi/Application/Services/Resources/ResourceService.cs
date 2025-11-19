using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using TodoApi.Domain.Repositories;
using TodoApi.Models.Resources;

namespace TodoApi.Application.Services.Resources
{
    public class ResourceService : IResourceService
    {
        private readonly IResourceRepository _repository;

        public ResourceService(IResourceRepository repository)
        {
            _repository = repository;
        }

        public async Task<List<ResourceDTO>> GetAllAsync()
        {
            var resources = await _repository.GetAllAsync();
            return resources.Select(ResourceMapper.ToDTO).ToList();
        }

        public async Task<ResourceDTO?> GetByCodeAsync(string code)
        {
            var resource = await _repository.GetByCodeAsync(code);
            return resource is null ? null : ResourceMapper.ToDTO(resource);
        }

        public async Task<ResourceDTO> CreateAsync(CreateResourceDTO dto)
        {
            if (await _repository.ExistsAsync(dto.Code!))
                throw new InvalidOperationException($"A resource with code '{dto.Code}' already exists.");

            var resource = ResourceMapper.ToModel(dto);
            await _repository.AddAsync(resource);

            return ResourceMapper.ToDTO(resource);
        }

        public async Task UpdateAsync(string code, UpdateResourceDTO dto)
        {
            var resource = await _repository.GetByCodeAsync(code);
            if (resource is null)
                throw new KeyNotFoundException("Resource not found.");

            ResourceMapper.UpdateModel(resource, dto);
            await _repository.UpdateAsync(resource);
        }

        public async Task DeactivateAsync(string code)
        {
            var resource = await _repository.GetByCodeAsync(code);
            if (resource is null)
                throw new KeyNotFoundException("Resource not found.");

            resource.Status = "Inactive";
            await _repository.SaveChangesAsync();
        }

        public async Task ActivateAsync(string code)
        {
            var resource = await _repository.GetByCodeAsync(code);
            if (resource is null)
                throw new KeyNotFoundException("Resource not found.");

            resource.Status = "Active";
            await _repository.SaveChangesAsync();
        }

        public async Task DeleteAsync(string code)
        {
            var resource = await _repository.GetByCodeAsync(code);
            if (resource is null)
                throw new KeyNotFoundException("Resource not found.");

            await _repository.DeleteAsync(resource);
        }
    }
}
