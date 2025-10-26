using TodoApi.Models.Representatives;
using DomainRep = TodoApi.Models.Representatives.Representative;

namespace TodoApi.Models.Representatives
{
    public static class RepresentativeMapper
    {
        public static DomainRep ToDomain(CreateRepresentativeDTO dto) => new()
        {
            Name = dto.Name,
            CitizenID = dto.CitizenID,
            Nationality = dto.Nationality,
            Email = dto.Email,
            PhoneNumber = dto.PhoneNumber,
            IsActive = true
        };

        public static void MapToDomain(DomainRep rep, UpdateRepresentativeDTO dto)
        {
            rep.Name = dto.Name;
            rep.CitizenID = dto.CitizenID;
            rep.Nationality = dto.Nationality;
            rep.Email = dto.Email;
            rep.PhoneNumber = dto.PhoneNumber;
            rep.IsActive = dto.IsActive;
        }

        public static RepresentativeDTO ToDTO(DomainRep rep) => new()
        {
            Id = rep.Id,
            Name = rep.Name,
            CitizenID = rep.CitizenID,
            Nationality = rep.Nationality,
            Email = rep.Email,
            PhoneNumber = rep.PhoneNumber,
            IsActive = rep.IsActive
        };
    }
}
