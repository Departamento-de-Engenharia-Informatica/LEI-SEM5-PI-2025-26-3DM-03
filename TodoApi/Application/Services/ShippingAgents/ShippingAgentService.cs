using TodoApi.Domain.Repositories;
using TodoApi.Models.ShippingOrganizations;

namespace TodoApi.Application.Services.ShippingOrganizations
{
    public class ShippingAgentService : IShippingAgentService
    {
        private readonly IShippingAgentRepository _repo;

        public ShippingAgentService(IShippingAgentRepository repo) => _repo = repo;

        public async Task<ShippingAgentDTO> RegisterAsync(CreateShippingAgentDTO dto)
        {
            // Validações da US
            if (dto == null) throw new ArgumentException("Payload is required.");

            if (dto.TaxNumber <= 0)
                throw new ArgumentException("TaxNumber is required.");

            if (string.IsNullOrWhiteSpace(dto.LegalName) || string.IsNullOrWhiteSpace(dto.AlternativeName))
                throw new ArgumentException("Legal name and alternative name are required.");

            if (dto.Address == null ||
                string.IsNullOrWhiteSpace(dto.Address.Street) ||
                string.IsNullOrWhiteSpace(dto.Address.City) ||
                string.IsNullOrWhiteSpace(dto.Address.PostalCode) ||
                string.IsNullOrWhiteSpace(dto.Address.Country))
                throw new ArgumentException("Full address is required.");

            if (dto.Representatives == null || dto.Representatives.Count < 1)
                throw new ArgumentException("At least one representative is required.");

            if (dto.Representatives.Any(r =>
                string.IsNullOrWhiteSpace(r.Name) ||
                string.IsNullOrWhiteSpace(r.CitizenID) ||
                string.IsNullOrWhiteSpace(r.Nationality) ||
                string.IsNullOrWhiteSpace(r.Email) ||
                string.IsNullOrWhiteSpace(r.PhoneNumber)))
                throw new ArgumentException("Each representative must include name, citizenID, nationality, email and phone.");

            // Unicidade por organização (TaxNumber)
            if (await _repo.ExistsByTaxNumberAsync(dto.TaxNumber))
                throw new ArgumentException("Organization with this tax number already exists.");

            var domain = ShippingAgentMapper.ToDomain(dto);

            await _repo.AddAsync(domain);
            await _repo.SaveChangesAsync();

            return ShippingAgentMapper.ToDTO(domain);
        }

        public async Task<ShippingAgentDTO?> GetByTaxNumberAsync(long taxNumber)
        {
            var org = await _repo.GetByTaxNumberAsync(taxNumber);
            return org == null ? null : ShippingAgentMapper.ToDTO(org);
        }
    }
}
