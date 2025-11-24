using OemApi.Models.Oems.DTO;
using OemApi.Models.Oems.Domain;

namespace OemApi.Models.Oems.Mapper
{
    public static class OemMapper
    {
        public static OemDto ToDto(OemManufacturer entity) => new()
        {
            Id = entity.Id,
            Code = entity.Code,
            Name = entity.Name,
            Country = entity.Country,
            Segment = entity.Segment,
            Active = entity.Active,
            ContactEmail = entity.Contact.Email,
            ContactPhone = entity.Contact.Phone,
            Notes = entity.Notes
        };

        public static OemManufacturer ToModel(CreateOemRequest request)
        {
            var contact = OemContact.Create(request.ContactEmail, request.ContactPhone);
            return OemManufacturer.Create(request.Code, request.Name, request.Country, request.Segment, request.Active, contact, request.Notes);
        }

        public static void MapToExisting(UpdateOemRequest request, OemManufacturer entity)
        {
            var contact = OemContact.Create(request.ContactEmail, request.ContactPhone);
            entity.Update(request.Code, request.Name, request.Country, request.Segment, request.Active, contact, request.Notes);
        }
    }
}
