using System.Collections.Generic;
using System.Linq;

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
                RequiredQualifications = resource.RequiredQualifications?.Select(rq => rq.QualificationCode).ToList() ?? new List<string>()
            };
        }

        public static Resource ToModel(CreateResourceDTO dto)
        {
            var resource = new Resource
            {
                Code = dto.Code!,
                Description = dto.Description!,
                Type = dto.Type!,
                Status = string.IsNullOrWhiteSpace(dto.Status) ? "Active" : dto.Status!.Trim(),
                OperationalCapacity = dto.OperationalCapacity,
                AssignedArea = NormalizeOptional(dto.AssignedArea),
                SetupTimeMinutes = dto.SetupTimeMinutes
            };

            ApplyQualifications(resource, dto.RequiredQualifications);
            return resource;
        }

        public static void UpdateModel(Resource resource, UpdateResourceDTO dto)
        {
            resource.Description = dto.Description!;
            resource.Type = dto.Type ?? resource.Type;
            resource.OperationalCapacity = dto.OperationalCapacity;
            resource.Status = string.IsNullOrWhiteSpace(dto.Status) ? resource.Status : dto.Status!.Trim();
            resource.AssignedArea = NormalizeOptional(dto.AssignedArea);
            resource.SetupTimeMinutes = dto.SetupTimeMinutes;

            ApplyQualifications(resource, dto.RequiredQualifications);
        }

        private static string? NormalizeOptional(string? value)
        {
            var trimmed = value?.Trim();
            return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
        }

        private static IEnumerable<string> NormalizeQualificationCodes(IEnumerable<string>? codes)
        {
            return (codes ?? Enumerable.Empty<string>())
                .Select(code => code?.Trim())
                .Where(code => !string.IsNullOrWhiteSpace(code))
                .Select(code => code!.ToUpperInvariant())
                .Distinct();
        }

        private static void ApplyQualifications(Resource resource, IEnumerable<string>? codes)
        {
            resource.RequiredQualifications.Clear();
            foreach (var code in NormalizeQualificationCodes(codes))
            {
                resource.RequiredQualifications.Add(new ResourceQualification
                {
                    QualificationCode = code
                });
            }
        }
    }
}
