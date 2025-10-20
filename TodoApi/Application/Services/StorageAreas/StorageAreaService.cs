using TodoApi.Models.StorageAreas;
using System.Collections.Concurrent;

namespace TodoApi.Application.Services.StorageAreas
{
    public class StorageAreaService : IStorageAreaService
    {
        
        private static readonly ConcurrentDictionary<int, StorageArea> _storageAreas = new();
        private static int _nextId = 1;

        public async Task<StorageArea> RegisterStorageAreaAsync(CreateStorageAreaDTO dto)
        {
            var area = new StorageArea
            {
                Id = _nextId++,
                Type = Enum.TryParse<StorageAreaType>(dto.Type, true, out var t) ? t : StorageAreaType.Yard,
                Location = dto.Location,
                MaxCapacityTEU = dto.MaxCapacityTEU,
                CurrentOccupancyTEU = dto.CurrentOccupancyTEU,
                ServedDockIds = dto.ServedDockIds,
                DockDistances = dto.DockDistances
            };
            if (area.CurrentOccupancyTEU > area.MaxCapacityTEU)
                throw new InvalidOperationException("Current occupancy cannot exceed max capacity.");
            _storageAreas[area.Id] = area;
            return area;
        }

        public async Task<StorageArea> UpdateStorageAreaAsync(int id, UpdateStorageAreaDTO dto)
        {
            if (!_storageAreas.TryGetValue(id, out var area))
                throw new KeyNotFoundException("Storage area not found.");
            if (dto.Location != null) area.Location = dto.Location;
            if (dto.MaxCapacityTEU.HasValue) area.MaxCapacityTEU = dto.MaxCapacityTEU.Value;
            if (dto.CurrentOccupancyTEU.HasValue)
            {
                if (dto.CurrentOccupancyTEU.Value > area.MaxCapacityTEU)
                    throw new InvalidOperationException("Current occupancy cannot exceed max capacity.");
                area.CurrentOccupancyTEU = dto.CurrentOccupancyTEU.Value;
            }
            if (dto.ServedDockIds != null) area.ServedDockIds = dto.ServedDockIds;
            if (dto.DockDistances != null) area.DockDistances = dto.DockDistances;
            return area;
        }

        public async Task<StorageArea?> GetStorageAreaAsync(int id)
        {
            _storageAreas.TryGetValue(id, out var area);
            return area;
        }

        public async Task<IEnumerable<StorageArea>> GetAllStorageAreasAsync()
        {
            return _storageAreas.Values;
        }
    }
}
