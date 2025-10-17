using TodoApi.Models.ShippingOrganizations;

namespace TodoApi.Models.ShippingOrganizations
{
    /// <summary>
    /// Mapper responsável por converter entre DTOs e entidades ShippingAgent.
    /// </summary>
    public static class ShippingAgentMapper
    {
        public static ShippingAgent ToDomain(CreateShippingAgentDTO dto)
        {
            return new ShippingAgent
            {
                TaxNumber = dto.TaxNumber,
                Name = dto.Name,
                Type = new ShippingAgentType(dto.Type),
                Address = dto.Address,
                Representatives = dto.Representatives
            };
        }

        public static ShippingAgentDTO ToDTO(ShippingAgent org)
        {
            return new ShippingAgentDTO
            {
                TaxNumber = org.TaxNumber,
                Name = org.Name,
                Type = org.Type.ToString(),
                Address = org.Address,
                Representatives = org.Representatives
            };
        }
    }
}
