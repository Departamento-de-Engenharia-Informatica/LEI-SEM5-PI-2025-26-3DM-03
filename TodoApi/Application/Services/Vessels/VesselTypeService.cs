using TodoApi.Application.Services.Vessels;
using TodoApi.Domain.Repositories;
using TodoApi.Models.Vessels;

namespace TodoApi.Application.Services.Vessels
{
    public class VesselTypeService : IVesselTypeService
    {
        private readonly IVesselTypeRepository _repository;

        public VesselTypeService(IVesselTypeRepository repository)
        {
            _repository = repository;
        }

        public async Task<IEnumerable<VesselTypeDTO>> GetAllAsync(string? search = null, string? filterBy = "all")
        {
            var list = await _repository.GetAllAsync(search, filterBy);
            return list.Select(VesselTypeMapper.ToDTO);
        }

        public async Task<VesselTypeDTO?> GetByIdAsync(long id)
        {
            var vt = await _repository.GetByIdAsync(id);
            return vt == null ? null : VesselTypeMapper.ToDTO(vt);
        }

        public async Task<VesselTypeDTO> CreateAsync(CreateVesselTypeDTO dto)
        {
            var model = VesselTypeMapper.ToModel(dto);
            await _repository.AddAsync(model);
            return VesselTypeMapper.ToDTO(model);
        }

        public async Task<bool> UpdateAsync(long id, UpdateVesselTypeDTO dto)
        {
            if (id != dto.Id) return false;

            var vt = await _repository.GetByIdAsync(id);
            if (vt == null) return false;

            VesselTypeMapper.MapToModel(dto, vt);
            await _repository.UpdateAsync(vt);
            return true;
        }

        public async Task<bool> DeleteAsync(long id)
        {
            var vt = await _repository.GetByIdAsync(id);
            if (vt == null) return false;

            await _repository.DeleteAsync(vt);
            return true;
        }
    }
}
