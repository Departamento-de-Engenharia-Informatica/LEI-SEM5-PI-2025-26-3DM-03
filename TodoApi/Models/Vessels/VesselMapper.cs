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
                    OperationalConstraints = model.VesselType.OperationalConstraints != null ? new OperationalConstraintsDTO
                    {
                        MaxRows = model.VesselType.OperationalConstraints.MaxRows,
                        MaxBays = model.VesselType.OperationalConstraints.MaxBays,
                        MaxTiers = model.VesselType.OperationalConstraints.MaxTiers
                    } : new OperationalConstraintsDTO()
                } : null,
                Operator = model.Operator
            };
        }
    }
}
