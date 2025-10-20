namespace TodoApi.Models.Resources
{
    public static class ResourceMapper
    {
        public static ResourceDTO ToDTO(Resource resource)
        {
            return new ResourceDTO
            {
                Code = resource.Code,
                Description = resource.Description,
                Type = resource.Type,
                Status = resource.Status,
                OperationalCapacity = resource.OperationalCapacity,
                AssignedArea = resource.AssignedArea,
                SetupTimeMinutes = resource.SetupTimeMinutes,
                RequiredQualifications = resource.RequiredQualifications
            };
        }

        public static Resource ToModel(CreateResourceDTO dto)
        {
            var resource = new Resource
            {
                Code = dto.Code,
                Description = dto.Description,
                Type = dto.Type,
                OperationalCapacity = dto.OperationalCapacity,
                AssignedArea = dto.AssignedArea,
                SetupTimeMinutes = dto.SetupTimeMinutes
            };
            return resource;
        }

        public static void UpdateModel(Resource resource, UpdateResourceDTO dto)
        {
            resource.Description = dto.Description;
            resource.OperationalCapacity = dto.OperationalCapacity;
            resource.AssignedArea = dto.AssignedArea;
            resource.SetupTimeMinutes = dto.SetupTimeMinutes;
        }
    }
}