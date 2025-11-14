using System.Text.RegularExpressions;

namespace TodoApi.Models.Vessels
{
    public static class VesselMapper
    {
        // Regex simples: apenas 7 dígitos
        private static readonly Regex ImoRegex = new(@"^\d{7}$");

        /// <summary>
        /// Validates an IMO number:
        ///  - Accepts inputs with non-digits (e.g., "IMO 1234567"), uses only digits
        ///  - Must be exactly 7 digits after cleaning
        ///  - Enforces check digit per IMO rule: (d1*7 + d2*6 + d3*5 + d4*4 + d5*3 + d6*2) % 10 == d7
        /// </summary>
        public static bool IsValidImo(string imo)
        {
            if (string.IsNullOrWhiteSpace(imo))
                return false;

            // Keep only digits and check if it has exactly 7
            var digits = new string(imo.Where(char.IsDigit).ToArray());
            if (!ImoRegex.IsMatch(digits)) return false;

            // Check-digit validation
            int sum = 0;
            // weights 7,6,5,4,3,2 applied to first 6 digits
            int[] weights = {7, 6, 5, 4, 3, 2};
            for (int i = 0; i < 6; i++)
            {
                sum += (digits[i] - '0') * weights[i];
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
