namespace TodoApi.Models.Vessels
{
    public static class VesselTypeMapper
    {
        // Modelo → DTO (Read)
        public static VesselTypeDTO ToDTO(VesselType model) => new()
        {
            Id = model.Id,
            Name = model.Name,
            Description = model.Description,
            Capacity = model.Capacity,
            MaxRows = model.MaxRows,
            MaxBays = model.MaxBays,
            MaxTiers = model.MaxTiers
        };

        // Create DTO → Modelo
        public static VesselType ToModel(CreateVesselTypeDTO dto) => new(
            dto.Name, dto.Description, dto.Capacity, dto.MaxRows, dto.MaxBays, dto.MaxTiers);

        // Update DTO → Modelo
        public static VesselType ToModel(UpdateVesselTypeDTO dto) => new(
            dto.Name, dto.Description, dto.Capacity, dto.MaxRows, dto.MaxBays, dto.MaxTiers)
        {
            Id = dto.Id
        };
    }
}
