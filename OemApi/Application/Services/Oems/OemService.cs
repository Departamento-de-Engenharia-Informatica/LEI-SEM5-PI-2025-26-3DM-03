using OemApi.Domain.Repositories;
using OemApi.Models.Oems.DTO;
using OemApi.Models.Oems.Mapper;

namespace OemApi.Application.Services.Oems
{
    public class OemService : IOemService
    {
        private readonly IOemRepository _repository;

        public OemService(IOemRepository repository)
        {
            _repository = repository;
        }

        public async Task<IReadOnlyCollection<OemDto>> GetAllAsync(CancellationToken cancellationToken = default)
        {
            var entities = await _repository.GetAllAsync(cancellationToken);
            return entities.Select(OemMapper.ToDto).ToList();
        }

        public async Task<OemDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        {
            var entity = await _repository.GetByIdAsync(id, cancellationToken);
            return entity == null ? null : OemMapper.ToDto(entity);
        }

        public async Task<OemDto> CreateAsync(CreateOemRequest request, CancellationToken cancellationToken = default)
        {
            var existing = await _repository.ExistsWithCodeAsync(request.Code, null, cancellationToken);
            if (existing)
                throw new InvalidOperationException($"An OEM with code '{request.Code}' already exists.");

            var entity = OemMapper.ToModel(request);
            await _repository.AddAsync(entity, cancellationToken);
            return OemMapper.ToDto(entity);
        }

        public async Task<bool> UpdateAsync(Guid id, UpdateOemRequest request, CancellationToken cancellationToken = default)
        {
            if (id != request.Id)
                return false;

            var entity = await _repository.GetByIdAsync(id, cancellationToken);
            if (entity == null)
                return false;

            var duplicate = await _repository.ExistsWithCodeAsync(request.Code, id, cancellationToken);
            if (duplicate)
                throw new InvalidOperationException($"An OEM with code '{request.Code}' already exists.");

            OemMapper.MapToExisting(request, entity);
            await _repository.UpdateAsync(entity, cancellationToken);
            return true;
        }

        public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
        {
            var entity = await _repository.GetByIdAsync(id, cancellationToken);
            if (entity == null)
                return false;

            await _repository.DeleteAsync(entity, cancellationToken);
            return true;
        }
    }
}
