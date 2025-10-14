using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TodoApi.Models;
using TodoApi.Models.Docks;
using TodoApi.Models.Vessels;

namespace TodoApi.Controllers.Docks
{
    [Route("api/[controller]")]
    [ApiController]
    public class DocksController : ControllerBase
    {
        private readonly PortContext _context;

        public DocksController(PortContext context)
        {
            _context = context;
        }

        // GET: api/Docks?name=...&vesselTypeId=...&location=...
        [HttpGet]
        public async Task<ActionResult<IEnumerable<DockDTO>>> GetDocks(
            string? name = null,
            long? vesselTypeId = null,
            string? location = null)
        {
            var query = _context.Docks.Include(d => d.AllowedVesselTypes).AsQueryable();

            if (!string.IsNullOrWhiteSpace(name))
            {
                var n = name.ToLower();
                query = query.Where(d => d.Name.ToLower().Contains(n));
            }

            if (!string.IsNullOrWhiteSpace(location))
            {
                var l = location.ToLower();
                query = query.Where(d => d.Location.ToLower().Contains(l));
            }

            if (vesselTypeId.HasValue)
            {
                query = query.Where(d => d.AllowedVesselTypes.Any(v => v.Id == vesselTypeId.Value));
            }

            var docks = await query.ToListAsync();

            return Ok(docks.Select(DockMapper.ToDTO));
        }

        // GET: api/Docks/5
        [HttpGet("{id}")]
        public async Task<ActionResult<DockDTO>> GetDock(long id)
        {
            var dock = await _context.Docks.Include(d => d.AllowedVesselTypes).FirstOrDefaultAsync(d => d.Id == id);
            if (dock == null) return NotFound();

            return DockMapper.ToDTO(dock);
        }

        // POST: api/Docks
        [HttpPost]
        public async Task<ActionResult<DockDTO>> PostDock(CreateDockDTO dto)
        {
            var dock = new Dock
            {
                Name = dto.Name,
                Location = dto.Location,
                Length = dto.Length,
                Depth = dto.Depth,
                MaxDraft = dto.MaxDraft
            };

            // Resolve vessel types
            if (dto.AllowedVesselTypeIds != null && dto.AllowedVesselTypeIds.Any())
            {
                var vesselTypes = await _context.VesselTypes.Where(v => dto.AllowedVesselTypeIds.Contains(v.Id)).ToListAsync();
                dock.AllowedVesselTypes = vesselTypes;
            }

            _context.Docks.Add(dock);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetDock), new { id = dock.Id }, DockMapper.ToDTO(dock));
        }

        // PUT: api/Docks/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutDock(long id, UpdateDockDTO dto)
        {
            if (id != dto.Id) return BadRequest();

            var dock = await _context.Docks.Include(d => d.AllowedVesselTypes).FirstOrDefaultAsync(d => d.Id == id);
            if (dock == null) return NotFound();

            dock.Name = dto.Name;
            dock.Location = dto.Location;
            dock.Length = dto.Length;
            dock.Depth = dto.Depth;
            dock.MaxDraft = dto.MaxDraft;

            // Update allowed vessel types
            dock.AllowedVesselTypes.Clear();
            if (dto.AllowedVesselTypeIds != null && dto.AllowedVesselTypeIds.Any())
            {
                var vesselTypes = await _context.VesselTypes.Where(v => dto.AllowedVesselTypeIds.Contains(v.Id)).ToListAsync();
                foreach (var vt in vesselTypes) dock.AllowedVesselTypes.Add(vt);
            }

            _context.Entry(dock).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/Docks/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDock(long id)
        {
            var dock = await _context.Docks.FindAsync(id);
            if (dock == null) return NotFound();

            _context.Docks.Remove(dock);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
