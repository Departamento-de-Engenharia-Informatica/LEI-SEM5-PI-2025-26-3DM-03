using TodoApi.Domain.Repositories;
using TodoApi.Models.Representatives;

namespace TodoApi.Application.Services.Representatives
{
    public class RepresentativeService : IRepresentativeService
    {
        private readonly IShippingAgentRepository _repo;
        public RepresentativeService(IShippingAgentRepository repo) => _repo = repo;

        public async Task<List<RepresentativeDTO>> GetAllAsync(long taxNumber)
        {
            var agent = await _repo.GetByTaxNumberAsync(taxNumber, includeRepresentatives: true);
            return agent == null
                ? new List<RepresentativeDTO>()
                : agent.Representatives.Select(RepresentativeMapper.ToDTO).ToList();
        }

        public async Task<RepresentativeDTO?> GetAsync(long taxNumber, int id)
        {
            var agent = await _repo.GetByTaxNumberAsync(taxNumber, includeRepresentatives: true);
            var rep = agent?.Representatives.FirstOrDefault(r => r.Id == id);
            return rep == null ? null : RepresentativeMapper.ToDTO(rep);
        }

        public async Task<RepresentativeDTO> CreateAsync(long taxNumber, CreateRepresentativeDTO dto)
        {
            Validate(dto);

            var agent = await _repo.GetByTaxNumberAsync(taxNumber, includeRepresentatives: true)
                        ?? throw new KeyNotFoundException("Shipping agent not found.");

            var rep = RepresentativeMapper.ToDomain(dto);
            agent.Representatives.Add(rep);

            await _repo.SaveChangesAsync();
            return RepresentativeMapper.ToDTO(rep);
        }

        public async Task<RepresentativeDTO?> UpdateAsync(long taxNumber, int id, UpdateRepresentativeDTO dto)
        {
            Validate(dto);

            var agent = await _repo.GetByTaxNumberAsync(taxNumber, includeRepresentatives: true);
            var rep = agent?.Representatives.FirstOrDefault(r => r.Id == id);
            if (rep == null) return null;

            RepresentativeMapper.MapToDomain(rep, dto);
            await _repo.SaveChangesAsync();

            return RepresentativeMapper.ToDTO(rep);
        }

        public async Task<bool> DeactivateAsync(long taxNumber, int id)
        {
            var agent = await _repo.GetByTaxNumberAsync(taxNumber, includeRepresentatives: true);
            var rep = agent?.Representatives.FirstOrDefault(r => r.Id == id);
            if (rep == null) return false;

            rep.IsActive = false;
            await _repo.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteAsync(long taxNumber, int id)
        {
            var agent = await _repo.GetByTaxNumberAsync(taxNumber, includeRepresentatives: true);
            var rep = agent?.Representatives.FirstOrDefault(r => r.Id == id);
            if (rep == null) return false;

            agent!.Representatives.Remove(rep);
            await _repo.SaveChangesAsync();
            return true;
        }

        private static void Validate(CreateRepresentativeDTO dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name) ||
                string.IsNullOrWhiteSpace(dto.CitizenID) ||
                string.IsNullOrWhiteSpace(dto.Nationality) ||
                string.IsNullOrWhiteSpace(dto.Email) ||
                string.IsNullOrWhiteSpace(dto.PhoneNumber))
                throw new ArgumentException("All representative fields are required.");
        }
        private static void Validate(UpdateRepresentativeDTO dto) =>
            Validate(new CreateRepresentativeDTO {
                Name = dto.Name, CitizenID = dto.CitizenID, Nationality = dto.Nationality,
                Email = dto.Email, PhoneNumber = dto.PhoneNumber
            });
    }
}
