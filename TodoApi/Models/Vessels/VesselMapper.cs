using System.Text.RegularExpressions;

namespace TodoApi.Models.Vessels
{
    public static class VesselMapper
    {
        
        private static readonly Regex ImoRegex = new("^\\d{7}$");

        public static bool IsValidImo(string imo)
        {
            if (string.IsNullOrWhiteSpace(imo))
                return false;

            
            var digits = new string(imo.Where(char.IsDigit).ToArray());

            if (!ImoRegex.IsMatch(digits))
                return false;

            
            return true;
        }

        public static Vessel ToModel(CreateVesselDTO dto)
        {
            return new Vessel
            {
                Imo = dto.Imo,
                Name = dto.Name,
                VesselTypeId = dto.VesselTypeId,
                Operator = dto.Operator
            };
        }

        public static VesselDTO ToDTO(Vessel model)
        {
            return new VesselDTO
            {
                Imo = model.Imo,
                Name = model.Name,
                VesselTypeId = model.VesselTypeId,
                VesselType = model.VesselType != null ? new VesselTypeDTO
                {
                    Id = model.VesselType.Id,
                    Name = model.VesselType.Name,
                    Description = model.VesselType.Description,
                    Capacity = model.VesselType.Capacity,
                    MaxRows = model.VesselType.MaxRows,
                    MaxBays = model.VesselType.MaxBays,
                    MaxTiers = model.VesselType.MaxTiers
                } : null,
                Operator = model.Operator
            };
        }
    }
}
