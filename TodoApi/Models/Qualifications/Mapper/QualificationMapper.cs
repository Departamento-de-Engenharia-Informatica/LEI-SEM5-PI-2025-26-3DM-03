namespace TodoApi.Models.Qualifications
{
    public static class QualificationMapper
    {
        // Modelo → DTO (Read)
        public static QualificationDTO ToDTO(Qualification model) => new()
        {
            Code = model.Code,
            Description = model.Description
        };

        // Create DTO → Modelo
        public static Qualification ToModel(CreateQualificationDTO dto) =>
            new Qualification(dto.Code, dto.Description);

        // Atualiza uma entidade existente a partir de um Update DTO
        public static void UpdateModel(Qualification model, UpdateQualificationDTO dto)
        {
            model.Description = dto.Description;
        }
    }
}
