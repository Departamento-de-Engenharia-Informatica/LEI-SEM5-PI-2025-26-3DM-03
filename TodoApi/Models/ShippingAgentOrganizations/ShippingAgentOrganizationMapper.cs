namespace TodoApi.Models.ShippingAgentOrganization
{
    public static class ShippingAgentOrganizationMapper
    {
        public static ShippingAgentOrganization ToDomain(CreateShippingAgentOrganizationDTO dto)
        {
            return new ShippingAgentOrganization
            {
                TaxNumber = dto.TaxNumber,
                Name = dto.Name,
                Type = new ShippingAgentType(dto.Type),
                Address = dto.Address,
                Representatives = dto.Representatives
            };
        }

        public static ShippingAgentOrganizationDTO ToDTO(ShippingAgentOrganization org)
        {
            return new ShippingAgentOrganizationDTO
            {
                TaxNumber = org.TaxNumber,
                Name = org.Name,
                Type = org.Type?.Value ?? string.Empty,
                Address = org.Address,
                Representatives = org.Representatives
            };
        }
    }
}