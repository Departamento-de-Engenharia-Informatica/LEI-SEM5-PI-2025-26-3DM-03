using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TodoApi.Models;
using TodoApi.Models.Resources;

namespace TodoApi.Controllers.Resources
{
    [Route("api/[controller]")]
    [ApiController]
    public class ResourcesController : ControllerBase
    {
        private readonly PortContext _context;

        public ResourcesController(PortContext context)
        {
            _context = context;
        }

        // GET: api/Resources
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ResourceDTO>>> GetResources()
        {
            var resources = await _context.Resources.ToListAsync();
            return resources.Select(ResourceMapper.ToDTO).ToList();
        }

        // GET: api/Resources/5
        [HttpGet("{code}")]
        public async Task<ActionResult<ResourceDTO>> GetResource(string code)
        {
            var resource = await _context.Resources.FindAsync(code);

            if (resource == null)
            {
                return NotFound();
            }

            return ResourceMapper.ToDTO(resource);
        }

        // PUT: api/Resources/5
        [HttpPut("{code}")]
        public async Task<IActionResult> UpdateResource(string code, UpdateResourceDTO dto)
        {
            var resource = await _context.Resources.FindAsync(code);
            if (resource == null)
            {
                return NotFound();
            }

            ResourceMapper.UpdateModel(resource, dto);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!await ResourceExists(code))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        // POST: api/Resources
        [HttpPost]
        public async Task<ActionResult<ResourceDTO>> CreateResource(CreateResourceDTO dto)
        {
            if (await ResourceExists(dto.Code))
            {
                return Conflict("A resource with this code already exists");
            }

            var resource = ResourceMapper.ToModel(dto);
            _context.Resources.Add(resource);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetResource),
                new { code = resource.Code },
                ResourceMapper.ToDTO(resource));
        }

        // PATCH: api/Resources/5/deactivate
        [HttpPatch("{code}/deactivate")]
        public async Task<IActionResult> DeactivateResource(string code)
        {
            var resource = await _context.Resources.FindAsync(code);
            if (resource == null)
            {
                return NotFound();
            }

            resource.Status = "Inactive";
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private async Task<bool> ResourceExists(string code)
        {
            return await _context.Resources.AnyAsync(e => e.Code == code);
        }
    }
}