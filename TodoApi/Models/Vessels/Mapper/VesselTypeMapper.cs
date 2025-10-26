namespace TodoApi.Models.Vessels
{
    public static class VesselTypeMapper
    {
        // Modelo → DTO (Read)
        public static VesselTypeDTO ToDTO(VesselType model)
        {
            if (model == null) return null!;

            return new VesselTypeDTO
            {
                Id = model.Id,
                Name = model.Name,
                Description = model.Description,
                Capacity = model.Capacity,
                OperationalConstraints = model.OperationalConstraints != null
                    ? new OperationalConstraintsDTO
                    {
                        MaxRows = model.OperationalConstraints.MaxRows,
                        MaxBays = model.OperationalConstraints.MaxBays,
                        MaxTiers = model.OperationalConstraints.MaxTiers
                    }
                    : new OperationalConstraintsDTO()
            };
        }

        // Create DTO → Modelo (factory)
        public static VesselType ToModel(CreateVesselTypeDTO dto)
        {
            // Prefer flattened fields when provided by the client; otherwise use nested OperationalConstraints
            int maxRows = dto.MaxRows ?? dto.OperationalConstraints.MaxRows;
            int maxBays = dto.MaxBays ?? dto.OperationalConstraints.MaxBays;
            int maxTiers = dto.MaxTiers ?? dto.OperationalConstraints.MaxTiers;

            var constraints = TodoApi.Models.Vessels.ValueObjects.OperationalConstraints.Create(
                maxRows,
                maxBays,
                maxTiers);

            return VesselType.Create(dto.Name, dto.Description, dto.Capacity, constraints);
        }

        // Update DTO → Modelo (used to update existing entity)
        public static void MapToModel(UpdateVesselTypeDTO dto, VesselType model)
        {
            int maxRows = dto.MaxRows ?? dto.OperationalConstraints.MaxRows;
            int maxBays = dto.MaxBays ?? dto.OperationalConstraints.MaxBays;
            int maxTiers = dto.MaxTiers ?? dto.OperationalConstraints.MaxTiers;

            var constraints = TodoApi.Models.Vessels.ValueObjects.OperationalConstraints.Create(
                maxRows,
                maxBays,
                maxTiers);

            model.Update(dto.Name, dto.Description, dto.Capacity, constraints);
        }
    }
}
