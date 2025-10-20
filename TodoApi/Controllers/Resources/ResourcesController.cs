using Microsoft.AspNetCore.Mvc;
using TodoApi.Application.Services.Resources;
using TodoApi.Models.Resources;

namespace TodoApi.Controllers.Resources
{
    [Route("api/[controller]")]
    [ApiController]
    public class ResourcesController : ControllerBase
    {
        private readonly IResourceService _service;

        public ResourcesController(IResourceService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ResourceDTO>>> GetResources()
        {
            var resources = await _service.GetAllAsync();
            return Ok(resources);
        }

        [HttpGet("{code}")]
        public async Task<ActionResult<ResourceDTO>> GetResource(string code)
        {
            var resource = await _service.GetByCodeAsync(code);
            return resource is null ? NotFound() : Ok(resource);
        }

        [HttpPost]
        public async Task<ActionResult<ResourceDTO>> CreateResource(CreateResourceDTO dto)
        {
            var resource = await _service.CreateAsync(dto);
            return CreatedAtAction(nameof(GetResource), new { code = resource.Code }, resource);
        }

        [HttpPut("{code}")]
        public async Task<IActionResult> UpdateResource(string code, UpdateResourceDTO dto)
        {
            await _service.UpdateAsync(code, dto);
            return NoContent();
        }

        [HttpPatch("{code}/deactivate")]
        public async Task<IActionResult> DeactivateResource(string code)
        {
            await _service.DeactivateAsync(code);
            return NoContent();
        }
    }
}
