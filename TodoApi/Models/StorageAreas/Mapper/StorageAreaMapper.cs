
using System;
using TodoApi.Models.StorageAreas;
using StorageArea = TodoApi.Models.StorageAreas.StorageArea;
using StorageAreaType = TodoApi.Models.StorageAreas.StorageAreaType;

namespace TodoApi.Models.StorageAreas
{
    public static class StorageAreaMapper
    {
        public static StorageArea ToEntity(CreateStorageAreaDTO dto)
        {
            return new StorageArea
            {
                Type = Enum.TryParse<StorageAreaType>(dto.Type, true, out var t) ? t : StorageAreaType.Yard,
                Location = dto.Location ?? string.Empty,
                MaxCapacityTEU = dto.MaxCapacityTEU,
                CurrentOccupancyTEU = dto.CurrentOccupancyTEU,
                ServedDockIds = dto.ServedDockIds,
                DockDistances = dto.DockDistances
            };
        }

        public static StorageAreaDTO ToDTO(StorageArea entity)
        {
            return new StorageAreaDTO
            {
                Id = entity.Id,
                Type = entity.Type.ToString(),
                Location = entity.Location,
                MaxCapacityTEU = entity.MaxCapacityTEU,
                CurrentOccupancyTEU = entity.CurrentOccupancyTEU,
                ServedDockIds = entity.ServedDockIds,
                DockDistances = entity.DockDistances
            };
        }

        public static void UpdateEntityFromDTO(StorageArea entity, UpdateStorageAreaDTO dto)
        {
            if (dto.Location != null)
                entity.Location = dto.Location;

            if (dto.MaxCapacityTEU.HasValue)
                entity.MaxCapacityTEU = dto.MaxCapacityTEU.Value;

            if (dto.CurrentOccupancyTEU.HasValue)
            {
                if (dto.CurrentOccupancyTEU.Value > entity.MaxCapacityTEU)
                    throw new InvalidOperationException("Current occupancy cannot exceed max capacity.");
                entity.CurrentOccupancyTEU = dto.CurrentOccupancyTEU.Value;
            }

            if (dto.ServedDockIds != null)
                entity.ServedDockIds = dto.ServedDockIds;

            if (dto.DockDistances != null)
                entity.DockDistances = dto.DockDistances;
        }
    }
}