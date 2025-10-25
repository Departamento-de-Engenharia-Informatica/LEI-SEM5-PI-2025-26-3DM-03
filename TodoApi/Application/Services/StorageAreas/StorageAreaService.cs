using TodoApi.Models.StorageAreas;
using TodoApi.Domain.Repositories;

namespace TodoApi.Application.Services.StorageAreas
{
    public class StorageAreaService : IStorageAreaService
    {
        private readonly IStorageAreaRepository _repository;
        private readonly IDockRepository _dockRepository;

        public StorageAreaService(IStorageAreaRepository repository, IDockRepository dockRepository)
        {
            _repository = repository;
            _dockRepository = dockRepository;
        }

        public async Task<StorageArea> RegisterStorageAreaAsync(CreateStorageAreaDTO dto)
        {
            var area = StorageAreaMapper.ToEntity(dto);

            // Business rule: current occupancy cannot exceed max capacity
            if (area.CurrentOccupancyTEU > area.MaxCapacityTEU)
                throw new InvalidOperationException("Current occupancy cannot exceed max capacity.");

            // If ServedDockIds provided, validate they exist
            if (area.ServedDockIds != null && area.ServedDockIds.Count > 0)
            {
                foreach (var dockId in area.ServedDockIds)
                {
                    var dock = await _dockRepository.GetByIdAsync(dockId);
                    if (dock == null)
                        throw new ArgumentException($"Served dock id {dockId} does not exist.");
                }
            }

            await _repository.AddAsync(area);
            return area;
        }

        public async Task<StorageArea> UpdateStorageAreaAsync(int id, UpdateStorageAreaDTO dto)
        {
            var area = await _repository.GetByIdAsync(id);
            if (area == null)
                throw new KeyNotFoundException("Storage area not found.");

            // Apply updates (mapper enforces occupancy <= capacity)
            StorageAreaMapper.UpdateEntityFromDTO(area, dto);

            // If ServedDockIds provided, validate they exist
            if (dto.ServedDockIds != null && dto.ServedDockIds.Count > 0)
            {
                foreach (var dockId in dto.ServedDockIds)
                {
                    var dock = await _dockRepository.GetByIdAsync(dockId);
                    if (dock == null)
                        throw new ArgumentException($"Served dock id {dockId} does not exist.");
                }
            }

            await _repository.UpdateAsync(area);
            return area;
        }

        public async Task<StorageArea?> GetStorageAreaAsync(int id)
        {
            return await _repository.GetByIdAsync(id);
        }

        public async Task<IEnumerable<StorageArea>> GetAllStorageAreasAsync()
        {
            return await _repository.GetAllAsync();
        }
    }
}
