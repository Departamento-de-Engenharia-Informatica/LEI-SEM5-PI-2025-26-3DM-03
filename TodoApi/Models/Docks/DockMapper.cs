using TodoApi.Models.Vessels;

namespace TodoApi.Models.Docks
{
    public static class DockMapper
    {
        public static DockDTO ToDTO(Dock model) => new()
        {
            Id = model.Id,
            Name = model.Name,
            Location = model.Location,
            Length = model.Length,
            Depth = model.Depth,
            MaxDraft = model.MaxDraft,
            AllowedVesselTypes = model.AllowedVesselTypes?.Select(VesselTypeMapper.ToDTO) ?? Enumerable.Empty<VesselTypeDTO>()
        };
    }
}
