using TodoApi.Models.ShippingOrganizations;

namespace TodoApi.Application.Services.ShippingOrganizations
{
    public interface IShippingAgentService
    {
        Task<ShippingAgentDTO> RegisterAsync(CreateShippingAgentDTO dto);
        Task<ShippingAgentDTO?> GetByTaxNumberAsync(long taxNumber);
    }
}
