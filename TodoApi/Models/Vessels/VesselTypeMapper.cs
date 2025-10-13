namespace TodoApi.Models.Vessels
{
    public static class VesselTypeMapper
    {
        // Converter do modelo (DB) → DTO (API)
        public static VesselTypeDTO ToDTO(VesselType model)
        {
            return new VesselTypeDTO
            {
                Id = model.Id,
                Name = model.Name,
                Description = model.Description,
                Capacity = model.Capacity,
                MaxRows = model.MaxRows,
                MaxBays = model.MaxBays,
                MaxTiers = model.MaxTiers
            };
        }

        // Converter do DTO (API) → modelo (DB)
        public static VesselType ToModel(VesselTypeDTO dto)
        {
            return new VesselType(
                dto.Name,
                dto.Description,
                dto.Capacity,
                dto.MaxRows,
                dto.MaxBays,
                dto.MaxTiers
            )
            { Id = dto.Id };
        }
    }
}
