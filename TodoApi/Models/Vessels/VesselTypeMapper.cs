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
                OperationalConstraints = new OperationalConstraintsDTO
                {
                    MaxRows = model.OperationalConstraints.MaxRows,
                    MaxBays = model.OperationalConstraints.MaxBays,
                    MaxTiers = model.OperationalConstraints.MaxTiers
                }
            };
        }

        // Create DTO → Modelo (factory)
        public static VesselType ToModel(CreateVesselTypeDTO dto)
        {
            var constraints = TodoApi.Models.Vessels.ValueObjects.OperationalConstraints.Create(
                dto.OperationalConstraints.MaxRows,
                dto.OperationalConstraints.MaxBays,
                dto.OperationalConstraints.MaxTiers);

            return VesselType.Create(dto.Name, dto.Description, dto.Capacity, constraints);
        }

        // Update DTO → Modelo (used to update existing entity)
        public static void MapToModel(UpdateVesselTypeDTO dto, VesselType model)
        {
            var constraints = TodoApi.Models.Vessels.ValueObjects.OperationalConstraints.Create(
                dto.OperationalConstraints.MaxRows,
                dto.OperationalConstraints.MaxBays,
                dto.OperationalConstraints.MaxTiers);

            model.Update(dto.Name, dto.Description, dto.Capacity, constraints);
        }
    }
}
