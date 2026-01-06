using Microsoft.AspNetCore.Http;

namespace TodoApi.Models.PublicResources.DTO
{
    public class UploadResourceDto
    {
        public IFormFile File { get; set; } = null!;
        public string? Description { get; set; }
    }
}
