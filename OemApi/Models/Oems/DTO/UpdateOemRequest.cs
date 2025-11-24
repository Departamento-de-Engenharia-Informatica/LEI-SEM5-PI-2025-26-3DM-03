using System.ComponentModel.DataAnnotations;

namespace OemApi.Models.Oems.DTO
{
    public class UpdateOemRequest : CreateOemRequest
    {
        [Required]
        public Guid Id { get; set; }
    }
}
