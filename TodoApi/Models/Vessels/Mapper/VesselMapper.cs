namespace TodoApi.Models.Vessels
{
    public static class VesselMapper
    {
        // Pesos 7..2 usados no calculo do digito verificador
        private static readonly int[] ImoWeights = { 7, 6, 5, 4, 3, 2 };

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

            Span<int> digits = stackalloc int[7];
            var digitCount = 0;

            foreach (var ch in imo)
            {
                if (!char.IsDigit(ch)) continue;

                if (digitCount >= digits.Length)
                    return false;

                digits[digitCount++] = ch - '0';
            }

            if (digitCount != digits.Length)
                return false;

            // Check-digit validation
            var sum = 0;
            for (var i = 0; i < ImoWeights.Length; i++)
            {
                sum += digits[i] * ImoWeights[i];
            }

            var checkDigit = sum % 10;
            var lastDigit = digits[digits.Length - 1];
            return checkDigit == lastDigit;
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
