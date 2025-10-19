using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TodoApi.Models;
using TodoApi.Models.Vessels;

namespace TodoApi.Controllers.Vessels
{
    [Route("api/[controller]")]
    [ApiController]
    public class VesselsController : ControllerBase
    {
        private readonly PortContext _context;

        public VesselsController(PortContext context)
        {
            _context = context;
        }

        
        [HttpGet]
        public async Task<ActionResult<IEnumerable<VesselDTO>>> GetVessels(string? imo = null, string? name = null, string? @operator = null)
        {
            var query = _context.Set<Vessel>().Include(v => v.VesselType).AsQueryable();

            if (!string.IsNullOrWhiteSpace(imo))
                query = query.Where(v => v.Imo.Contains(imo));

            if (!string.IsNullOrWhiteSpace(name))
            {
                var lower = name.ToLower();
                query = query.Where(v => v.Name.ToLower().Contains(lower));
            }

            if (!string.IsNullOrWhiteSpace(@operator))
            {
                var lower = @operator.ToLower();
                query = query.Where(v => v.Operator.ToLower().Contains(lower));
            }

            var list = await query.ToListAsync();

            return Ok(list.Select(VesselMapper.ToDTO));
        }

        
        [HttpGet("{imo}")]
        public async Task<ActionResult<VesselDTO>> GetVessel(string imo)
        {
            var vessel = await _context.Set<Vessel>().Include(v => v.VesselType).FirstOrDefaultAsync(v => v.Imo == imo);
            if (vessel == null) return NotFound();
            return VesselMapper.ToDTO(vessel);
        }

        
        [HttpPost]
        public async Task<ActionResult<VesselDTO>> PostVessel(CreateVesselDTO dto)
        {
            if (!VesselMapper.IsValidImo(dto.Imo))
                return BadRequest("Invalid IMO format. It should be 7 digits.");

            
            var vt = await _context.VesselTypes.FindAsync(dto.VesselTypeId);
            if (vt == null) return BadRequest("Invalid VesselTypeId.");

            var model = VesselMapper.ToModel(dto);
            _context.Add(model);
            await _context.SaveChangesAsync();

            await _context.Entry(model).Reference(m => m.VesselType).LoadAsync();

            return CreatedAtAction(nameof(GetVessel), new { imo = model.Imo }, VesselMapper.ToDTO(model));
        }

        
        [HttpPut("{imo}")]
        public async Task<IActionResult> PutVessel(string imo, UpdateVesselDTO dto)
        {
            if (!VesselMapper.IsValidImo(dto.Imo))
                return BadRequest("Invalid IMO format. It should be 7 digits.");

            var vessel = await _context.Set<Vessel>().FindAsync(imo);
            if (vessel == null) return NotFound();

            var vt = await _context.VesselTypes.FindAsync(dto.VesselTypeId);
            if (vt == null) return BadRequest("Invalid VesselTypeId.");

            // Update fields (IMO primary key immutable in this design)
            vessel.Name = dto.Name;
            vessel.VesselTypeId = dto.VesselTypeId;
            vessel.Operator = dto.Operator;

            _context.Entry(vessel).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        
        [HttpDelete("{imo}")]
        public async Task<IActionResult> DeleteVessel(string imo)
        {
            var vessel = await _context.Set<Vessel>().FindAsync(imo);
            if (vessel == null) return NotFound();
            _context.Set<Vessel>().Remove(vessel);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
