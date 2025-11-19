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

        // GET: api/Resources
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ResourceDTO>>> GetResources()
        {
            var resources = await _service.GetAllAsync();
            return Ok(resources);
        }

        // GET: api/Resources/{code}
        [HttpGet("{code}")]
        public async Task<ActionResult<ResourceDTO>> GetResource(string code)
        {
            var resource = await _service.GetByCodeAsync(code);
            return resource is null ? NotFound() : Ok(resource);
        }

        // POST: api/Resources
        [HttpPost]
        public async Task<ActionResult<ResourceDTO>> CreateResource(CreateResourceDTO dto)
        {
            var resource = await _service.CreateAsync(dto);
            return CreatedAtAction(nameof(GetResource), new { code = resource.Code }, resource);
        }

        // PUT: api/Resources/{code}
        [HttpPut("{code}")]
        public async Task<IActionResult> UpdateResource(string code, UpdateResourceDTO dto)
        {
            await _service.UpdateAsync(code, dto);
            return NoContent();
        }

        // PUT: api/Resources/{code}/deactivate
        [HttpPut("{code}/deactivate")]
        public async Task<IActionResult> DeactivateResource(string code)
        {
            await _service.DeactivateAsync(code);
            return NoContent();
        }

        // PUT: api/Resources/{code}/activate
        [HttpPut("{code}/activate")]
        public async Task<IActionResult> ActivateResource(string code)
        {
            await _service.ActivateAsync(code);
            return NoContent();
        }

        // DELETE: api/Resources/{code}
        [HttpDelete("{code}")]
        public async Task<IActionResult> DeleteResource(string code)
        {
            await _service.DeleteAsync(code);
            return NoContent();
        }
    }
}
