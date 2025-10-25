using System.Text.RegularExpressions;

namespace TodoApi.Models.Vessels
{
    public static class VesselMapper
    {
        
        private static readonly Regex ImoRegex = new("^\\d{7}$");

        /// <summary>
        /// Validates IMO number format and check digit.
        /// IMO format: 7 digits where the last digit is a check digit computed as
        /// (d1*7 + d2*6 + d3*5 + d4*4 + d5*3 + d6*2) mod 10 == d7
        /// Accepts inputs containing non-digit characters (e.g. "IMO 1234567").
        /// </summary>
        public static bool IsValidImo(string imo)
        {
            if (string.IsNullOrWhiteSpace(imo))
                return false;

            // keep only digits
            var digits = new string(imo.Where(char.IsDigit).ToArray());

            if (!ImoRegex.IsMatch(digits))
                return false;

            // compute check digit
            // weights for positions 1..6 are 7,6,5,4,3,2
            int sum = 0;
            for (int i = 0; i < 6; i++)
            {
                int d = digits[i] - '0';
                int weight = 7 - i; // 7,6,5,4,3,2
                sum += d * weight;
            }

            int check = sum % 10;
            int last = digits[6] - '0';
            return check == last;
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
