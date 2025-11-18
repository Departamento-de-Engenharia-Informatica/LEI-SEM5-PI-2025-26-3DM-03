using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace TodoApi.Models.PublicResources;

public class SharedResourceUploadRequest
{
    [Required]
    public IFormFile? File { get; set; }

    public string? Description { get; set; }
}
