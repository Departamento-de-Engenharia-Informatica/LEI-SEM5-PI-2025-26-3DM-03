using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TodoApi.Models;
using TodoApi.Models.Vessels;

namespace TodoApi.Controllers.Vessels
{
    [Route("api/[controller]")]
    [ApiController]
    public class VesselTypesController : ControllerBase
    {
        private readonly PortContext _context;

        public VesselTypesController(PortContext context)
        {
            _context = context;
        }

        // ==============================
        // GET: api/VesselTypes
        // ==============================
        [HttpGet]
        public async Task<ActionResult<IEnumerable<VesselTypeDTO>>> GetVesselTypes(string? search = null)
        {
            var query = _context.VesselTypes.AsQueryable();

            //  Filtro por nome ou descrição (case-insensitive)
            if (!string.IsNullOrWhiteSpace(search))
            {
                string lowerSearch = search.ToLower();
                query = query.Where(vt =>
                    vt.Name.ToLower().Contains(lowerSearch) ||
                    vt.Description.ToLower().Contains(lowerSearch));
            }

            var vesselTypes = await query.ToListAsync();

            return Ok(vesselTypes.Select(VesselTypeMapper.ToDTO));
        }

        // ==============================
        // GET: api/VesselTypes/5
        // ==============================
        [HttpGet("{id}")]
        public async Task<ActionResult<VesselTypeDTO>> GetVesselType(long id)
        {
            var vesselType = await _context.VesselTypes.FindAsync(id);

            if (vesselType == null)
                return NotFound();

            return VesselTypeMapper.ToDTO(vesselType);
        }

        // ==============================
        // POST: api/VesselTypes
        // ==============================
        [HttpPost]
        public async Task<ActionResult<VesselTypeDTO>> PostVesselType(VesselTypeDTO dto)
        {
            var vesselType = VesselTypeMapper.ToModel(dto);

            _context.VesselTypes.Add(vesselType);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetVesselType), new { id = vesselType.Id }, VesselTypeMapper.ToDTO(vesselType));
        }

        // ==============================
        // PUT: api/VesselTypes/5
        // ==============================
        [HttpPut("{id}")]
        public async Task<IActionResult> PutVesselType(long id, VesselTypeDTO dto)
        {
            if (id != dto.Id)
                return BadRequest();

            var vesselType = await _context.VesselTypes.FindAsync(id);
            if (vesselType == null)
                return NotFound();

            // Atualizar os campos
            vesselType.Name = dto.Name;
            vesselType.Description = dto.Description;
            vesselType.Capacity = dto.Capacity;
            vesselType.MaxRows = dto.MaxRows;
            vesselType.MaxBays = dto.MaxBays;
            vesselType.MaxTiers = dto.MaxTiers;

            _context.Entry(vesselType).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
